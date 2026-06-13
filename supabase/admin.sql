-- TVU Memorizer — Admin gate (RPC, chống bypass)
-- Chạy SAU schema.sql. Khóa ghi trực tiếp; chỉ ghi được qua RPC có kiểm password server-side.
-- ĐỔI 'CHANGE_ME_ADMIN_PASSWORD' thành mật khẩu admin của bạn (dòng INSERT bên dưới).

-- 1. Bảng lưu password admin (RLS bật, KHÔNG policy => client không đọc được).
create table if not exists public.admin_config (
  id       int primary key default 1,
  password text not null,
  constraint admin_config_single check (id = 1)
);
alter table public.admin_config enable row level security;
-- (không tạo policy nào => anon không SELECT/INSERT/UPDATE được trực tiếp)

-- 2. Đặt / đổi password admin
insert into public.admin_config (id, password)
values (1, 'CHANGE_ME_ADMIN_PASSWORD')
on conflict (id) do update set password = excluded.password;

-- 3. Khóa GHI TRỰC TIẾP: gỡ policy insert/update mở. Giữ SELECT mở, DELETE vẫn chặn.
drop policy if exists subjects_insert  on public.subjects;
drop policy if exists subjects_update  on public.subjects;
drop policy if exists questions_insert on public.questions;
drop policy if exists questions_update on public.questions;

-- 4. Hàm kiểm password (security definer => đọc được admin_config dù RLS khóa)
create or replace function public.verify_admin(p_password text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from admin_config where id = 1 and password = p_password);
$$;

-- 5. Hàm ghi (đều check password trước; security definer => bypass RLS để ghi)
create or replace function public.admin_upsert_subject(p_password text, p_id text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_admin(p_password) then raise exception 'unauthorized'; end if;
  insert into subjects (id, name, is_deleted, updated_at)
  values (p_id, p_name, false, now())
  on conflict (id) do update set name = excluded.name, is_deleted = false, updated_at = now();
end; $$;

create or replace function public.admin_soft_delete_subject(p_password text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_admin(p_password) then raise exception 'unauthorized'; end if;
  update subjects  set is_deleted = true, updated_at = now() where id = p_id;
  update questions set is_deleted = true, updated_at = now() where subject_id = p_id;
end; $$;

create or replace function public.admin_upsert_question(
  p_password text, p_id text, p_subject_id text, p_question_text text,
  p_code_snippet text, p_options jsonb, p_correct_index int, p_explanation text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_admin(p_password) then raise exception 'unauthorized'; end if;
  insert into questions (id, subject_id, question_text, code_snippet, options, correct_index, explanation, is_deleted, updated_at)
  values (p_id, p_subject_id, p_question_text, p_code_snippet, p_options, p_correct_index, p_explanation, false, now())
  on conflict (id) do update set
    subject_id    = excluded.subject_id,
    question_text = excluded.question_text,
    code_snippet  = excluded.code_snippet,
    options       = excluded.options,
    correct_index = excluded.correct_index,
    explanation   = excluded.explanation,
    is_deleted    = false,
    updated_at    = now();
end; $$;

create or replace function public.admin_soft_delete_question(p_password text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_admin(p_password) then raise exception 'unauthorized'; end if;
  update questions set is_deleted = true, updated_at = now() where id = p_id;
end; $$;

-- 6. Cho phép anon GỌI các hàm (việc ghi vẫn bị chặn nếu sai password)
grant execute on function public.verify_admin(text) to anon, authenticated;
grant execute on function public.admin_upsert_subject(text, text, text) to anon, authenticated;
grant execute on function public.admin_soft_delete_subject(text, text) to anon, authenticated;
grant execute on function public.admin_upsert_question(text, text, text, text, text, jsonb, int, text) to anon, authenticated;
grant execute on function public.admin_soft_delete_question(text, text) to anon, authenticated;
