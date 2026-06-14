/**
 * Chuẩn hóa văn bản để so sánh (bỏ dấu câu biên, viết thường, cắt khoảng trắng, đồng bộ gạch ngang)
 * @param {string} text 
 * @returns {string}
 */
function normalizeTextForComparison(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[\–\—\−]/g, "-")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chuyển đổi định dạng JSON câu hỏi tiếng Việt tùy chỉnh của người dùng sang định dạng hệ thống
 * @param {Array} jsonArray 
 * @returns {Array}
 */
function convertCustomJSONToQuestions(jsonArray) {
  return jsonArray.map(item => {
    const rawOptions = item.danh_sach_dap_an || [];
    const cleanOptions = rawOptions.map(opt => {
      if (typeof opt !== 'string') return String(opt || '').trim();
      // Bóc tách nhãn "A. ", "B. ", "A) ", "B) " ở đầu
      const match = opt.match(/^\s*([A-D])\s*(?:([\.\)\:])\s*(.*)|([\-\/])\s+(.*))/i);
      if (match) {
        const content = match[3] !== undefined ? match[3] : match[5];
        return content.trim();
      }
      return opt.trim();
    });

    while (cleanOptions.length < 4) {
      cleanOptions.push("");
    }

    const targetAnswer = (item.dap_an_dung || "").trim();
    let correctIndex = -1;

    if (targetAnswer) {
      const targetLower = targetAnswer.toLowerCase();
      const normTarget = normalizeTextForComparison(targetAnswer);

      // 1. So khớp chính xác hoàn toàn với cleanOptions (nội dung sạch)
      for (let i = 0; i < cleanOptions.length; i++) {
        if (cleanOptions[i].toLowerCase() === targetLower) {
          correctIndex = i;
          break;
        }
      }

      // 2. So khớp chính xác hoàn toàn với rawOptions (cả nhãn)
      if (correctIndex === -1) {
        for (let i = 0; i < rawOptions.length; i++) {
          if (rawOptions[i].trim().toLowerCase() === targetLower) {
            correctIndex = i;
            break;
          }
        }
      }

      // 3. So khớp chuẩn hóa với cleanOptions
      if (correctIndex === -1 && normTarget) {
        for (let i = 0; i < cleanOptions.length; i++) {
          if (normalizeTextForComparison(cleanOptions[i]) === normTarget) {
            correctIndex = i;
            break;
          }
        }
      }

      // 4. So khớp chuẩn hóa với rawOptions
      if (correctIndex === -1 && normTarget) {
        for (let i = 0; i < rawOptions.length; i++) {
          if (normalizeTextForComparison(rawOptions[i]) === normTarget) {
            correctIndex = i;
            break;
          }
        }
      }

      // 5. Kiểm tra nếu dap_an_dung chỉ là một nhãn chữ cái (A, B, C, D) hoặc "đáp án A", "câu A"
      if (correctIndex === -1) {
        const labelMatch = targetAnswer.match(/^(đáp án|câu|chọn)?\s*([a-d])\.?$/i);
        if (labelMatch) {
          const letter = labelMatch[2].toUpperCase();
          correctIndex = letter.charCodeAt(0) - 65;
        }
      }

      // 6. So khớp tương đối bằng chứa chuỗi (substring) trên văn bản chuẩn hóa
      if (correctIndex === -1 && normTarget) {
        for (let i = 0; i < cleanOptions.length; i++) {
          const normOpt = normalizeTextForComparison(cleanOptions[i]);
          if (normOpt && (normOpt.includes(normTarget) || normTarget.includes(normOpt))) {
            correctIndex = i;
            break;
          }
        }
      }
    }

    if (correctIndex === -1) {
      correctIndex = 0;
    }

    let explanation = item.giai_thich || "";
    if (item.tham_khao) {
      if (explanation) {
        explanation += `\nTham khảo: ${item.tham_khao}`;
      } else {
        explanation = `Tham khảo: ${item.tham_khao}`;
      }
    }

    return {
      questionText: item.cau_hoi || "",
      codeSnippet: "",
      options: cleanOptions.slice(0, 4),
      correctIndex: correctIndex,
      explanation: explanation
    };
  });
}



/**
 * Trích danh sách câu hỏi (định dạng hệ thống) từ object JSON đã parse.
 * Hỗ trợ: mảng định dạng tùy chỉnh (cau_hoi...), {subjects:[...]}, {questions:[...]}.
 * @param {any} data
 * @returns {Array}
 */
function extractParsedQuestions(data) {
  if (Array.isArray(data)) {
    return convertCustomJSONToQuestions(data);
  }
  if (data && Array.isArray(data.subjects)) {
    const firstSubj = data.subjects[0];
    if (firstSubj && Array.isArray(firstSubj.questions)) return firstSubj.questions;
  }
  if (data && Array.isArray(data.questions)) {
    return data.questions;
  }
  return [];
}

/**
 * Khởi tạo và render View Quản lý câu hỏi (Editor)
 * @param {HTMLElement} container - Element chứa panel chính
 * @param {object} store - State store toàn cục
 */
function initEditor(container, store) {
  // Parse raw JSON -> mở modal xem trước import. Dùng chung cho nút file & nút dán.
  const importFromRawJSON = (rawText) => {
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      alert("Lỗi phân tích cú pháp JSON: " + err.message);
      return false;
    }
    const parsedQuestions = extractParsedQuestions(data);
    if (parsedQuestions.length === 0) {
      alert("Không tìm thấy dữ liệu câu hỏi hợp lệ trong JSON này.");
      return false;
    }
    showImportModal(null, parsedQuestions);
    return true;
  };
  let activeState = null;

  const render = (state) => {
    activeState = state;
    const { subjects, currentSubjectId } = state;
    const subject = subjects.find(s => s.id === currentSubjectId);
    const isAdmin = !!(window.admin && window.admin.isAdmin());

    if (!subject) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
          <p>Vui lòng chọn hoặc thêm một môn học ở thanh bên để bắt đầu quản lý câu hỏi.</p>
        </div>
      `;
      return;
    }

    const questions = subject.questions || [];

    let html = `
      <div class="editor-header">
        <div class="header-meta">
          <h2 class="header-title">${subject.name}</h2>
          <span class="header-subtitle">Quản lý danh sách <em>${questions.length} câu hỏi</em></span>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          ${isAdmin ? `
          <button class="btn import-json-btn" style="background: var(--bg-paper); border: 1px solid var(--border-light); color: var(--text-base);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Nhập file JSON
          </button>
          <button class="btn paste-json-btn" style="background: var(--bg-paper); border: 1px solid var(--border-light); color: var(--text-base);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            Dán JSON
          </button>` : ''}
          <button class="btn export-json-btn" style="background: var(--bg-paper); border: 1px solid var(--border-light); color: var(--text-base);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Xuất file JSON
          </button>
          <button class="btn export-js-btn" style="background: var(--bg-paper); border: 1px solid var(--border-light); color: var(--text-base);" title="Tải questions.js để commit lên host — dữ liệu dùng chung, chạy được cả khi mở file://">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Xuất file JS
          </button>
          ${isAdmin ? `
          <button class="btn add-manual-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
            </svg>
            Thêm thủ công
          </button>
          <button class="btn btn-primary import-img-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            Quét hình ảnh (OCR)
          </button>` : ''}
        </div>
      </div>
    `;

    if (questions.length === 0) {
      html += isAdmin ? `
        <div class="dropzone" id="empty-state-dropzone" style="margin-top: 2rem;">
          <div class="dropzone-icon">📥</div>
          <p class="dropzone-text">Môn học này chưa có câu hỏi nào</p>
          <p class="dropzone-subtext">Nhấn nút bên trên để thêm thủ công hoặc kéo thả ảnh vào đây để quét OCR tự động</p>
        </div>
      ` : `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
          <p>Môn học này chưa có câu hỏi nào.</p>
        </div>
      `;
    } else {
      html += `
        <table class="question-list-table">
          <thead>
            <tr>
              <th style="width: 48px; text-align: center;">STT</th>
              <th>Nội dung câu hỏi</th>
              <th style="width: 24%;">Đáp án đúng</th>
              <th style="width: 130px;">Tiến độ ghi nhớ</th>
              <th style="width: 120px; text-align: right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
      `;

      questions.forEach((q, idx) => {
        const attempts = q.history?.attempts || 0;
        const correct = q.history?.correct || 0;
        const progressPercent = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
        const starIcon = q.isBookmarked ? "★" : "☆";
        const ci = typeof q.correctIndex === "number" ? q.correctIndex : 0;
        const correctLetter = ci >= 0 && ci < 4 ? String.fromCharCode(65 + ci) : "?";
        const correctText = (q.options && q.options[ci]) ? q.options[ci] : "(chưa có)";

        html += `
          <tr data-id="${q.id}">
            <td class="stt-cell">${idx + 1}</td>
            <td>
              <div class="question-row-text">${q.questionText}</div>
              ${q.codeSnippet ? `<span style="font-family: var(--font-mono); font-size: 0.75rem; background: var(--bg-base); padding: 0.1rem 0.3rem; border-radius: 4px; color: var(--accent);">[Có code snippet]</span>` : ''}
            </td>
            <td class="answer-correct-cell"><strong>${correctLetter}.</strong> ${correctText}</td>
            <td style="font-size: 0.9rem;">
              <span style="font-weight: 600; color: ${progressPercent > 50 ? 'var(--success)' : 'var(--text-muted)'}">
                ${progressPercent}% (${correct}/${attempts})
              </span>
            </td>
            <td style="text-align: right;">
              <div class="action-links" style="justify-content: flex-end;">
                <button class="link-btn toggle-bookmark-btn" title="Đánh dấu câu hỏi">${starIcon}</button>
                ${isAdmin ? `
                <button class="link-btn edit-btn">Sửa</button>
                <button class="link-btn link-btn-danger delete-btn">Xóa</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    container.innerHTML = html;

    // --- SỰ KIỆN KHỞI CHẠY ---

    // Đánh dấu Bookmark
    container.querySelectorAll('.toggle-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = btn.closest('tr');
        const qId = row.getAttribute('data-id');
        store.toggleBookmark(currentSubjectId, qId);
      });
    });

    // Sửa câu hỏi
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const qId = row.getAttribute('data-id');
        const question = questions.find(q => q.id === qId);
        showQuestionModal(question);
      });
    });

    // Xóa câu hỏi
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const qId = row.getAttribute('data-id');
        if (confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) {
          store.deleteQuestion(currentSubjectId, qId);
        }
      });
    });

    // Xuất dữ liệu JSON
    container.querySelector('.export-json-btn').addEventListener('click', () => {
      const cleanSubjects = store.state.subjects.map(s => {
        return {
          id: s.id,
          name: s.name,
          questions: (s.questions || []).map(q => {
            const { history, isBookmarked, ...cleanQ } = q;
            return cleanQ;
          })
        };
      });

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ subjects: cleanSubjects }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "questions.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Xuất file JS (questions.js) để publish dữ liệu dùng chung — chạy được cả khi mở file://
    container.querySelector('.export-js-btn').addEventListener('click', () => {
      const cleanSubjects = store.state.subjects.map(s => {
        return {
          id: s.id,
          name: s.name,
          questions: (s.questions || []).map(q => {
            const { history, isBookmarked, ...cleanQ } = q;
            return cleanQ;
          })
        };
      });

      const fileContent =
        '// Dữ liệu câu hỏi dùng chung (public). Nạp dạng global để chạy được cả khi mở file://\n' +
        '// Cập nhật bằng nút "Xuất file JS" trong tab Quản lý, rồi commit file này lên host.\n' +
        'window.QUESTIONS_DATA = ' + JSON.stringify({ subjects: cleanSubjects }, null, 2) + ';\n';

      const dataStr = "data:text/javascript;charset=utf-8," + encodeURIComponent(fileContent);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "questions.js");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Nhập dữ liệu JSON (chỉ admin)
    const importJsonBtn = container.querySelector('.import-json-btn');
    if (importJsonBtn) importJsonBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          importFromRawJSON(event.target.result);
        };
        reader.readAsText(file);
      });

      fileInput.click();
      fileInput.remove();
    });

    // Dán JSON raw (chỉ admin)
    const pasteJsonBtn = container.querySelector('.paste-json-btn');
    if (pasteJsonBtn) pasteJsonBtn.addEventListener('click', () => showPasteJSONModal());

    // Thêm thủ công (chỉ admin)
    const addManualBtn = container.querySelector('.add-manual-btn');
    if (addManualBtn) addManualBtn.addEventListener('click', () => {
      showQuestionModal(null);
    });

    // Click Quét OCR hình ảnh (chỉ admin)
    const importImgBtn = container.querySelector('.import-img-btn');
    if (importImgBtn) importImgBtn.addEventListener('click', () => {
      showImportModal();
    });

    // Drag and drop empty state dropzone
    const dropzone = container.querySelector('#empty-state-dropzone');
    if (dropzone) {
      // Ngăn chặn hành vi mặc định của trình duyệt
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
      });

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          showImportModal(files[0]);
        }
      });

      dropzone.addEventListener('click', () => {
        showImportModal();
      });
    }
  };

  // --- MODAL THÊM/SỬA CÂU HỎI THỦ CÔNG ---
  const showQuestionModal = (question = null) => {
    const isEdit = !!question;
    const modalHtml = `
      <div class="modal-overlay" id="question-modal">
        <div class="modal-card" style="max-width: 600px;">
          <div class="modal-header">
            <h3 class="modal-title">${isEdit ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}</h3>
            <button class="link-btn close-modal-btn" style="font-size: 1.5rem;">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Câu hỏi</label>
              <textarea id="q-text" class="form-control" placeholder="Nhập nội dung câu hỏi...">${isEdit ? question.questionText : ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Code Snippet (Không bắt buộc)</label>
              <textarea id="q-code" class="form-control" style="font-family: var(--font-mono); font-size: 0.85rem;" placeholder="const x = 10;...">${isEdit ? question.codeSnippet : ''}</textarea>
            </div>
            <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Đáp án A</label>
                <input type="text" id="opt-a" class="form-control" value="${isEdit ? question.options[0] : ''}" placeholder="Đáp án A" />
              </div>
              <div class="form-group">
                <label class="form-label">Đáp án B</label>
                <input type="text" id="opt-b" class="form-control" value="${isEdit ? question.options[1] : ''}" placeholder="Đáp án B" />
              </div>
              <div class="form-group">
                <label class="form-label">Đáp án C</label>
                <input type="text" id="opt-c" class="form-control" value="${isEdit ? question.options[2] : ''}" placeholder="Đáp án C" />
              </div>
              <div class="form-group">
                <label class="form-label">Đáp án D</label>
                <input type="text" id="opt-d" class="form-control" value="${isEdit ? question.options[3] : ''}" placeholder="Đáp án D" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Đáp án đúng</label>
              <select id="correct-idx" class="form-control">
                <option value="0" ${isEdit && question.correctIndex === 0 ? 'selected' : ''}>A</option>
                <option value="1" ${isEdit && question.correctIndex === 1 ? 'selected' : ''}>B</option>
                <option value="2" ${isEdit && question.correctIndex === 2 ? 'selected' : ''}>C</option>
                <option value="3" ${isEdit && question.correctIndex === 3 ? 'selected' : ''}>D</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Giải thích chi tiết</label>
              <textarea id="q-explanation" class="form-control" placeholder="Giải thích tại sao đáp án đó đúng...">${isEdit ? question.explanation : ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn cancel-btn">Hủy</button>
            <button class="btn btn-primary save-btn">Lưu câu hỏi</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('question-modal');

    const closeModal = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 250);
    };

    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

    modal.querySelector('.save-btn').addEventListener('click', () => {
      const qText = modal.querySelector('#q-text').value.trim();
      const qCode = modal.querySelector('#q-code').value.trim();
      const optA = modal.querySelector('#opt-a').value.trim();
      const optB = modal.querySelector('#opt-b').value.trim();
      const optC = modal.querySelector('#opt-c').value.trim();
      const optD = modal.querySelector('#opt-d').value.trim();
      const correctIdx = parseInt(modal.querySelector('#correct-idx').value);
      const explanation = modal.querySelector('#q-explanation').value.trim();

      if (!qText) {
        alert("Vui lòng nhập nội dung câu hỏi!");
        modal.querySelector('#q-text').focus();
        return;
      }

      const questionData = {
        questionText: qText,
        codeSnippet: qCode,
        options: [optA, optB, optC, optD],
        correctIndex: correctIdx,
        explanation: explanation
      };

      if (isEdit) {
        store.updateQuestion(activeState.currentSubjectId, question.id, questionData);
      } else {
        store.addQuestion(activeState.currentSubjectId, questionData);
      }

      closeModal();
    });
  };

  // --- MODAL DÁN JSON RAW ---
  const showPasteJSONModal = () => {
    const modalHtml = `
      <div class="modal-overlay" id="paste-json-modal">
        <div class="modal-card" style="max-width: 700px; width: 95%;">
          <div class="modal-header">
            <h3 class="modal-title">Dán JSON câu hỏi</h3>
            <button class="link-btn close-modal-btn" style="font-size: 1.5rem;">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Dán nội dung JSON vào đây</label>
              <textarea id="paste-json-area" class="form-control" rows="14"
                style="font-family: var(--font-mono); font-size: 0.8rem;"
                placeholder='[{"stt":1,"cau_hoi":"...","danh_sach_dap_an":["A. ...","B. ..."],"dap_an_dung":"...","giai_thich":"","tham_khao":""}]'></textarea>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                Chấp nhận: mảng định dạng tùy chỉnh (cau_hoi / danh_sach_dap_an / dap_an_dung...), hoặc {"subjects":[...]}, hoặc {"questions":[...]}.
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn cancel-btn">Hủy</button>
            <button class="btn btn-primary preview-btn">Xem trước &amp; Import</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('paste-json-modal');
    const area = modal.querySelector('#paste-json-area');

    const closeModal = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 250);
    };
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

    modal.querySelector('.preview-btn').addEventListener('click', () => {
      const text = area.value.trim();
      if (!text) {
        alert("Vui lòng dán nội dung JSON.");
        area.focus();
        return;
      }
      // importFromRawJSON tự mở modal xem trước; chỉ đóng modal dán khi parse OK
      if (importFromRawJSON(text)) {
        closeModal();
      }
    });

    setTimeout(() => area.focus(), 50);
  };

  // --- MODAL IMPORT HÌNH ẢNH OCR & JSON ---
  const showImportModal = (preloadedFile = null, preparsedQuestions = null) => {
    let scannedQuestions = []; // Lưu trữ danh sách câu hỏi đã quét và phân tích được

    const modalHtml = `
      <div class="modal-overlay" id="import-modal">
        <div class="modal-card" style="max-width: 1050px; width: 95%;">
          <div class="modal-header">
            <h3 class="modal-title">Quét hình ảnh câu hỏi bằng AI OCR</h3>
            <button class="link-btn close-modal-btn" style="font-size: 1.5rem;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 1rem;">
            <!-- Dropzone tải ảnh lên ban đầu -->
            <div class="dropzone" id="ocr-dropzone" style="display: ${preloadedFile || preparsedQuestions ? 'none' : 'flex'};">
              <div class="dropzone-icon">📸</div>
              <p class="dropzone-text">Kéo thả ảnh câu hỏi vào đây hoặc click để chọn ảnh</p>
              <p class="dropzone-subtext">Hỗ trợ định dạng PNG, JPG, JPEG. Chấp nhận ảnh dài chứa nhiều câu hỏi.</p>
              <input type="file" id="ocr-file-input" style="display: none;" accept="image/*" />
            </div>

            <!-- Workspace chỉnh sửa Side-by-Side khi đã nhận được file -->
            <div class="import-workspace" id="ocr-workspace" style="display: ${preloadedFile || preparsedQuestions ? 'grid' : 'none'};">
              <div class="import-image-view">
                <img id="ocr-preview-img" src="" alt="Ảnh câu hỏi" />
                
                <!-- Overlay loading tiến độ OCR -->
                <div class="ocr-loading-overlay" id="ocr-loader" style="display: none;">
                  <div class="spinner"></div>
                  <div class="ocr-progress-text" id="ocr-progress-label">Đang chuẩn bị quét...</div>
                </div>
              </div>
              
              <div style="overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;" id="ocr-results-panel">
                <!-- Danh sách câu hỏi quét được sẽ render ở đây -->
              </div>
            </div>
          </div>
          <div class="modal-footer" id="ocr-footer" style="display: ${preloadedFile || preparsedQuestions ? 'flex' : 'none'};">
            <button class="btn cancel-btn">Hủy bỏ</button>
            <button class="btn btn-primary" id="btn-ocr-save-all" disabled>Import các câu đã chọn (0)</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('import-modal');
    const dropzone = modal.querySelector('#ocr-dropzone');
    const workspace = modal.querySelector('#ocr-workspace');
    const footer = modal.querySelector('#ocr-footer');
    const fileInput = modal.querySelector('#ocr-file-input');
    const saveBtn = modal.querySelector('#btn-ocr-save-all');
    const resultsPanel = modal.querySelector('#ocr-results-panel');

    const closeModal = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 250);
    };

    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

    // Xử lý nạp dữ liệu JSON câu hỏi tĩnh
    if (preparsedQuestions) {
      modal.querySelector('.modal-title').innerText = "Xem trước và Import Câu Hỏi từ JSON";
      modal.querySelector('.import-image-view').style.display = 'none';
      workspace.style.gridTemplateColumns = '1fr';

      const currentSubject = activeState.subjects.find(s => s.id === activeState.currentSubjectId);
      const currentQuestions = currentSubject?.questions || [];

      scannedQuestions = preparsedQuestions.map((q, index) => {
        let maxSim = 0;
        let matchedQ = null;

        currentQuestions.forEach(existingQ => {
          const sim = checkSimilarity(q.questionText, existingQ.questionText);
          if (sim > maxSim) {
            maxSim = sim;
            matchedQ = existingQ;
          }
        });

        const isDuplicate = maxSim >= 0.8;
        return {
          id: `scanned-q-${index}-${Date.now()}`,
          questionText: q.questionText,
          codeSnippet: q.codeSnippet || "",
          options: [...q.options],
          correctIndex: q.correctIndex,
          explanation: q.explanation || "",
          selected: !isDuplicate,
          expanded: index === 0,
          duplicateStatus: {
            isDuplicate: isDuplicate,
            similarity: maxSim,
            duplicateOfId: matchedQ ? matchedQ.id : null,
            duplicateText: matchedQ ? matchedQ.questionText : "",
            overwrite: false
          }
        };
      });

      setTimeout(() => {
        renderScannedQuestions();
        updateSaveBtnState();
      }, 0);
    }

    // Xử lý kéo thả file vào modal
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) processFile(files[0]);
    });

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) processFile(fileInput.files[0]);
    });

    // Hàm tiền xử lý file ảnh và kích hoạt OCR
    const processFile = (file) => {
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chỉ tải lên tệp tin hình ảnh!');
        return;
      }

      dropzone.style.display = 'none';
      workspace.style.display = 'grid';
      footer.style.display = 'flex';

      const previewImg = modal.querySelector('#ocr-preview-img');
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        runOCR(file);
      };
      reader.readAsDataURL(file);
    };

    // Tiến hành quét OCR
    const runOCR = async (file) => {
      const loader = modal.querySelector('#ocr-loader');
      const progressLabel = modal.querySelector('#ocr-progress-label');
      loader.style.display = 'flex';
      saveBtn.disabled = true;

      try {
        const rawQuestions = await scanImage(file, (m) => {
          if (m.status === 'recognizing text') {
            const percent = Math.round(m.progress * 100);
            progressLabel.innerText = `Đang phân tích hình ảnh... ${percent}%`;
          } else if (m.status === 'loading tesseract core') {
            progressLabel.innerText = 'Đang tải thư viện AI Core...';
          } else if (m.status === 'loading language traineddata') {
            progressLabel.innerText = 'Đang cài đặt gói ngôn ngữ Việt-Anh...';
          } else {
            progressLabel.innerText = 'Đang nhận diện chữ và mã nguồn...';
          }
        });

        // Chuyển đổi sang cấu trúc dữ liệu có trạng thái selected, duplicate và ID tạm thời
        const currentSubject = activeState.subjects.find(s => s.id === activeState.currentSubjectId);
        const currentQuestions = currentSubject?.questions || [];

        scannedQuestions = rawQuestions.map((q, index) => {
          // Kiểm tra trùng lặp với các câu hỏi hiện có trong môn học
          let maxSim = 0;
          let matchedQ = null;

          currentQuestions.forEach(existingQ => {
            const sim = checkSimilarity(q.questionText, existingQ.questionText);
            if (sim > maxSim) {
              maxSim = sim;
              matchedQ = existingQ;
            }
          });

          const isDuplicate = maxSim >= 0.8;
          return {
            id: `scanned-q-${index}-${Date.now()}`,
            questionText: q.questionText,
            codeSnippet: q.codeSnippet,
            options: [...q.options],
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            selected: !isDuplicate, // Mặc định bỏ chọn nếu trùng lặp
            expanded: index === 0, // Mở rộng câu hỏi đầu tiên mặc định
            duplicateStatus: {
              isDuplicate: isDuplicate,
              similarity: maxSim,
              duplicateOfId: matchedQ ? matchedQ.id : null,
              duplicateText: matchedQ ? matchedQ.questionText : "",
              overwrite: false
            }
          };
        });

        renderScannedQuestions();

      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra trong quá trình nhận diện chữ OCR: ' + err.message);
      } finally {
        loader.style.display = 'none';
        updateSaveBtnState();
      }
    };

    // Hàm render danh sách câu hỏi quét được
    const renderScannedQuestions = () => {
      if (scannedQuestions.length === 0) {
        resultsPanel.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Không thể nhận diện được câu hỏi nào từ hình ảnh này.
          </div>
        `;
        return;
      }

      // Checkbox chọn tất cả
      const allSelected = scannedQuestions.every(q => q.selected);
      
      let html = `
        <div class="select-all-bar">
          <input type="checkbox" id="select-all-scanned" ${allSelected ? 'checked' : ''} class="scanned-q-checkbox" />
          <label for="select-all-scanned" style="cursor:pointer; margin:0; font-size: 0.85rem;">Chọn các câu hợp lệ (không trùng)</label>
        </div>
        <div class="scanned-questions-list">
      `;

      scannedQuestions.forEach((q, idx) => {
        const dup = q.duplicateStatus;
        const isExact = dup.similarity >= 1; // trùng 100% (giống hệt sau chuẩn hóa)
        const badgeClass = !dup.isDuplicate ? 'badge-clean' : (isExact ? 'badge-duplicate' : 'badge-near');
        const badgeText = dup.isDuplicate ? `Trùng ${Math.round(dup.similarity * 100)}%` : 'Hợp lệ';
        let statusText = '';
        if (dup.isDuplicate) {
          statusText = dup.overwrite ? ' (Sẽ ghi đè)' : (q.selected ? ' (Sẽ thêm mới)' : ' (Bỏ qua)');
        }

        html += `
          <div class="scanned-q-card ${q.expanded ? 'expanded' : ''}" data-id="${q.id}">
            <div class="scanned-q-header">
              <input type="checkbox" class="scanned-q-checkbox card-select-check" ${q.selected ? 'checked' : ''} />
              <span class="scanned-q-title">Câu ${idx + 1}: ${q.questionText || "[Không có nội dung câu hỏi]"}</span>
              <span class="scanned-q-badge ${badgeClass}">${badgeText}${statusText}</span>
              <span class="scanned-q-toggle-icon">▼</span>
            </div>
            
            <div class="scanned-q-body">
              ${dup.isDuplicate ? `
                <div class="scanned-q-warning-banner">
                  <div>⚠️ Câu hỏi này giống <strong>${Math.round(dup.similarity * 100)}%</strong> với câu đã có trong kho:</div>
                  <div style="font-style: italic; color: var(--text-muted); margin-bottom: 0.25rem;">"${dup.duplicateText.substring(0, 150)}..."</div>
                  <div class="scanned-q-warning-actions">
                    <button class="scanned-q-warning-btn btn-overwrite">Ghi đè câu cũ</button>
                    ${!isExact ? `<button class="scanned-q-warning-btn btn-add-anyway">Vẫn thêm câu này (khác câu cũ)</button>` : ''}
                    <button class="scanned-q-warning-btn btn-skip">Bỏ chọn câu này</button>
                  </div>
                </div>
              ` : ''}

              <div class="form-group">
                <label class="form-label">Câu hỏi</label>
                <textarea class="form-control field-q-text" rows="2">${q.questionText}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Code Snippet (Không bắt buộc)</label>
                <textarea class="form-control field-q-code" style="font-family: var(--font-mono); font-size: 0.8rem;" rows="3">${q.codeSnippet}</textarea>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div class="form-group">
                  <label class="form-label">Đáp án A</label>
                  <input type="text" class="form-control field-opt-a" value="${q.options[0] || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Đáp án B</label>
                  <input type="text" class="form-control field-opt-b" value="${q.options[1] || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Đáp án C</label>
                  <input type="text" class="form-control field-opt-c" value="${q.options[2] || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Đáp án D</label>
                  <input type="text" class="form-control field-opt-d" value="${q.options[3] || ''}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Đáp án đúng</label>
                <select class="form-control field-correct-idx">
                  <option value="0" ${q.correctIndex === 0 ? 'selected' : ''}>A</option>
                  <option value="1" ${q.correctIndex === 1 ? 'selected' : ''}>B</option>
                  <option value="2" ${q.correctIndex === 2 ? 'selected' : ''}>C</option>
                  <option value="3" ${q.correctIndex === 3 ? 'selected' : ''}>D</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Giải thích bổ sung</label>
                <textarea class="form-control field-q-explanation" rows="2">${q.explanation}</textarea>
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      resultsPanel.innerHTML = html;

      // Đăng ký sự kiện điều khiển cho từng thẻ
      const cards = resultsPanel.querySelectorAll('.scanned-q-card');
      cards.forEach(card => {
        const id = card.getAttribute('data-id');
        const qIndex = scannedQuestions.findIndex(item => item.id === id);
        const question = scannedQuestions[qIndex];

        // Click vào tiêu đề để đóng/mở accordion
        card.querySelector('.scanned-q-header').addEventListener('click', (e) => {
          if (e.target.classList.contains('scanned-q-checkbox')) return;
          
          question.expanded = !question.expanded;
          card.classList.toggle('expanded', question.expanded);
        });

        // Click checkbox chọn câu hỏi
        const check = card.querySelector('.card-select-check');
        check.addEventListener('change', (e) => {
          question.selected = e.target.checked;
          if (!question.selected) {
            question.duplicateStatus.overwrite = false;
          }
          renderScannedQuestions();
          updateSaveBtnState();
        });

        // Xử lý sự kiện nhập liệu inline để đồng bộ dữ liệu vào mảng scannedQuestions
        card.querySelector('.field-q-text').addEventListener('input', (e) => {
          question.questionText = e.target.value;
          card.querySelector('.scanned-q-title').innerText = `Câu ${qIndex + 1}: ${e.target.value}`;
        });

        card.querySelector('.field-q-code').addEventListener('input', (e) => {
          question.codeSnippet = e.target.value;
        });

        card.querySelector('.field-opt-a').addEventListener('input', (e) => {
          question.options[0] = e.target.value;
        });
        card.querySelector('.field-opt-b').addEventListener('input', (e) => {
          question.options[1] = e.target.value;
        });
        card.querySelector('.field-opt-c').addEventListener('input', (e) => {
          question.options[2] = e.target.value;
        });
        card.querySelector('.field-opt-d').addEventListener('input', (e) => {
          question.options[3] = e.target.value;
        });

        card.querySelector('.field-correct-idx').addEventListener('change', (e) => {
          question.correctIndex = parseInt(e.target.value);
        });

        card.querySelector('.field-q-explanation').addEventListener('input', (e) => {
          question.explanation = e.target.value;
        });

        // Nhấp nút Ghi đè câu hỏi cũ
        const btnOverwrite = card.querySelector('.btn-overwrite');
        if (btnOverwrite) {
          btnOverwrite.addEventListener('click', () => {
            question.duplicateStatus.overwrite = true;
            question.selected = true;
            renderScannedQuestions();
            updateSaveBtnState();
          });
        }

        // Nhấp nút Vẫn thêm câu này (thêm mới, giữ cả câu cũ) — chỉ có khi trùng < 100%
        const btnAddAnyway = card.querySelector('.btn-add-anyway');
        if (btnAddAnyway) {
          btnAddAnyway.addEventListener('click', () => {
            question.duplicateStatus.overwrite = false;
            question.selected = true;
            renderScannedQuestions();
            updateSaveBtnState();
          });
        }

        // Nhấp nút Bỏ chọn câu
        const btnSkip = card.querySelector('.btn-skip');
        if (btnSkip) {
          btnSkip.addEventListener('click', () => {
            question.selected = false;
            question.duplicateStatus.overwrite = false;
            renderScannedQuestions();
            updateSaveBtnState();
          });
        }
      });

      // Checkbox Chọn tất cả
      const selectAllCheck = resultsPanel.querySelector('#select-all-scanned');
      if (selectAllCheck) {
        selectAllCheck.addEventListener('change', (e) => {
          const checked = e.target.checked;
          scannedQuestions.forEach(q => {
            if (checked) {
              // Nếu check Chọn tất cả, chỉ tự động tick các câu không bị trùng lặp
              if (!q.duplicateStatus.isDuplicate) {
                q.selected = true;
              }
            } else {
              q.selected = false;
              q.duplicateStatus.overwrite = false;
            }
          });
          renderScannedQuestions();
          updateSaveBtnState();
        });
      }
    };

    // Cập nhật số lượng hiển thị trên nút lưu
    const updateSaveBtnState = () => {
      const selectedCount = scannedQuestions.filter(q => q.selected).length;
      saveBtn.innerText = `Import các câu đã chọn (${selectedCount})`;
      saveBtn.disabled = selectedCount === 0;
    };

    // Xử lý nút lưu toàn bộ batch
    saveBtn.addEventListener('click', () => {
      const toImport = scannedQuestions.filter(q => q.selected);
      if (toImport.length === 0) return;

      const currentSubjectId = activeState.currentSubjectId;
      
      toImport.forEach(q => {
        const questionData = {
          questionText: q.questionText.trim(),
          codeSnippet: q.codeSnippet.trim(),
          options: q.options.map(o => o.trim()),
          correctIndex: q.correctIndex,
          explanation: q.explanation.trim()
        };

        if (q.duplicateStatus.isDuplicate && q.duplicateStatus.overwrite && q.duplicateStatus.duplicateOfId) {
          // Ghi đè câu hỏi cũ
          store.updateQuestion(currentSubjectId, q.duplicateStatus.duplicateOfId, questionData);
        } else {
          // Thêm câu hỏi mới
          store.addQuestion(currentSubjectId, questionData);
        }
      });

      closeModal();
    });

    // Nếu ảnh được truyền sẵn từ Empty State dropzone
    if (preloadedFile) {
      processFile(preloadedFile);
    }
  };


  // Đăng ký nhận thông báo thay đổi state
  store.subscribe(render);
  render(store.state);
}
