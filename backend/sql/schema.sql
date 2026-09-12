-- Run in the Supabase SQL editor.

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nessie_customer_id text,
  nessie_account_id text,
  demo_merchant_id text,
  profile_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  principal numeric not null,
  subsidized_amount numeric not null default 0,
  unsubsidized_amount numeric not null default 0,
  interest_rate numeric not null,
  disbursement_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_state (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  agent_name text not null check (agent_name in ('compass', 'horizon', 'anchor')),
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (student_id, agent_name, key)
);

create table if not exists public.concepts_understood (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  concept_name text not null,
  explained_at timestamptz not null default now(),
  unique (student_id, concept_name)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  storage_path text not null,
  ocr_text text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;
alter table public.loans enable row level security;
alter table public.agent_state enable row level security;
alter table public.concepts_understood enable row level security;
alter table public.documents enable row level security;

-- App data is read/written by FastAPI with the service role (bypasses RLS).
-- These policies exist if you later query from the phone.

create policy "students_own_row" on public.students
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "loans_own_student" on public.loans
  for all using (
    student_id in (select id from public.students where user_id = auth.uid())
  );

create policy "agent_state_own_student" on public.agent_state
  for all using (
    student_id in (select id from public.students where user_id = auth.uid())
  );

create policy "concepts_own_student" on public.concepts_understood
  for all using (
    student_id in (select id from public.students where user_id = auth.uid())
  );

create policy "documents_own_student" on public.documents
  for all using (
    student_id in (select id from public.students where user_id = auth.uid())
  );
