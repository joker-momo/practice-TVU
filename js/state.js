// js/state.js

const PROGRESS_KEY = "tvu_progress"; // tiến độ cá nhân theo questionId (chỉ lưu cục bộ, không sync)
const UI_KEY = "tvu_ui";             // tùy chọn giao diện (view, môn đang chọn)

// Seed mặc định khi cloud rỗng / chưa cấu hình Supabase (lấy từ questions.js nếu có)
const initialSeedData = (typeof window !== "undefined" && window.QUESTIONS_DATA && Array.isArray(window.QUESTIONS_DATA.subjects))
  ? window.QUESTIONS_DATA.subjects
  : [];

const blankHistory = () => ({ attempts: 0, correct: 0, lastAttempt: null });

class StateManager {
  constructor() {
    this.listeners = [];
    this.progress = this.loadProgress();
    const ui = this.loadUI();

    this.state = {
      subjects: [],
      currentSubjectId: ui.currentSubjectId || null,
      currentView: ui.currentView || "quiz", // "quiz" | "flashcard" | "manage"
      loading: true,
      cloudError: null
    };

    this._refreshTimer = null;

    // Trạng thái admin đổi (login/logout/hết hạn) -> re-render để ẩn/hiện nút sửa
    if (window.admin) {
      window.admin.onChange = () => this.notify();
    }

    this.initializeRemote();
  }

  // Lấy password admin cho thao tác ghi; null + cảnh báo nếu không phải admin
  requireAdmin() {
    if (window.admin && window.admin.isAdmin()) {
      return window.admin.getPassword();
    }
    alert("Bạn cần bật Chế độ Admin để thêm/sửa/xóa.");
    return null;
  }

  // --- LƯU TRỮ CỤC BỘ ---

  loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.error("Lỗi ghi tiến độ", e);
    }
  }

  loadUI() {
    try {
      return JSON.parse(localStorage.getItem(UI_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  saveUI() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({
        currentView: this.state.currentView,
        currentSubjectId: this.state.currentSubjectId
      }));
    } catch (e) {
      console.error("Lỗi ghi tùy chọn giao diện", e);
    }
  }

  // Gắn tiến độ cá nhân (history + bookmark) từ progress map vào từng câu hỏi
  applyProgress(subjects) {
    return (subjects || []).map(s => ({
      ...s,
      questions: (s.questions || []).map(q => {
        const p = this.progress[q.id];
        return {
          ...q,
          isBookmarked: p ? !!p.isBookmarked : false,
          history: p
            ? { attempts: p.attempts || 0, correct: p.correct || 0, lastAttempt: p.lastAttempt || null }
            : blankHistory()
        };
      })
    }));
  }

  // --- KHỞI TẠO DỮ LIỆU TỪ CLOUD ---

  async initializeRemote() {
    if (!window.cloud || !window.cloud.ready) {
      // Chưa cấu hình Supabase → dùng seed cục bộ để app vẫn chạy
      console.warn("Supabase chưa cấu hình (js/supabase.js). Đang chạy bằng dữ liệu seed cục bộ.");
      this.state.subjects = this.applyProgress(initialSeedData);
      this.ensureCurrentSubject();
      this.state.loading = false;
      this.notify();
      return;
    }

    try {
      let subjects = await window.cloud.loadAll();

      // Chỉ seed khi bảng CHƯA TỪNG có dữ liệu (kể cả row đã ẩn) VÀ đang là admin.
      // Tránh "hồi sinh" các môn đã bị xóa: rỗng-do-đã-xóa khác rỗng-do-chưa-seed.
      if (subjects.length === 0 && initialSeedData.length > 0 && window.admin && window.admin.isAdmin()) {
        const populated = await window.cloud.hasAnySubject();
        if (!populated) {
          await this.seedCloud(initialSeedData, window.admin.getPassword());
          subjects = await window.cloud.loadAll();
        }
      }

      this.state.subjects = this.applyProgress(subjects);
      this.ensureCurrentSubject();
      this.state.loading = false;
      this.state.cloudError = null;
      this.notify();

      // Realtime: ai đó sửa → làm mới (debounce tránh dồn dập)
      window.cloud.subscribe(() => this.scheduleRefresh());
    } catch (e) {
      console.error("Lỗi kết nối Supabase, dùng seed cục bộ:", e);
      this.state.cloudError = e.message || String(e);
      this.state.subjects = this.applyProgress(initialSeedData);
      this.ensureCurrentSubject();
      this.state.loading = false;
      this.notify();
    }
  }

  async seedCloud(subjects, password) {
    for (const s of subjects) {
      await window.cloud.upsertSubject({ id: s.id, name: s.name }, password);
      for (const q of (s.questions || [])) {
        await window.cloud.upsertQuestion(s.id, q, password);
      }
    }
  }

  scheduleRefresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.refreshFromCloud(), 400);
  }

  async refreshFromCloud() {
    if (!window.cloud || !window.cloud.ready) return;
    try {
      const subjects = await window.cloud.loadAll();
      this.state.subjects = this.applyProgress(subjects);
      this.ensureCurrentSubject();
      this.notify();
    } catch (e) {
      console.error("Lỗi làm mới từ Supabase", e);
    }
  }

  ensureCurrentSubject() {
    if (!this.state.currentSubjectId || !this.state.subjects.some(s => s.id === this.state.currentSubjectId)) {
      this.state.currentSubjectId = this.state.subjects.length > 0 ? this.state.subjects[0].id : null;
    }
  }

  // Báo lỗi ghi cloud (không chặn UI, đã cập nhật lạc quan cục bộ)
  handleWriteError(e) {
    console.error("Lỗi ghi Supabase:", e);
  }

  // --- ĐĂNG KÝ / THÔNG BÁO ---

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  notify() {
    this.listeners.forEach(fn => {
      try {
        fn(this.state);
      } catch (e) {
        console.error("Lỗi thực thi subscriber", e);
      }
    });
  }

  // --- HELPER ---

  findSubject(subjectId) {
    return this.state.subjects.find(s => s.id === subjectId);
  }

  findQuestion(subjectId, questionId) {
    const s = this.findSubject(subjectId);
    return s ? (s.questions || []).find(q => q.id === questionId) : null;
  }

  // --- ACTIONS GIAO DIỆN (chỉ cục bộ) ---

  setView(view) {
    if (this.state.currentView !== view) {
      this.state.currentView = view;
      this.saveUI();
      this.notify();
    }
  }

  selectSubject(subjectId) {
    if (this.state.currentSubjectId !== subjectId) {
      this.state.currentSubjectId = subjectId;
      this.saveUI();
      this.notify();
    }
  }

  // --- ACTIONS KHO CÂU HỎI (cập nhật lạc quan cục bộ + ghi cloud) ---

  addSubject(name) {
    if (!name || !name.trim()) return null;
    const password = this.requireAdmin();
    if (!password) return null;

    const newSubject = { id: "subj-" + Date.now(), name: name.trim(), questions: [] };
    this.state.subjects.push(newSubject);
    this.state.currentSubjectId = newSubject.id;
    this.saveUI();
    this.notify();

    window.cloud.upsertSubject(newSubject, password).catch(e => this.handleWriteError(e));
    return newSubject;
  }

  deleteSubject(subjectId) {
    const password = this.requireAdmin();
    if (!password) return;

    this.state.subjects = this.state.subjects.filter(s => s.id !== subjectId);
    if (this.state.currentSubjectId === subjectId) {
      this.state.currentSubjectId = this.state.subjects.length > 0 ? this.state.subjects[0].id : null;
      this.saveUI();
    }
    this.notify();

    window.cloud.softDeleteSubject(subjectId, password).catch(e => this.handleWriteError(e));
  }

  addQuestion(subjectId, questionData) {
    const subject = this.findSubject(subjectId);
    if (!subject) return null;
    const password = this.requireAdmin();
    if (!password) return null;

    const newQuestion = {
      id: "q-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      questionText: questionData.questionText || "",
      codeSnippet: questionData.codeSnippet || "",
      options: questionData.options || ["", "", "", ""],
      correctIndex: parseInt(questionData.correctIndex) || 0,
      explanation: questionData.explanation || "",
      isBookmarked: false,
      history: blankHistory()
    };

    subject.questions.push(newQuestion);
    this.notify();

    window.cloud.upsertQuestion(subjectId, newQuestion, password).catch(e => this.handleWriteError(e));
    return newQuestion;
  }

  updateQuestion(subjectId, questionId, questionData) {
    const question = this.findQuestion(subjectId, questionId);
    if (!question) return false;
    const password = this.requireAdmin();
    if (!password) return false;

    question.questionText = questionData.questionText || "";
    question.codeSnippet = questionData.codeSnippet || "";
    question.options = questionData.options || ["", "", "", ""];
    question.correctIndex = parseInt(questionData.correctIndex) || 0;
    question.explanation = questionData.explanation || "";
    this.notify();

    window.cloud.upsertQuestion(subjectId, question, password).catch(e => this.handleWriteError(e));
    return true;
  }

  deleteQuestion(subjectId, questionId) {
    const subject = this.findSubject(subjectId);
    if (!subject) return false;
    const password = this.requireAdmin();
    if (!password) return false;

    subject.questions = subject.questions.filter(q => q.id !== questionId);
    this.notify();

    window.cloud.softDeleteQuestion(questionId, password).catch(e => this.handleWriteError(e));
    return true;
  }

  // --- ACTIONS TIẾN ĐỘ CÁ NHÂN (chỉ localStorage) ---

  toggleBookmark(subjectId, questionId) {
    const question = this.findQuestion(subjectId, questionId);
    if (!question) return false;

    const p = this.progress[questionId] || { attempts: 0, correct: 0, lastAttempt: null, isBookmarked: false };
    p.isBookmarked = !p.isBookmarked;
    this.progress[questionId] = p;
    this.saveProgress();

    question.isBookmarked = p.isBookmarked;
    this.notify();
    return true;
  }

  updateHistory(subjectId, questionId, isCorrect) {
    const question = this.findQuestion(subjectId, questionId);
    if (!question) return false;

    const p = this.progress[questionId] || { attempts: 0, correct: 0, lastAttempt: null, isBookmarked: false };
    p.attempts += 1;
    if (isCorrect) p.correct += 1;
    p.lastAttempt = new Date().toISOString();
    this.progress[questionId] = p;
    this.saveProgress();

    question.history = { attempts: p.attempts, correct: p.correct, lastAttempt: p.lastAttempt };
    this.notify();
    return true;
  }
}

const store = new StateManager();
window.store = store;
