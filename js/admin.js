// js/admin.js
// Phiên admin: nhập password -> verify server-side -> quyền admin 30 phút -> tự về read-only.

const ADMIN_STORAGE_KEY = "tvu_admin";
const ADMIN_TTL_MS = 30 * 60 * 1000; // 30 phút

const admin = {
  _password: null,
  _expiry: 0,
  _timer: null,
  onChange: null, // callback() khi trạng thái admin đổi (để re-render UI)

  init() {
    try {
      const s = JSON.parse(sessionStorage.getItem(ADMIN_STORAGE_KEY));
      if (s && s.password && s.expiry > Date.now()) {
        this._password = s.password;
        this._expiry = s.expiry;
        this._arm();
      } else {
        sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    } catch (e) {
      /* bỏ qua */
    }
  },

  isAdmin() {
    return !!this._password && this._expiry > Date.now();
  },

  getPassword() {
    return this.isAdmin() ? this._password : null;
  },

  remainingMs() {
    return this.isAdmin() ? this._expiry - Date.now() : 0;
  },

  // Nhập password -> verify qua RPC. true nếu đúng.
  async login(password) {
    if (!window.cloud || !window.cloud.ready) {
      throw new Error("Chưa kết nối Supabase");
    }
    const ok = await window.cloud.verifyAdmin(password);
    if (!ok) return false;

    this._password = password;
    this._expiry = Date.now() + ADMIN_TTL_MS;
    sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ password, expiry: this._expiry }));
    this._arm();
    this._notify();
    return true;
  },

  logout() {
    this._password = null;
    this._expiry = 0;
    clearTimeout(this._timer);
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    this._notify();
  },

  // Hẹn tự đăng xuất khi hết hạn
  _arm() {
    clearTimeout(this._timer);
    const ms = this._expiry - Date.now();
    if (ms > 0) {
      this._timer = setTimeout(() => this.logout(), ms);
    }
  },

  _notify() {
    if (typeof this.onChange === "function") {
      try { this.onChange(this.isAdmin()); } catch (e) { console.error(e); }
    }
  }
};

admin.init();
window.admin = admin;
