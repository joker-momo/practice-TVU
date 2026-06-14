// js/components/flashcard.js

/**
 * Khởi tạo và render chế độ thẻ ghi nhớ (Flashcard)
 * @param {HTMLElement} container - Element chứa panel chính
 * @param {object} store - State store toàn cục
 */
function initFlashcard(container, store) {
  let currentIndex = 0;   // vị trí thẻ hiện tại trong danh sách câu hỏi
  let isFlipped = false;
  let lastSubjectId = null;

  const escapeHtml = (text) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

    // Reset về thẻ đầu khi đổi môn học
    if (lastSubjectId !== currentSubjectId) {
      lastSubjectId = currentSubjectId;
      currentIndex = 0;
      isFlipped = false;
    }
    // Giữ index trong khoảng hợp lệ (phòng khi danh sách thay đổi qua realtime)
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex > questions.length - 1) currentIndex = questions.length - 1;

    const q = questions[currentIndex];
    const total = questions.length;
    const alphabet = ["A", "B", "C", "D"];
    const attempts = q.history?.attempts || 0;
    const correct = q.history?.correct || 0;

    let html = `
      <div class="question-card-container" style="max-width: 700px;">
        <div class="flashcard-frame" style="cursor: pointer;" title="Nhấn vào thẻ để lật">
          <div class="flashcard-inner ${isFlipped ? 'flipped' : ''}" id="card-flipper">

            <!-- MẶT TRƯỚC (CÂU HỎI) -->
            <div class="flashcard-face flashcard-front">
              <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em;">
                <span>Thẻ ${currentIndex + 1}/${total}</span>
                <span>Lịch sử: ${correct}/${attempts} đúng</span>
              </div>
              <div class="question-text" style="width: 100%; text-align: left;">${q.questionText}</div>

              ${q.codeSnippet ? `
                <div class="code-container" style="width: 100%; text-align: left;">
                  <pre><code class="language-javascript">${escapeHtml(q.codeSnippet)}</code></pre>
                </div>
              ` : ''}

              <div class="flashcard-hint" style="margin-top: auto; padding-top: 1.25rem; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-size: 1.1rem;">👆</span> Nhấn vào thẻ để xem đáp án
              </div>
            </div>

            <!-- MẶT SAU (ĐÁP ÁN & GIẢI THÍCH) -->
            <div class="flashcard-face flashcard-back">
              <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; font-size: 0.8rem; font-weight: 700; color: var(--success); text-transform: uppercase; letter-spacing: 0.08em;">
                <span>Đáp án &amp; Giải thích</span>
                <span style="color: var(--text-muted); text-transform: none; font-weight: 600;">👆 Nhấn để xem câu hỏi</span>
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

              <div class="flashcard-rate-zone" style="width: 100%; text-align: center; margin-top: auto;">
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

        <!-- Điều hướng qua lại giữa các thẻ -->
        <div class="flashcard-nav" style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.25rem;">
          <button class="btn nav-prev-btn" ${currentIndex === 0 ? 'disabled' : ''} style="min-width: 110px; justify-content: center;">◀ Trước</button>
          <span style="font-weight: 700; color: var(--text-muted); min-width: 64px; text-align: center;">${currentIndex + 1} / ${total}</span>
          <button class="btn nav-next-btn" ${currentIndex >= total - 1 ? 'disabled' : ''} style="min-width: 110px; justify-content: center;">Sau ▶</button>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Kích hoạt tô màu code JS nếu có
    if (q.codeSnippet) {
      Prism.highlightAll();
    }

    // Click vào thẻ để lật qua lại (câu hỏi ⇄ đáp án)
    const flipper = container.querySelector('#card-flipper');
    container.querySelector('.flashcard-frame').addEventListener('click', () => {
      isFlipped = !isFlipped;
      flipper.classList.toggle('flipped', isFlipped);
    });

    // Vùng nút đánh giá: không lật thẻ khi bấm
    const rateZone = container.querySelector('.flashcard-rate-zone');
    if (rateZone) rateZone.addEventListener('click', (e) => e.stopPropagation());

    // Điều hướng Trước / Sau
    const goTo = (idx) => {
      currentIndex = idx;
      isFlipped = false;
      render(store.state);
    };
    const prevBtn = container.querySelector('.nav-prev-btn');
    const nextBtn = container.querySelector('.nav-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentIndex > 0) goTo(currentIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (currentIndex < total - 1) goTo(currentIndex + 1); });

    // Sự kiện Click tự đánh giá mức độ nhớ
    container.querySelectorAll('.rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = btn.getAttribute('data-rate');
        const isCorrect = rate === 'remember'; // Chỉ tính là đúng nếu nhớ rõ

        // Lưu tiến trình lịch sử học tập
        store.updateHistory(currentSubjectId, q.id, isCorrect);

        // Sang thẻ kế tiếp nếu còn, không thì giữ thẻ cuối
        if (currentIndex < total - 1) {
          currentIndex += 1;
        }
        isFlipped = false;
        render(store.state);
      });
    });
  };

  const handleKeyDown = (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
      return;
    }

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const frame = container.querySelector('.flashcard-frame');
      if (frame) frame.click();
      return;
    }

    if (e.key === 'ArrowLeft') {
      const prevBtn = container.querySelector('.nav-prev-btn');
      if (prevBtn && !prevBtn.disabled) prevBtn.click();
      return;
    } else if (e.key === 'ArrowRight') {
      const nextBtn = container.querySelector('.nav-next-btn');
      if (nextBtn && !nextBtn.disabled) nextBtn.click();
      return;
    }

    if (isFlipped) {
      let rate = null;
      if (e.key === '1') rate = 'forget';
      else if (e.key === '2') rate = 'medium';
      else if (e.key === '3') rate = 'remember';
      
      if (rate) {
        const btn = container.querySelector(`.rate-btn[data-rate="${rate}"]`);
        if (btn) btn.click();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  // Đăng ký store
  const unsubscribe = store.subscribe(render);
  render(store.state);

  return {
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    }
  };
}
