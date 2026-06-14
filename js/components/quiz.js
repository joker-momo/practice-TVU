// js/components/quiz.js

/**
 * Khởi tạo và render chế độ luyện tập trắc nghiệm (Quiz)
 * @param {HTMLElement} container - Element chứa panel chính
 * @param {object} store - State store toàn cục
 */
function initQuiz(container, store) {
  let currentQuestion = null;
  let hasSelected = false;

  // Tiện ích chống XSS khi chèn code
  const escapeHtml = (text) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Thuật toán chọn câu hỏi thông minh (Ưu tiên câu đánh dấu, câu chưa làm hoặc hay làm sai)
  const selectSmartQuestion = (questions) => {
    if (!questions || questions.length === 0) return null;
    
    // Tạo bản sao để sắp xếp
    const sorted = [...questions].sort((a, b) => {
      // 1. Ưu tiên các câu được đánh dấu sao (bookmark)
      const aBook = a.isBookmarked ? 1 : 0;
      const bBook = b.isBookmarked ? 1 : 0;
      if (aBook !== bBook) return bBook - aBook; // giảm dần (1 trước, 0 sau)

      const aAttempts = a.history?.attempts || 0;
      const bAttempts = b.history?.attempts || 0;

      // 2. Ưu tiên câu chưa bao giờ làm
      if (aAttempts === 0 && bAttempts > 0) return -1;
      if (aAttempts > 0 && bAttempts === 0) return 1;

      // 3. Ưu tiên câu có tỉ lệ làm đúng thấp nhất
      const aRate = aAttempts > 0 ? (a.history.correct / aAttempts) : 0;
      const bRate = bAttempts > 0 ? (b.history.correct / bAttempts) : 0;
      if (aRate !== bRate) return aRate - bRate; // tăng dần (tỉ lệ thấp hơn lên trước)

      // 4. Nếu giống nhau hết, chọn câu ít được làm nhất
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
          <p>Vui lòng chọn hoặc thêm một môn học ở thanh bên để bắt đầu luyện tập.</p>
        </div>
      `;
      return;
    }

    const questions = subject.questions || [];

    if (questions.length === 0) {
      container.innerHTML = `
        <div class="card-frame" style="text-align: center; max-width: 600px; margin: 2rem auto;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">Không có câu hỏi luyện tập</h3>
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

    // Nếu chưa chọn câu hỏi, hoặc môn học thay đổi, chọn câu hỏi mới
    if (!currentQuestion || !questions.some(q => q.id === currentQuestion.id)) {
      currentQuestion = selectSmartQuestion(questions);
      hasSelected = false;
    } else {
      // Đồng bộ câu hỏi hiện tại với dữ liệu mới nhất trong store (để cập nhật trạng thái bookmark)
      currentQuestion = questions.find(q => q.id === currentQuestion.id);
    }

    const q = currentQuestion;
    const starIcon = q.isBookmarked ? "★" : "☆";
    
    // Đếm số câu hỏi trong môn
    const attempts = q.history?.attempts || 0;
    const correct = q.history?.correct || 0;
    const successRate = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

    let html = `
      <div class="question-card-container">
        <div class="card-frame">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 0.5rem;">
              ${q.isBookmarked ? '<span style="color: var(--accent);">[Đã đánh dấu sao]</span>' : ''}
              Lịch sử: ${correct}/${attempts} đúng (${successRate}%)
            </span>
            <button class="link-btn toggle-bookmark-btn" style="font-size: 1.25rem; color: ${q.isBookmarked ? 'var(--accent)' : 'var(--text-muted)'}" title="Đánh dấu câu hỏi này">
              ${starIcon}
            </button>
          </div>

          <div class="question-text">${q.questionText}</div>

          ${q.codeSnippet ? `
            <div class="code-container">
              <pre><code class="language-javascript">${escapeHtml(q.codeSnippet)}</code></pre>
            </div>
          ` : ''}

          <div class="options-grid">
      `;

      // Render 4 đáp án
      const alphabet = ["A", "B", "C", "D"];
      q.options.forEach((opt, idx) => {
        if (!opt) return; // Nếu đáp án trống thì không hiển thị
        
        let cardClass = "";
        if (hasSelected) {
          cardClass = "disabled";
          if (idx === q.correctIndex) {
            cardClass += " correct";
          } else if (idx === q.selectedIndex) {
            cardClass += " incorrect";
          }
        }

        html += `
          <button class="option-card ${cardClass}" data-idx="${idx}" ${hasSelected ? 'disabled' : ''}>
            <span class="option-marker">${alphabet[idx]}</span>
            <span>${opt}</span>
          </button>
        `;
      });

      html += `
          </div>

          <!-- Panel giải thích hiển thị sau khi chọn -->
          <div class="explanation-panel" id="explanation-box" style="display: ${hasSelected ? 'flex' : 'none'};">
            <span class="explanation-title">Giải thích đáp án</span>
            <div class="explanation-content" style="white-space: pre-line;">
              <strong>Đáp án đúng: ${alphabet[q.correctIndex]}. ${q.options[q.correctIndex] || ''}</strong><br/>
              ${q.explanation || 'Không có giải thích chi tiết cho câu hỏi này.'}
            </div>
          </div>

          <!-- Nút điều hướng câu tiếp theo -->
          <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
            <button class="btn btn-primary next-question-btn" style="display: ${hasSelected ? 'inline-flex' : 'none'};">
              Câu tiếp theo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Kích hoạt tô màu code JS nếu có
    if (q.codeSnippet) {
      Prism.highlightAll();
    }

    // Sự kiện Click chọn đáp án
    container.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        if (hasSelected) return;

        const idx = parseInt(card.getAttribute('data-idx'));
        q.selectedIndex = idx;
        hasSelected = true;

        const isCorrect = idx === q.correctIndex;

        // Cập nhật trạng thái hiển thị của các nút đáp án ngay lập tức
        container.querySelectorAll('.option-card').forEach((c, cIdx) => {
          c.disabled = true;
          c.classList.add('disabled');
          if (cIdx === q.correctIndex) {
            c.classList.add('correct');
          } else if (cIdx === idx) {
            c.classList.add('incorrect');
          }
        });

        // Hiển thị phần giải thích và nút Next
        container.querySelector('#explanation-box').style.display = 'flex';
        container.querySelector('.next-question-btn').style.display = 'inline-flex';

        // Lưu lịch sử ôn tập vào state
        store.updateHistory(currentSubjectId, q.id, isCorrect);
      });
    });

    // Sự kiện Bookmark sao
    container.querySelector('.toggle-bookmark-btn').addEventListener('click', () => {
      store.toggleBookmark(currentSubjectId, q.id);
    });

    // Sự kiện câu hỏi tiếp theo
    container.querySelector('.next-question-btn').addEventListener('click', () => {
      currentQuestion = selectSmartQuestion(questions);
      hasSelected = false;
      render(store.state);
    });
  };

  // Đăng ký store
  const unsubscribe = store.subscribe(render);
  render(store.state);

  return {
    destroy() {
      unsubscribe();
    }
  };
}
