-- TVU Memorizer — Supabase schema + RLS
-- Chạy toàn bộ file này trong Supabase → SQL Editor → Run.

-- 1. Bảng môn học
create table if not exists public.subjects (
  id          text primary key,
  name        text not null,
  is_deleted  boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- 2. Bảng câu hỏi
create table if not exists public.questions (
  id            text primary key,
  subject_id    text references public.subjects(id),
  question_text text,
  code_snippet  text,
  options       jsonb,           -- mảng chuỗi đáp án
  correct_index int,
  explanation   text,
  is_deleted    boolean not null default false,
  updated_at    timestamptz not null default now()
);

create index if not exists questions_subject_idx on public.questions (subject_id);

-- 3. Bật Row Level Security
alter table public.subjects  enable row level security;
alter table public.questions enable row level security;

-- 4. Policies: ai cũng ĐỌC / THÊM / SỬA. KHÔNG có policy DELETE => xóa cứng bị chặn.
--    "Xóa" trong app = update is_deleted = true (khôi phục được).
drop policy if exists subjects_select on public.subjects;
drop policy if exists subjects_insert on public.subjects;
drop policy if exists subjects_update on public.subjects;
create policy subjects_select on public.subjects for select using (true);
create policy subjects_insert on public.subjects for insert with check (true);
create policy subjects_update on public.subjects for update using (true) with check (true);

drop policy if exists questions_select on public.questions;
drop policy if exists questions_insert on public.questions;
drop policy if exists questions_update on public.questions;
create policy questions_select on public.questions for select using (true);
create policy questions_insert on public.questions for insert with check (true);
create policy questions_update on public.questions for update using (true) with check (true);

-- 5. Bật Realtime cho 2 bảng (cập nhật live cho mọi người)
alter publication supabase_realtime add table public.subjects;
alter publication supabase_realtime add table public.questions;
