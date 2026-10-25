-- نموذج إعداد تجريبي فقط: لا يُطبق على بيانات طالبات حقيقية قبل اعتماد أمن المعلومات ومكان التخزين.
create extension if not exists pgcrypto;

create table if not exists public.students (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 school_code text not null check (school_code in ('p31','m34')),
 name text not null,
 grade text not null,
 class_name text not null,
 is_deleted boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.entries (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 school_code text not null check (school_code in ('p31','m34')),
 student_id uuid not null references public.students(id),
 type text not null,
 date date not null,
 status text not null check (status in ('مفتوحة','مغلقة')),
 notes text not null default '',
 action_note text not null default '',
 is_deleted boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.tasks (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 school_code text not null check (school_code in ('p31','m34')),
 title text not null,
 due_date date not null,
 done boolean not null default false,
 is_deleted boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.audit_log (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 table_name text not null,
 entity_id uuid not null,
 operation text not null,
 previous_value jsonb,
 current_value jsonb,
 changed_at timestamptz not null default now(),
 changed_by uuid
);
-- سياسات صفوف: المستخدم لا يرى إلا سجلات حسابه المصادق عليه.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['students','entries','tasks','audit_log'] LOOP
  EXECUTE format('alter table public.%I enable row level security',t);
 END LOOP;
END $$;
create policy "select own students" on public.students for select to authenticated using (owner_id=auth.uid());
create policy "insert own students" on public.students for insert to authenticated with check (owner_id=auth.uid());
create policy "update own students" on public.students for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "select own entries" on public.entries for select to authenticated using (owner_id=auth.uid());
create policy "insert own entries" on public.entries for insert to authenticated with check (owner_id=auth.uid());
create policy "update own entries" on public.entries for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "select own tasks" on public.tasks for select to authenticated using (owner_id=auth.uid());
create policy "insert own tasks" on public.tasks for insert to authenticated with check (owner_id=auth.uid());
create policy "update own tasks" on public.tasks for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "select own audit" on public.audit_log for select to authenticated using (owner_id=auth.uid());
-- لا يوجد أي policy يسمح للمستخدمين بتعديل سجل التدقيق أو حذفه.

create or replace function public.guard_entry_school() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.students s where s.id=new.student_id and s.owner_id=new.owner_id and s.school_code=new.school_code and not s.is_deleted)
 then raise exception 'student does not belong to this school/owner'; end if;
 return new;
end $$;
create trigger validate_entry_school before insert or update on public.entries for each row execute function public.guard_entry_school();

create or replace function public.audit_guidance_changes() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare prior jsonb; newer jsonb; who uuid; rec_id uuid; op_owner uuid;
begin
 if TG_OP='INSERT' then prior=null;newer=to_jsonb(NEW);who=NEW.owner_id;rec_id=NEW.id;
 elsif TG_OP='UPDATE' then prior=to_jsonb(OLD);newer=to_jsonb(NEW);who=NEW.owner_id;rec_id=NEW.id;
 else prior=to_jsonb(OLD);newer=null;who=OLD.owner_id;rec_id=OLD.id; end if;
 insert into public.audit_log(owner_id,table_name,entity_id,operation,previous_value,current_value,changed_by)
 values(who,TG_TABLE_NAME,rec_id,TG_OP,prior,newer,auth.uid());
 return coalesce(NEW,OLD);
end $$;
create trigger audit_students after insert or update or delete on public.students for each row execute function public.audit_guidance_changes();
create trigger audit_entries after insert or update or delete on public.entries for each row execute function public.audit_guidance_changes();
create trigger audit_tasks after insert or update or delete on public.tasks for each row execute function public.audit_guidance_changes();

-- لا تنشر audit_log أو أي جدول دون تفعيل RLS واختباره بحسابين منفصلين.
-- سياسة المرفقات والنسخ المستقلة خارج نطاق هذا النموذج الأولي.
