// js/components/sidebar.js

/**
 * Khởi tạo và render Sidebar quản lý môn học
 * @param {HTMLElement} container - Element chứa sidebar
 * @param {object} store - State store toàn cục
 */
function initSidebar(container, store) {
  const render = (state) => {
    const { subjects, currentSubjectId } = state;
    const isAdmin = !!(window.admin && window.admin.isAdmin());
    const adminMins = isAdmin ? Math.max(1, Math.round(window.admin.remainingMs() / 60000)) : 0;

    // Tính toán SVG progress circle
    const calculateProgress = (subject) => {
      if (!subject.questions || subject.questions.length === 0) return { percent: 0, text: "0/0" };
      const memorizedCount = subject.questions.filter(q => q.history && q.history.correct > 0).length;
      const total = subject.questions.length;
      return {
        percent: Math.round((memorizedCount / total) * 100),
        text: `${memorizedCount}/${total}`
      };
    };

    let html = `
      <div class="sidebar-brand" style="display: flex; align-items: center; gap: 0.65rem; padding: 1rem 0.75rem;">
        <img src="assets/logo.png" alt="Logo" style="width: 32px; height: 32px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
        <span style="font-weight: 800; font-size: 1.15rem; letter-spacing: -0.02em;">TVU <span style="color: var(--accent);">Memorizer</span></span>
      </div>
      
      <div>
        <h3 class="sidebar-title">Danh sách môn học</h3>
        <ul class="subject-list">
    `;

    subjects.forEach(subject => {
      const isActive = subject.id === currentSubjectId;
      const progress = calculateProgress(subject);
      
      // Vẽ vòng tròn SVG tiến độ
      const radius = 12;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (progress.percent / 100) * circumference;

      html += `
        <li class="subject-item ${isActive ? 'active' : ''}" data-id="${subject.id}">
          <div class="subject-info">
            <span class="subject-name" title="${subject.name}">${subject.name}</span>
            <span class="subject-count">${progress.text} câu đã nhớ</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div class="progress-ring-container" title="Tiến độ ghi nhớ: ${progress.percent}%">
              <svg class="progress-ring" width="32" height="32">
                <circle
                  class="progress-ring__circle-bg"
                  stroke="rgba(10, 10, 10, 0.05)"
                  stroke-width="2"
                  fill="transparent"
                  r="${radius}"
                  cx="16"
                  cy="16"
                />
                <circle
                  class="progress-ring__circle"
                  stroke="var(--accent)"
                  stroke-width="2"
                  fill="transparent"
                  r="${radius}"
                  cx="16"
                  cy="16"
                  stroke-dasharray="${circumference} ${circumference}"
                  stroke-dashoffset="${strokeDashoffset}"
                />
              </svg>
            </div>
            ${isAdmin ? `
            <button class="link-btn link-btn-danger delete-subject-btn" data-id="${subject.id}" title="Xóa môn học">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>` : ''}
          </div>
        </li>
      `;
    });

    html += `
        </ul>
      </div>
      
      <div style="margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem;">
        ${isAdmin ? `
        <button class="btn btn-primary add-subject-btn" style="justify-content: center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Thêm môn học
        </button>` : ''}

        <button class="btn admin-toggle-btn" style="justify-content: center; ${isAdmin ? 'background: var(--success, #1a7f37); color: #fff; border-color: transparent;' : 'background: var(--bg-paper); border: 1px solid var(--border-light); color: var(--text-muted);'}">
          ${isAdmin ? `🔓 Admin · còn ${adminMins}p (Thoát)` : '🔒 Chế độ Admin'}
        </button>

        <div style="text-align: center; font-size: 0.75rem; color: var(--text-muted); padding-top: 0.5rem; border-top: 1px solid var(--border-light); margin-top: 0.5rem;">
          Tác giả: <strong>Joker</strong><br/>
          &copy; ${new Date().getFullYear()} TVU Memorizer
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Lắng nghe sự kiện click chọn môn
    container.querySelectorAll('.subject-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Nếu click vào nút xóa thì bỏ qua
        if (e.target.closest('.delete-subject-btn')) return;
        const id = item.getAttribute('data-id');
        store.selectSubject(id);

        // Close drawer on mobile
        const overlay = document.getElementById("sidebar-overlay");
        const sidebar = document.getElementById("sidebar-container");
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("active");
      });
    });

    // Lắng nghe sự kiện xóa môn
    container.querySelectorAll('.delete-subject-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const subject = subjects.find(s => s.id === id);
        if (confirm(`Bạn có chắc chắn muốn xóa môn "${subject.name}"? Toàn bộ câu hỏi sẽ bị mất.`)) {
          store.deleteSubject(id);
        }
      });
    });

    // Lắng nghe sự kiện click thêm môn (chỉ có khi là admin)
    const addBtn = container.querySelector('.add-subject-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => showAddSubjectModal());
    }

    // Nút bật/tắt Chế độ Admin
    container.querySelector('.admin-toggle-btn').addEventListener('click', () => {
      if (window.admin && window.admin.isAdmin()) {
        if (confirm("Thoát Chế độ Admin?")) window.admin.logout();
      } else {
        showAdminModal();
      }
    });
  };

  // Modal nhập password admin
  const showAdminModal = () => {
    const modalHtml = `
      <div class="modal-overlay" id="admin-modal">
        <div class="modal-card" style="max-width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">🔒 Chế độ Admin</h3>
            <button class="link-btn close-modal-btn" style="font-size: 1.5rem;">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="admin-pass">Mật khẩu admin</label>
              <input type="password" id="admin-pass" class="form-control" placeholder="Nhập mật khẩu..." autofocus />
              <p id="admin-err" style="color: var(--danger, #c0392b); font-size: 0.85rem; margin-top: 0.5rem; display: none;"></p>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted);">Quyền admin kéo dài 30 phút, sau đó tự về chế độ chỉ xem.</p>
          </div>
          <div class="modal-footer">
            <button class="btn cancel-btn">Hủy</button>
            <button class="btn btn-primary unlock-btn">Mở khóa</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('admin-modal');
    const input = modal.querySelector('#admin-pass');
    const errEl = modal.querySelector('#admin-err');
    const unlockBtn = modal.querySelector('.unlock-btn');

    const closeModal = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 250);
    };
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

    const submit = async () => {
      const pass = input.value;
      if (!pass) { input.focus(); return; }
      errEl.style.display = 'none';
      unlockBtn.disabled = true;
      unlockBtn.innerText = 'Đang kiểm tra...';
      try {
        const ok = await window.admin.login(pass);
        if (ok) {
          closeModal();
        } else {
          errEl.innerText = 'Sai mật khẩu.';
          errEl.style.display = 'block';
          input.select();
        }
      } catch (e) {
        errEl.innerText = 'Lỗi: ' + (e.message || e);
        errEl.style.display = 'block';
      } finally {
        unlockBtn.disabled = false;
        unlockBtn.innerText = 'Mở khóa';
      }
    };

    unlockBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') closeModal();
    });
  };

  // Hiển thị modal thêm môn học thủ công cực đẹp
  const showAddSubjectModal = () => {
    const modalHtml = `
      <div class="modal-overlay" id="add-subject-modal">
        <div class="modal-card" style="max-width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">Thêm môn học mới</h3>
            <button class="link-btn close-modal-btn" style="font-size: 1.5rem;">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="new-subject-name">Tên môn học</label>
              <input type="text" id="new-subject-name" class="form-control" placeholder="Ví dụ: Cấu trúc dữ liệu, ReactJS..." autofocus />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn cancel-btn">Hủy</button>
            <button class="btn btn-primary save-btn">Thêm mới</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('add-subject-modal');
    
    // Đóng modal
    const closeModal = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 250);
    };

    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    
    // Lưu môn học
    const saveSubject = () => {
      const input = modal.querySelector('#new-subject-name');
      const val = input.value.trim();
      if (val) {
        store.addSubject(val);
        closeModal();
      } else {
        input.focus();
      }
    };

    modal.querySelector('.save-btn').addEventListener('click', saveSubject);
    modal.querySelector('#new-subject-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveSubject();
      if (e.key === 'Escape') closeModal();
    });
  };

  // Đăng ký render với store
  store.subscribe(render);
  // Render lần đầu tiên
  render(store.state);

  // Cập nhật đồng hồ đếm ngược admin mỗi phút
  setInterval(() => {
    if (window.admin && window.admin.isAdmin()) render(store.state);
  }, 60000);
}
