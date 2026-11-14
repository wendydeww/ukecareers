-- UKECareers workspace – run once in Supabase → SQL Editor.
create table if not exists public.records(
  coll text not null, id text not null, data jsonb not null,
  version int not null default 1, updated_at timestamptz not null default now(), updated_by text,
  primary key(coll,id));
create table if not exists public.members(email text primary key, person text);
alter table public.records enable row level security;
alter table public.members enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.members where lower(email)=lower(auth.jwt()->>'email')) $$;

drop policy if exists rec_read on public.records; drop policy if exists rec_ins on public.records; drop policy if exists rec_upd on public.records; drop policy if exists mem_self on public.members;
create policy rec_read on public.records for select to authenticated using (public.is_member());
create policy rec_ins  on public.records for insert to authenticated with check (public.is_member());
create policy rec_upd  on public.records for update to authenticated using (public.is_member()) with check (public.is_member());
create policy mem_self on public.members for select to authenticated using (lower(email)=lower(auth.jwt()->>'email'));
-- no DELETE policy: the app soft-deletes with tombstones, so records can never be wiped from the browser.

-- Optimistic locking: a save only succeeds if the caller saw the latest version.
create or replace function public.save_record(p_coll text,p_id text,p_data jsonb,p_expected int) returns jsonb
language plpgsql security invoker as $$
declare cur public.records%rowtype;
begin
  select * into cur from public.records where coll=p_coll and id=p_id for update;
  if not found then
    insert into public.records(coll,id,data,version,updated_by) values(p_coll,p_id,p_data,1,auth.jwt()->>'email');
    return jsonb_build_object('ok',true,'version',1);
  elsif p_expected is distinct from cur.version then
    return jsonb_build_object('conflict',true,'version',cur.version,'data',cur.data);
  else
    update public.records set data=p_data,version=cur.version+1,updated_at=now(),updated_by=auth.jwt()->>'email' where coll=p_coll and id=p_id;
    return jsonb_build_object('ok',true,'version',cur.version+1);
  end if;
end $$;

alter publication supabase_realtime add table public.records;

-- Team allow-list: add the 13 members (email → name exactly as in the app's "Viewing as" list).
insert into public.members(email,person) values
 -- ('wendy@example.com','Wendy'), ('ashton@example.com','Ashton'), ('jonathan@example.com','Jonathan'), ('adam@example.com','Adam'),
 -- ('sofea@example.com','Sofea'), ('ronan@example.com','Ronan'), ('alisha@example.com','Alisha'), ('yilingg@example.com','Yi Lingg'),
 -- ('olivia@example.com','Olivia'), ('keiff@example.com','Keiff'), ('zulaikha@example.com','Zulaikha'), ('matthew@example.com','Matthew'), ('xinyi@example.com','Xin Yi')
 ('replace-me@example.com','Wendy')
on conflict (email) do nothing;
