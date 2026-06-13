// js/components/flashcard.js

/**
 * Khởi tạo và render chế độ thẻ ghi nhớ (Flashcard)
 * @param {HTMLElement} container - Element chứa panel chính
 * @param {object} store - State store toàn cục
 */
function initFlashcard(container, store) {
  let currentQuestion = null;
  let isFlipped = false;

  const escapeHtml = (text) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Thuật toán chọn câu hỏi thông minh
  const selectSmartQuestion = (questions) => {
    if (!questions || questions.length === 0) return null;
    
    const sorted = [...questions].sort((a, b) => {
      const aBook = a.isBookmarked ? 1 : 0;
      const bBook = b.isBookmarked ? 1 : 0;
      if (aBook !== bBook) return bBook - aBook;

      const aAttempts = a.history?.attempts || 0;
      const bAttempts = b.history?.attempts || 0;

      if (aAttempts === 0 && bAttempts > 0) return -1;
      if (aAttempts > 0 && bAttempts === 0) return 1;

      const aRate = aAttempts > 0 ? (a.history.correct / aAttempts) : 0;
      const bRate = bAttempts > 0 ? (b.history.correct / bAttempts) : 0;
      if (aRate !== bRate) return aRate - bRate;

      return aAttempts - bAttempts;
    });

    return sorted[0];
  };

  const render = (state) => {
    const { subjects, currentSubjectId } = state;
    const subject = subjects.find(s => s.id === currentSubjectId);

    if (!subject) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
          <p>Vui lòng chọn hoặc thêm một môn học ở thanh bên để bắt đầu ôn tập thẻ nhớ.</p>
        </div>
      `;
      return;
    }

    const questions = subject.questions || [];

    if (questions.length === 0) {
      container.innerHTML = `
        <div class="card-frame" style="text-align: center; max-width: 600px; margin: 2rem auto;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">Không có câu hỏi thẻ nhớ</h3>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem;">
            Môn học "${subject.name}" hiện chưa có câu hỏi nào.
          </p>
          <button class="btn btn-primary go-to-editor-btn" style="margin: 0 auto;">
            Đi tới Quản lý câu hỏi
          </button>
        </div>
      `;
      container.querySelector('.go-to-editor-btn').addEventListener('click', () => {
        store.setView('manage');
      });
      return;
    }

    // Chọn câu hỏi mới nếu chưa chọn
    if (!currentQuestion || !questions.some(q => q.id === currentQuestion.id)) {
      currentQuestion = selectSmartQuestion(questions);
      isFlipped = false;
    } else {
      currentQuestion = questions.find(q => q.id === currentQuestion.id);
    }

    const q = currentQuestion;
    const alphabet = ["A", "B", "C", "D"];
    const attempts = q.history?.attempts || 0;
    const correct = q.history?.correct || 0;

    let html = `
      <div class="question-card-container" style="max-width: 700px;">
        <div class="flashcard-frame">
          <div class="flashcard-inner ${isFlipped ? 'flipped' : ''}" id="card-flipper">
            
            <!-- MẶT TRƯỚC (CÂU HỎI) -->
            <div class="flashcard-face flashcard-front">
              <div style="width: 100%; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em;">
                Thẻ nhớ • Lịch sử: ${correct}/${attempts} đúng
              </div>
              <div class="question-text" style="width: 100%; text-align: left;">${q.questionText}</div>
              
              ${q.codeSnippet ? `
                <div class="code-container" style="width: 100%; text-align: left;">
                  <pre><code class="language-javascript">${escapeHtml(q.codeSnippet)}</code></pre>
                </div>
              ` : ''}
              
              <button class="btn btn-primary reveal-card-btn" style="margin-top: 1.5rem; width: 100%;">
                Xem đáp án
              </button>
            </div>
            
            <!-- MẶT SAU (ĐÁP ÁN & GIẢI THÍCH) -->
            <div class="flashcard-face flashcard-back">
              <div style="width: 100%; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: var(--success); text-transform: uppercase; letter-spacing: 0.08em;">
                Kết quả giải thích
              </div>
              
              <div style="width: 100%; text-align: left; margin: 1rem 0;">
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--success); margin-bottom: 1rem;">
                  Đáp án đúng: ${alphabet[q.correctIndex]}. ${q.options[q.correctIndex] || ''}
                </div>
                <div class="explanation-panel" style="animation: none;">
                  <span class="explanation-title">Giải thích</span>
                  <div class="explanation-content" style="white-space: pre-line;">
                    ${q.explanation || 'Không có giải thích chi tiết cho câu hỏi này.'}
                  </div>
                </div>
              </div>

              <div style="width: 100%; text-align: center; margin-top: auto;">
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem; font-weight: 600;">
                  Đánh giá mức độ nhớ của bạn để thuật toán tối ưu lượt hỏi sau:
                </p>
                <div class="flashcard-actions">
                  <button class="btn rate-btn forget" data-rate="forget">Quên sạch</button>
                  <button class="btn rate-btn medium" data-rate="medium">Mơ hồ</button>
                  <button class="btn rate-btn remember" data-rate="remember">Nhớ rõ</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Kích hoạt tô màu code JS nếu có
    if (q.codeSnippet) {
      Prism.highlightAll();
    }

    // Sự kiện Click lật thẻ
    container.querySelector('.reveal-card-btn').addEventListener('click', () => {
      isFlipped = true;
      container.querySelector('#card-flipper').classList.add('flipped');
    });

    // Sự kiện Click tự đánh giá mức độ nhớ
    container.querySelectorAll('.rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = btn.getAttribute('data-rate');
        const isCorrect = rate === 'remember'; // Chỉ tính là đúng nếu nhớ rõ

        // Lưu tiến trình lịch sử học tập
        store.updateHistory(currentSubjectId, q.id, isCorrect);

        // Chuyển câu hỏi mới
        currentQuestion = selectSmartQuestion(questions);
        isFlipped = false;
        render(store.state);
      });
    });
  };

  // Đăng ký store
  store.subscribe(render);
  render(store.state);
}
