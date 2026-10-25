-- Student Guidance V2: legacy archive staging schema (for reviewed Supabase sandbox only).
-- Execute only after reviewing deployment location, organizational approval, RLS, and existing schema.
-- This SQL DOES NOT move student data; it only prepares an archival table.
create table if not exists public.legacy_records (
 id uuid primary key,
 owner_id uuid not null default auth.uid(),
 school_code text not null check (school_code in ('p31','m34')),
 category text not null check (category in ('daily','attendance','behavior','health','social','material','events','guardians','followup','honor','academic')),
 student_id uuid null references public.students(id),
 student_name text not null default '',
 grade text not null default '',
 class_name text not null default '',
 source_key text not null,
 source_index integer not null check (source_index >= 0),
 source_id text not null default '',
 event_date date null,
 raw_data jsonb not null,
 updated_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 constraint legacy_records_owner_school_source_unique unique (owner_id, school_code, source_key)
);
create index if not exists legacy_records_owner_school on public.legacy_records(owner_id,school_code);
create index if not exists legacy_records_owner_category on public.legacy_records(owner_id,school_code,category);
alter table public.legacy_records enable row level security;
revoke all on table public.legacy_records from anon;
revoke all on table public.legacy_records from authenticated;
grant select,insert on public.legacy_records to authenticated;
create policy "owner can read legacy archive" on public.legacy_records
 for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner can append legacy archive" on public.legacy_records
 for insert to authenticated with check (owner_id = (select auth.uid()));
-- No client-facing UPDATE/DELETE policy. The migration intentionally preserves source rows.
create or replace function public.validate_legacy_student() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.student_id is not null and not exists (
   select 1 from public.students s where s.id=new.student_id
   and s.owner_id=new.owner_id and s.school_code=new.school_code and not s.is_deleted
 ) then raise exception 'Student/school/owner mismatch on legacy import'; end if;
 return new;
end $$;
create trigger validate_legacy_student before insert or update on public.legacy_records
for each row execute function public.validate_legacy_student();
-- Audit history requires the previously reviewed public.audit_guidance_changes trigger function.
create trigger audit_legacy_records after insert or update or delete on public.legacy_records
for each row execute function public.audit_guidance_changes();
-- Audit_log is separate, contains previous/current record data and MUST be RLS-protected.
-- Explicitly revoke anonymous access from all data-related tables after reviewing older policies:
revoke all on table public.students,public.entries,public.tasks,public.audit_log from anon;
-- Verify authorized accounts can view only their own records and that inserts from unauthenticated clients fail.
-- Do not deploy this template to real student records until independent security review and approval.
