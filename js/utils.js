// js/utils.js

/**
 * Chuẩn hóa chuỗi văn bản bằng cách:
 * 1. Chuyển sang chữ thường
 * 2. Loại bỏ dấu tiếng Việt (diacritics)
 * 3. Loại bỏ ký tự đặc biệt, chỉ giữ lại chữ cái và chữ số
 * 4. Loại bỏ mọi khoảng trắng
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Loại bỏ các dấu tiếng Việt
    .replace(/[^a-z0-9]/g, "")        // Loại bỏ các ký tự đặc biệt, chỉ giữ chữ và số
    .trim();
}

/**
 * Tính toán độ tương đồng Jaccard dựa trên tập hợp N-gram (Bigrams - 2 ký tự liên tiếp).
 * Rất hiệu quả cho việc so khớp chống trùng lặp bất kể lỗi chính tả nhỏ hoặc khoảng trắng của OCR.
 * @param {string} text1
 * @param {string} text2
 * @returns {number} Giá trị tương đồng từ 0.0 đến 1.0
 */
function checkSimilarity(text1, text2) {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Tạo tập hợp Bigram cho chuỗi
  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const set1 = getBigrams(norm1);
  const set2 = getBigrams(norm2);

  // Giao của hai tập hợp
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  // Hợp của hai tập hợp
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0.0;

  return intersection.size / union.size;
}

/**
 * Lấy đáp án đúng dưới dạng chuẩn hóa để đối chiếu giữa các câu hỏi.
 * Với câu điền từ, đáp án là nội dung nằm trong marker {{...}}.
 * @param {object} question
 * @returns {string}
 */
function normalizedCorrectAnswer(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const correctOption = options[Number(question?.correctIndex)];
  if (String(correctOption || "").trim()) {
    return normalizeText(String(correctOption));
  }

  const fillAnswers = [...String(question?.questionText || "").matchAll(/\{\{(.+?)\}\}/g)]
    .map(([, answer]) => answer)
    .join(" ");
  return normalizeText(fillAnswers);
}

/**
 * Hai câu có cùng đáp án đúng khi nội dung đáp án khớp sau chuẩn hóa.
 * @param {object} firstQuestion
 * @param {object} secondQuestion
 * @returns {boolean}
 */
function answersMatch(firstQuestion, secondQuestion) {
  const firstAnswer = normalizedCorrectAnswer(firstQuestion);
  const secondAnswer = normalizedCorrectAnswer(secondQuestion);
  return Boolean(firstAnswer) && firstAnswer === secondAnswer;
}

/**
 * Tạo ID ngẫu nhiên duy nhất
 * @returns {string}
 */
function generateId() {
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

/**
 * Câu hỏi dạng điền từ? Điều kiện kép: questionText chứa marker {{...}}
 * VÀ options rỗng/toàn chuỗi rỗng (để câu trắc nghiệm lỡ chứa "{{" không bị nhận nhầm).
 * @param {object} q - Câu hỏi (shape hệ thống)
 * @returns {boolean}
 */
function isFillQuestion(q) {
  if (!q || typeof q.questionText !== "string") return false;
  if (!/\{\{.+?\}\}/.test(q.questionText)) return false;
  const opts = Array.isArray(q.options) ? q.options : [];
  return opts.every(o => !o || !String(o).trim());
}

/**
 * Render questionText của câu điền từ thành HTML an toàn.
 * Escape HTML TRƯỚC rồi mới thay marker (chống XSS).
 * @param {string} questionText
 * @param {"blank"|"answer"} mode - "blank": ô trống ______; "answer": hiện đáp án tô màu
 * @returns {string} HTML
 */
function renderFillText(questionText, mode) {
  const escaped = String(questionText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return escaped.replace(/\{\{(.+?)\}\}/g, (m, ans) =>
    mode === "answer"
      ? '<span class="fill-answer">' + ans + '</span>'
      : '<span class="fill-blank">______</span>'
  );
}
