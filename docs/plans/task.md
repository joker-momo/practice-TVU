| Task | Status | Description |
| --- | --- | --- |
| Task 1: Shell & Core Design System Stylesheet | [x] | Create index.html and css/style.css with design tokens |
| Task 2: State Management & LocalStorage Sync | [x] | Create js/state.js for app state CRUD and persistence |
| Task 3: Text Normalization & Similarity Utilities | [x] | Create js/utils.js for normalization and similarity calculation |
| Task 4: UI Components: Sidebar & Subject List | [x] | Create js/components/sidebar.js for subject navigation |
| Task 5: OCR Wrapper & Image Text Parser | [x] | Create js/ocr.js for Tesseract.js integration |
| Task 6: UI Components: Manage View & OCR Import Modal | [x] | Create js/components/editor.js for questions and OCR preview |
| Task 7: UI Components: Quiz & Flashcard Modes | [x] | Create js/components/quiz.js and js/components/flashcard.js |
| Task 8: Main App Controller & Client-Side Routing | [x] | Create js/app.js entry point and layout router |
| Task 9: Brainstorming & Design for Multi-Question Import | [x] | Design OCR parser upgrades and preview list UI |
| Task 10: Upgrade OCR Parser (js/ocr.js) | [x] | Parse multiple questions, support Vietnamese diacritics and exact boundaries |
| Task 11: Upgrade Import UI (js/components/editor.js) | [x] | Render multi-question preview list with inline editors and checkboxes |
| Task 12: Verify Import flow with user screenshots | [x] | Run local validation and verify UI behavior |
| Task 13: Clean up Node.js Server | [x] | Delete server.mjs and remove backend APIs |
| Task 14: Pure Client-Side State Management (js/state.js) | [x] | Fetch questions.json static file, sync LocalStorage and remove saveRemote POST |
| Task 15: Custom JSON Import & UI Backup (js/components/editor.js) | [x] | Add Import/Export JSON buttons, write custom JSON parser and integrate with Preview UI |
| Task 16: Verify Static Web & Custom JSON Import | [x] | Run static HTTP server, import custom JSON questions and verify UI/state correctness |
| Task 17: Refactor Custom JSON Import & Smart matching | [x] | Implement smart normalization and multi-stage correctIndex matching |
| Task 18: CSS Layout & Spacing Adjustments | [ ] | Optimize responsive mobile drawer, margins/gaps, progress bar and options styling |
| Task 19: Layout & Mobile Header Integration | [ ] | Integrate mobile top bar with Hamburger menu and overlay toggles in js/app.js |
| Task 20: Sidebar Close on Subject Selection | [ ] | Automatically close the mobile sidebar drawer when selecting a subject |
| Task 21: Progress Bar Integration in Main Header | [ ] | Calculate and render subject progress bar under header title in js/app.js |
| Task 22: Keyboard Shortcuts for Quiz & Flashcard | [ ] | Add keydown events to js/components/quiz.js and js/components/flashcard.js |
