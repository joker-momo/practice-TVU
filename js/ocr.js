// js/ocr.js

/**
 * Quét hình ảnh bằng Tesseract.js sử dụng gói ngôn ngữ việt-anh
 * @param {File|Blob|string} imageFile - File hình ảnh hoặc URL hình ảnh
 * @param {function} onProgress - Callback theo dõi tiến trình { status, progress }
 * @returns {Promise<object>} Đối tượng câu hỏi đã được phân tách từ văn bản
 */
async function scanImage(imageFile, onProgress) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract.js chưa được tải. Vui lòng kiểm tra kết nối internet hoặc đường dẫn CDN.");
  }

  // Chạy OCR nhận dạng ngôn ngữ kép vie + eng
  const result = await Tesseract.recognize(
    imageFile,
    "vie+eng",
    {
      logger: (m) => {
        if (onProgress && typeof onProgress === "function") {
          onProgress(m);
        }
      }
    }
  );

  const rawText = result.data.text;
  console.log("=== KẾT QUẢ QUÉT THÔ (OCR) ===");
  console.log(rawText);
  console.log("==============================");

  return parseRawText(rawText);
}

/**
 * Phân tách văn bản thô quét được thành danh sách các câu hỏi.
 * Hỗ trợ quét nhiều câu hỏi cùng lúc nếu có ranh giới câu hỏi.
 * @param {string} text 
 * @returns {Array<object>} Mảng các đối tượng câu hỏi
 */
function parseRawText(text) {
  if (!text) {
    return [];
  }

  const lines = text.split("\n").map(line => line.trim());

  // Regex nhận diện bắt đầu câu hỏi mới (ví dụ: "1.", "Câu 2:", "Question 3:")
  const questionStartRegex = /^\s*(?:Câu|Cau|Question|Q)?\s*(\d+)\s*[\.\)\:\-]\s+/i;

  // 1. Tách văn bản thành các khối câu hỏi riêng biệt
  const blocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (questionStartRegex.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // 2. Phân tích từng khối câu hỏi
  let parsedQuestions = [];
  if (blocks.length === 0) {
    parsedQuestions.push(parseSingleBlock(lines));
  } else {
    for (const blockLines of blocks) {
      const q = parseSingleBlock(blockLines);
      if (q.questionText || q.codeSnippet || q.options.some(o => o)) {
        parsedQuestions.push(q);
      }
    }
  }

  // Nếu vẫn không parse được câu nào, trả về 1 câu trống mặc định
  if (parsedQuestions.length === 0) {
    return [{ questionText: "", codeSnippet: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }];
  }

  return parsedQuestions;
}

/**
 * Loại bỏ dấu tiếng Việt để hỗ trợ đối chiếu chính xác bằng Regex không dấu
 * @param {string} str 
 * @returns {string}
 */
function stripDiacritics(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D');
}

/**
 * Phân tích một khối dòng văn bản để trích xuất thành 1 đối tượng câu hỏi hoàn chỉnh
 * @param {string[]} lines 
 * @returns {object}
 */
function parseSingleBlock(lines) {
  let questionLines = [];
  let codeLines = [];
  let options = ["", "", "", ""];
  let explanationLines = [];
  let correctIndex = -1;

  // Từ khóa nhận dạng dòng bắt đầu của Code JS
  const codeStartKeywords = [
    "let ", "const ", "var ", "function", "class ", "import ", "export ",
    "console.log", "for (", "while (", "if ("
  ];

  // Regex nhận diện các đáp án đơn lẻ (Yêu cầu viết hoa và có khoảng trắng sau dấu câu)
  const optionRegex = /^\s*([A-D])\s*[\.\)\:\-]\s+(.*)/;

  // Regex nhận diện đáp án đúng và giải thích (dựa trên văn bản không dấu)
  const correctRegex = /(dap\s*an|cau\s*tra\s*loi|dung|chinh\s*xac|correct|answer)\s*(dung\s*)?([\:\- ]\s*([A-D]))/i;

  // Loại bỏ số thứ tự câu hỏi ở đầu dòng đầu tiên nếu có
  if (lines.length > 0) {
    const questionStartRegex = /^\s*(?:Câu|Cau|Question|Q)?\s*\d+\s*[\.\)\:\-]\s+/i;
    lines[0] = lines[0].replace(questionStartRegex, "").trim();
  }

  // 1. Tìm vị trí đầu tiên xuất hiện đáp án (A. B. C. D.) làm mốc phân tách
  let firstOptionLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Kiểm tra xem dòng này có chứa đáp án A/B/C/D hay không
    const isOption = optionRegex.test(line) || 
                     /^\s*A\s*[\.\)\:\-]\s+.*?\s+B\s*[\.\)\:\-]\s+/.test(line) ||
                     /^\s*C\s*[\.\)\:\-]\s+.*?\s+D\s*[\.\)\:\-]\s+/.test(line);
                     
    if (isOption) {
      firstOptionLineIndex = i;
      break;
    }
  }

  // Nếu không tìm thấy dòng đáp án nào, coi tất cả dòng trước đó là câu hỏi
  const optionCutoff = firstOptionLineIndex !== -1 ? firstOptionLineIndex : lines.length;

  // 2. Tìm vị trí dòng Code JS đầu tiên xuất hiện trước khối đáp án
  let firstCodeLineIndex = -1;
  for (let i = 0; i < optionCutoff; i++) {
    const line = lines[i];
    
    const isCodeStart = codeStartKeywords.some(kw => line.startsWith(kw) || line.includes(kw)) ||
                        line.includes("{") ||
                        (line.endsWith(";") && !line.includes(" ") && line.length > 2);

    if (isCodeStart) {
      firstCodeLineIndex = i;
      break;
    }
  }

  // 3. Phân tách phần Câu hỏi và Code Snippet dựa vào chỉ số đã tìm
  if (firstCodeLineIndex !== -1) {
    // Có code snippet
    questionLines = lines.slice(0, firstCodeLineIndex);
    codeLines = lines.slice(firstCodeLineIndex, optionCutoff);
  } else {
    // Không có code snippet, tất cả là câu hỏi
    questionLines = lines.slice(0, optionCutoff);
  }

  // 4. Phân tích khối Đáp án & Giải thích bắt đầu từ optionCutoff
  let currentOptionLetter = null;

  for (let i = optionCutoff; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Chuẩn hóa dòng chữ không dấu trước khi chạy regex tìm đáp án/giải thích
    const normalizedLine = stripDiacritics(line);

    // A. Kiểm tra xem có chứa thông tin Đáp án đúng hoặc giải thích ở dòng này không
    const correctMatch = normalizedLine.match(correctRegex);
    if (correctMatch && correctMatch[4]) {
      correctIndex = correctMatch[4].toUpperCase().charCodeAt(0) - 65;
      explanationLines.push(line);
      currentOptionLetter = "explanation";
      continue;
    }

    if (/^(giai\s*thich|explanation|ly\s*do|detail)/i.test(normalizedLine)) {
      explanationLines.push(line);
      currentOptionLetter = "explanation";
      continue;
    }

    // B. Kiểm tra xem dòng này có chứa 4 đáp án nằm cùng 1 dòng (inline)
    const abcdMatch = line.match(/^\s*A\s*[\.\)\:\-]\s+(.*?)\s+B\s*[\.\)\:\-]\s+(.*?)\s+C\s*[\.\)\:\-]\s+(.*?)\s+D\s*[\.\)\:\-]\s+(.*)/);
    if (abcdMatch) {
      options[0] = abcdMatch[1].trim();
      options[1] = abcdMatch[2].trim();
      options[2] = abcdMatch[3].trim();
      options[3] = abcdMatch[4].trim();
      currentOptionLetter = "D";
      continue;
    }

    // C. Kiểm tra xem có đáp án A & B inline không
    const abMatch = line.match(/^\s*A\s*[\.\)\:\-]\s+(.*?)\s+B\s*[\.\)\:\-]\s+(.*)/);
    if (abMatch) {
      options[0] = abMatch[1].trim();
      options[1] = abMatch[2].trim();
      currentOptionLetter = "B";
      continue;
    }

    // D. Kiểm tra xem có đáp án C & D inline không
    const cdMatch = line.match(/^\s*C\s*[\.\)\:\-]\s+(.*?)\s+D\s*[\.\)\:\-]\s+(.*)/);
    if (cdMatch) {
      options[2] = cdMatch[1].trim();
      options[3] = cdMatch[2].trim();
      currentOptionLetter = "D";
      continue;
    }

    // E. Kiểm tra xem là dòng đáp án đơn lẻ bình thường (A., B., C., D.)
    const singleMatch = line.match(optionRegex);
    if (singleMatch) {
      const letter = singleMatch[1].toUpperCase();
      const idx = letter.charCodeAt(0) - 65; // A->0, B->1...
      if (idx >= 0 && idx < 4) {
        options[idx] = singleMatch[2].trim();
        currentOptionLetter = letter;
      }
      continue;
    }

    // F. Dòng nối tiếp (không bắt đầu bằng nhãn mới, ghép vào mục đang đọc dở)
    if (currentOptionLetter === "explanation") {
      explanationLines.push(line);
    } else if (currentOptionLetter) {
      const idx = currentOptionLetter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < 4) {
        options[idx] += " " + line;
      }
    } else {
      // Nếu tự dưng lọt dòng văn bản lạ ở khu vực này, tạm ghép vào phần giải thích
      explanationLines.push(line);
    }
  }

  // 5. Quét tìm đáp án đúng bằng RegExp trên toàn bộ text thô (nếu chưa tìm thấy ở trên)
  if (correctIndex === -1) {
    const fullTextMatch = stripDiacritics(lines.join("\n")).match(correctRegex);
    if (fullTextMatch && fullTextMatch[4]) {
      correctIndex = fullTextMatch[4].toUpperCase().charCodeAt(0) - 65;
    }
  }

  // Làm sạch dữ liệu
  options = options.map(opt => opt.trim());
  let explanation = explanationLines.join("\n").trim();
  
  // Dọn dẹp dòng đáp án lọt vào phần giải thích
  if (correctIndex !== -1) {
    const letter = String.fromCharCode(65 + correctIndex);
    const cleanRegex = new RegExp(`.*(?:dap\\s*an|cau\\s*tra\\s*loi|dung|chinh\\s*xac|correct|answer)\\s*(dung\\s*)?[:\\- ]\\s*${letter}.*`, 'gi');
    
    explanationLines = explanationLines.filter(line => {
      const norm = stripDiacritics(line);
      return !cleanRegex.test(norm);
    });
    explanation = explanationLines.join("\n").trim();
  }

  // Loại bỏ nhãn "Giải thích:" ở đầu giải thích nếu có
  const explanationLabelRegex = /^\s*(?:giai\s*thich|explanation|ly\s*do|detail)\s*[\:\-]\s*/i;
  explanation = explanation.replace(explanationLabelRegex, "").trim();

  return {
    questionText: questionLines.join(" ").trim(),
    codeSnippet: codeLines.join("\n").trim(),
    options: options,
    correctIndex: (correctIndex >= 0 && correctIndex < 4) ? correctIndex : 0,
    explanation: explanation
  };
}

