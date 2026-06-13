// js/supabase.js
// Kết nối Supabase cho kho câu hỏi dùng chung (ai cũng đọc/sửa, xóa = ẩn).
// ĐIỀN 2 GIÁ TRỊ DƯỚI ĐÂY: Supabase Console → Project Settings → API.

const SUPABASE_URL = "https://hekxlchaazrqvqzwgsio.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iRrFKvgSSQcfWKNUzBS9cg_eKsLrDx5";

// Chỉ bật cloud khi đã cấu hình thật và thư viện supabase-js đã nạp.
const SUPABASE_READY =
  typeof window !== "undefined" &&
  !!window.supabase &&
  typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("YOUR-PROJECT") === -1 &&
  typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.indexOf("YOUR-ANON") === -1;

const sb = SUPABASE_READY ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// --- Ánh xạ giữa hàng DB (snake_case) và câu hỏi trong app (camelCase) ---
function rowToQuestion(r) {
  return {
    id: r.id,
    questionText: r.question_text || "",
    codeSnippet: r.code_snippet || "",
    options: Array.isArray(r.options) ? r.options : [],
    correctIndex: typeof r.correct_index === "number" ? r.correct_index : 0,
    explanation: r.explanation || ""
  };
}

const cloud = {
  ready: SUPABASE_READY,
  client: sb,

  // Tải toàn bộ môn + câu hỏi chưa bị ẩn, gộp thành cấu trúc subjects của app
  async loadAll() {
    const [subRes, qRes] = await Promise.all([
      sb.from("subjects").select("*").eq("is_deleted", false),
      sb.from("questions").select("*").eq("is_deleted", false)
    ]);
    if (subRes.error) throw subRes.error;
    if (qRes.error) throw qRes.error;

    const bySubject = {};
    (qRes.data || []).forEach(r => {
      (bySubject[r.subject_id] = bySubject[r.subject_id] || []).push(rowToQuestion(r));
    });

    return (subRes.data || []).map(s => ({
      id: s.id,
      name: s.name,
      questions: bySubject[s.id] || []
    }));
  },

  // Bảng đã từng có dữ liệu chưa (tính cả row đã ẩn) → để biết có nên seed lần đầu không
  async hasAnySubject() {
    const { count, error } = await sb.from("subjects").select("id", { count: "exact", head: true });
    if (error) throw error;
    return (count || 0) > 0;
  },

  // Kiểm password admin (server-side, không lộ password về client)
  async verifyAdmin(password) {
    const { data, error } = await sb.rpc("verify_admin", { p_password: password });
    if (error) throw error;
    return !!data;
  },

  // --- GHI: bắt buộc qua RPC kèm password. RLS đã chặn ghi trực tiếp. ---

  async upsertSubject(subject, password) {
    const { error } = await sb.rpc("admin_upsert_subject", {
      p_password: password,
      p_id: subject.id,
      p_name: subject.name
    });
    if (error) throw error;
  },

  // Ẩn môn + ẩn toàn bộ câu hỏi của môn (soft-delete)
  async softDeleteSubject(id, password) {
    const { error } = await sb.rpc("admin_soft_delete_subject", { p_password: password, p_id: id });
    if (error) throw error;
  },

  async upsertQuestion(subjectId, q, password) {
    const { error } = await sb.rpc("admin_upsert_question", {
      p_password: password,
      p_id: q.id,
      p_subject_id: subjectId,
      p_question_text: q.questionText || "",
      p_code_snippet: q.codeSnippet || "",
      p_options: q.options || [],
      p_correct_index: typeof q.correctIndex === "number" ? q.correctIndex : 0,
      p_explanation: q.explanation || ""
    });
    if (error) throw error;
  },

  async softDeleteQuestion(id, password) {
    const { error } = await sb.rpc("admin_soft_delete_question", { p_password: password, p_id: id });
    if (error) throw error;
  },

  // Lắng nghe thay đổi realtime trên cả 2 bảng
  subscribe(onChange) {
    if (!sb) return null;
    return sb.channel("tvu-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, onChange)
      .subscribe();
  }
};

window.cloud = cloud;
