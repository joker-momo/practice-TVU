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
 * Tạo ID ngẫu nhiên duy nhất
 * @returns {string}
 */
function generateId() {
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}
