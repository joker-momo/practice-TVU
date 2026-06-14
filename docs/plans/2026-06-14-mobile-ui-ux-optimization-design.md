# Design Document: Mobile UI/UX Optimization

## Goal
Optimize the mobile interface (`< 768px`) of TVU Memorizer to ensure that the entire quiz workspace (question text, code snippet, options, explanation, and navigation buttons) fits within the mobile viewport without scrolling. Ensure the interface remains harmonious, premium, and easy to interact with.

## Proposed Changes

### 1. Mobile Header & Drawer Sidebar
- **Brand new mobile top header (`.mobile-header-bar`):**
  - Stays sticky at the top of the viewport on screens `< 768px`.
  - Displays a Hamburger Menu toggle button on the left and the application name "TVU Memorizer" in the center.
- **Drawer Sidebar (`.sidebar`):**
  - On mobile, the sidebar is hidden off-screen (`transform: translateX(-100%)`) with fixed positioning (`position: fixed; top: 0; left: 0; bottom: 0; width: 280px; z-index: 1000;`).
  - Slide-in transition enabled on class `.open` (`transform: translateX(0)`).
  - Add an overlay backdrop (`.sidebar-overlay`) which closes the sidebar when clicked. Selecting any subject will also close the sidebar drawer.

### 2. Ultra-Compact Spacing (Desktop & Mobile Refinement)
- Keep spacing clean and spacious on desktop, but apply aggressive, highly-harmonious density updates on mobile:
  - **Paddings:**
    - `.main-panel`: `padding: 0.5rem 0.75rem;` on mobile.
    - `.card-frame`: `padding: 1rem;` on mobile.
  - **Gaps:**
    - `.main-panel`: `gap: 0.75rem;`
    - `.card-frame`: `gap: 0.75rem;`
    - `.options-grid`: `gap: 0.4rem;`
  - **Option Cards:**
    - `.option-card`: `padding: 0.6rem 0.85rem; font-size: 0.9rem;`
    - `.option-marker`: `width: 24px; height: 24px; font-size: 0.8rem;`
  - **Typography:**
    - `.question-text`: `font-size: 1rem; line-height: 1.5;`

### 3. Subject Progress Bar
- **Positioning:** Placed inside `.panel-header` right below the title.
- **Design:**
  - A clean, thin progress bar (`height: 4px; background: rgba(10, 10, 10, 0.05); border-radius: 2px; overflow: hidden; margin-top: 0.25rem;`).
  - Fill uses a smooth transition green indicator (`background: var(--success); transition: width 0.35s ease;`).
  - Text badge next to or above the bar: `Tiến độ: XX% (XX/XX câu)`.

## Success Criteria
- The entire quiz fits vertically on a standard smartphone screen (e.g. iPhone SE to iPhone Pro Max) without requiring vertical scrolling to find the "Câu tiếp theo" button.
- The Drawer menu slides in/out smoothly without layout jank.
- Progress bar updates dynamically as the user studies.
