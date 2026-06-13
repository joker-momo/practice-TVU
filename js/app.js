// js/app.js
/**
 * TVU Memorizer App Coordinator
 */
document.addEventListener("DOMContentLoaded", () => {
  const appContainer = document.getElementById("app");

  // 1. Tạo cấu trúc bố cục chính (Layout Shell)
  appContainer.innerHTML = `
    <aside class="sidebar" id="sidebar-container"></aside>
    <main class="main-panel" id="main-panel-container"></main>
  `;

  const sidebarContainer = document.getElementById("sidebar-container");
  const mainPanelContainer = document.getElementById("main-panel-container");

  // Khởi tạo Sidebar trước (tự động đăng ký subscribe và render)
  initSidebar(sidebarContainer, store);

  let activeView = null;
  let activeSubjectId = null;
  let activeViewInstance = null;

  // 2. Hàm lắng nghe thay đổi State để render khu vực Main Panel chính
  const renderMainPanel = (state) => {
    const { currentView, currentSubjectId, subjects } = state;
    const subject = subjects.find(s => s.id === currentSubjectId);

    // Tránh render lại cấu trúc sườn panel nếu view và môn học không thay đổi
    if (activeView === currentView && activeSubjectId === currentSubjectId) {
      return; 
    }

    // Dọn dẹp view cũ trước khi khởi tạo view mới
    if (activeViewInstance && typeof activeViewInstance.destroy === 'function') {
      activeViewInstance.destroy();
      activeViewInstance = null;
    }

    activeView = currentView;
    activeSubjectId = currentSubjectId;

    if (!subject) {
      mainPanelContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
          <div style="text-align: center;">
            <p style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">Chào mừng bạn đến với TVU Memorizer</p>
            <p>Vui lòng tạo hoặc chọn một môn học ở thanh bên để bắt đầu ôn tập.</p>
          </div>
        </div>
      `;
      return;
    }

    // Thiết kế Header và thanh chọn chế độ ôn tập
    mainPanelContainer.innerHTML = `
      <div class="panel-header">
        <div class="header-meta">
          <h1 class="header-title">${subject.name}</h1>
          <span class="header-subtitle">
            Học phần ôn tập • <em>Lặp lại ngắt quãng</em> chống quên
          </span>
        </div>
        
        <nav class="tab-navigation">
          <button class="tab-btn ${currentView === 'quiz' ? 'active' : ''}" data-view="quiz">Luyện tập</button>
          <button class="tab-btn ${currentView === 'flashcard' ? 'active' : ''}" data-view="flashcard">Thẻ nhớ</button>
          <button class="tab-btn ${currentView === 'manage' ? 'active' : ''}" data-view="manage">Quản lý</button>
        </nav>
      </div>
      
      <!-- Container động chứa nội dung tương ứng của view con -->
      <div id="view-content-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0;"></div>
    `;

    const viewContentContainer = document.getElementById("view-content-container");

    // Khởi tạo và kết nối các Sub-Component con vào container động
    if (currentView === "quiz") {
      activeViewInstance = initQuiz(viewContentContainer, store);
    } else if (currentView === "flashcard") {
      activeViewInstance = initFlashcard(viewContentContainer, store);
    } else if (currentView === "manage") {
      activeViewInstance = initEditor(viewContentContainer, store);
    }

    // Sự kiện click chuyển View tab
    mainPanelContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        store.setView(view);
      });
    });
  };

  // Đăng ký lắng nghe biến đổi State của store cho phần Main Panel
  store.subscribe(renderMainPanel);
  // Thực hiện render main panel lần đầu
  renderMainPanel(store.state);
});
