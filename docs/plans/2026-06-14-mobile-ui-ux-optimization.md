# Mobile UI/UX Optimization Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Optimize the TVU Memorizer mobile interface by implementing a drawer sidebar, a sticky top header bar, compact padding/margins/gaps, a progress bar, and keyboard shortcuts.

**Architecture:** 
1. Modify CSS to hide the sidebar off-screen and add slide-in animations.
2. Update the main coordinator layout in `js/app.js` to render a mobile header bar with a Hamburger toggle.
3. Write clean toggle state handlers in `js/components/sidebar.js` and `js/app.js`.
4. Inject a lightweight progress bar under the subject header in the main panel.
5. Register keyboard shortcut listeners directly inside `js/components/quiz.js` and `js/components/flashcard.js` with proper cleanup to prevent memory leaks.

**Tech Stack:** Native HTML5, CSS3, Vanilla JavaScript, Supabase SDK.

---

### Task 1: CSS Layout & Spacing Adjustments

**Files:**
- Modify: `css/style.css`

**Step 1: Write CSS rules for mobile header, drawer sidebar, backdrop overlay, and compact spacings**

Add the following rules to the bottom of `css/style.css` (or refine existing media queries):
```css
/* Mobile Header Bar */
.mobile-header-bar {
  display: none;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--glass-border);
  padding: 0.5rem 1rem;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 500;
  height: 56px;
  width: 100%;
}

.mobile-brand {
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Sidebar Overlay Backdrop */
.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 10, 0.4);
  backdrop-filter: blur(2px);
  z-index: 900;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.sidebar-overlay.active {
  display: block;
  opacity: 1;
}

/* Subject Progress Bar */
.subject-progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.35rem;
  width: 100%;
}

.subject-progress-bar {
  flex: 1;
  height: 5px;
  background: rgba(10, 10, 10, 0.05);
  border-radius: 3px;
  overflow: hidden;
}

.subject-progress-bar-fill {
  height: 100%;
  background: var(--success, #1a7f37);
  width: 0%;
  border-radius: 3px;
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.subject-progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Responsive Overrides */
@media (max-width: 768px) {
  .mobile-header-bar {
    display: flex;
  }

  .app-container {
    flex-direction: column;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    padding: 1.5rem 1rem;
    border-right: 1px solid var(--glass-border);
    transform: translateX(-100%);
    z-index: 1000;
    box-shadow: 12px 0 36px rgba(10, 10, 10, 0.08);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .main-panel {
    padding: 0.5rem 0.75rem !important;
    gap: 0.75rem !important;
  }

  .panel-header {
    padding-bottom: 0.5rem !important;
    gap: 0.5rem !important;
  }

  .header-title {
    font-size: 1.35rem !important;
  }

  .tab-navigation {
    gap: 0.25rem !important;
  }

  .tab-btn {
    padding: 0.4rem 0.5rem !important;
    font-size: 0.85rem !important;
  }

  .card-frame {
    padding: 1rem !important;
    gap: 0.75rem !important;
  }

  .question-text {
    font-size: 1rem !important;
  }

  .options-grid {
    gap: 0.4rem !important;
  }

  .option-card {
    padding: 0.6rem 0.85rem !important;
    font-size: 0.9rem !important;
    gap: 0.75rem !important;
  }

  .option-marker {
    width: 24px !important;
    height: 24px !important;
    font-size: 0.8rem !important;
  }

  .explanation-panel {
    padding: 0.75rem 1rem !important;
    gap: 0.35rem !important;
  }
}
```

**Step 2: Commit CSS changes**
```bash
git add css/style.css
git commit -m "style: add responsive mobile drawer header, backdrop, progress bar and extreme spacing rules"
```

---

### Task 2: Layout & Mobile Header Integration

**Files:**
- Modify: `js/app.js`

**Step 1: Modify layout shell and header render logic**
- In `js/app.js`, add a mobile header bar and overlay element to `appContainer.innerHTML`.
- Bind click listener for the hamburger menu button and backdrop overlay to toggle `.open` on sidebar and `.active` on overlay.
- Automatically register overlay/drawer closure logic when subjects change.

```javascript
  // 1. Tạo cấu trúc bố cục chính (Layout Shell)
  appContainer.innerHTML = `
    <div class="mobile-header-bar">
      <button class="link-btn" id="sidebar-toggle-btn" style="padding: 0.5rem;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <div class="mobile-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <span>TVU Memorizer</span>
      </div>
      <div style="width: 36px;"></div> <!-- Spacer to center brand -->
    </div>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar-container"></aside>
    <main class="main-panel" id="main-panel-container"></main>
  `;
```

Add the toggling JS logic:
```javascript
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  const overlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("sidebar-container");

  const closeSidebar = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  };

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
  });

  overlay.addEventListener("click", closeSidebar);
```

**Step 2: Commit layout changes**
```bash
git add js/app.js
git commit -m "feat(ui): add mobile header bar, sidebar drawer toggles and overlay backdrop"
```

---

### Task 3: Sidebar Close on Subject Selection

**Files:**
- Modify: `js/components/sidebar.js`

**Step 1: Close sidebar drawer on selection**
- Inside the subject-item click listener in `sidebar.js`, call a helper function or trigger DOM cleanups to close the drawer after switching subjects:
```javascript
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-subject-btn')) return;
        const id = item.getAttribute('data-id');
        store.selectSubject(id);
        
        // Close drawer on mobile
        const overlay = document.getElementById("sidebar-overlay");
        const sidebar = document.getElementById("sidebar-container");
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("active");
      });
```

**Step 2: Commit sidebar changes**
```bash
git add js/components/sidebar.js
git commit -m "feat(ui): automatically close mobile sidebar drawer on subject selection"
```

---

### Task 4: Progress Bar Integration in Main Header

**Files:**
- Modify: `js/app.js`

**Step 1: Calculate and render the progress bar under the subject title**
- Calculate subject progress:
```javascript
    const calculateProgress = (subj) => {
      if (!subj.questions || subj.questions.length === 0) return { percent: 0, text: "0/0" };
      const memorizedCount = subj.questions.filter(q => q.history && q.history.correct > 0).length;
      const total = subj.questions.length;
      return {
        percent: Math.round((memorizedCount / total) * 100),
        text: `${memorizedCount}/${total}`
      };
    };
```
- Append the progress HTML below `<h1 class="header-title">${subject.name}</h1>`:
```javascript
        <div class="header-meta" style="width: 100%;">
          <h1 class="header-title">${subject.name}</h1>
          <span class="header-subtitle">
            Học phần ôn tập • <em>Lặp lại ngắt quãng</em> chống quên
          </span>
          <div class="subject-progress-container">
            <div class="subject-progress-bar">
              <div class="subject-progress-bar-fill" style="width: ${progress.percent}%"></div>
            </div>
            <span class="subject-progress-text">Tiến độ: ${progress.percent}% (${progress.text})</span>
          </div>
        </div>
```

**Step 2: Commit progress bar changes**
```bash
git add js/app.js
git commit -m "feat(ui): add visual subject progress bar under header title"
```

---

### Task 5: Keyboard Shortcuts for Quiz & Flashcard

**Files:**
- Modify: `js/components/quiz.js`
- Modify: `js/components/flashcard.js`

**Step 1: Register keyboard listeners in Quiz**
Inside `initQuiz`:
```javascript
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      
      // Select option: 1/2/3/4 or a/b/c/d
      if (!hasSelected) {
        let index = -1;
        if (key === '1' || key === 'a') index = 0;
        else if (key === '2' || key === 'b') index = 1;
        else if (key === '3' || key === 'c') index = 2;
        else if (key === '4' || key === 'd') index = 3;
        
        if (index >= 0 && index < q.options.length && q.options[index]) {
          const cards = container.querySelectorAll('.option-card');
          if (cards[index]) cards[index].click();
        }
      } else {
        // Next question: Enter or Space
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const nextBtn = container.querySelector('.next-question-btn');
          if (nextBtn && nextBtn.style.display !== 'none') nextBtn.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
```
Ensure that in `destroy()` we clean up this listener:
```javascript
  return {
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    }
  };
```

**Step 2: Register keyboard listeners in Flashcard**
Inside `initFlashcard`:
```javascript
    const handleKeyDown = (e) => {
      if (!isFlipped) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const revealBtn = container.querySelector('.reveal-card-btn');
          if (revealBtn) revealBtn.click();
        }
      } else {
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
```
Clean up in `destroy()`:
```javascript
  return {
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    }
  };
```

**Step 3: Commit shortcut keys**
```bash
git add js/components/quiz.js js/components/flashcard.js
git commit -m "feat(ux): add keyboard shortcuts for quiz options and flashcard flipping/rating"
```
