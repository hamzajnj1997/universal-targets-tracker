create extension if not exists pgcrypto;

alter table public.workspaces
  add column if not exists invite_code text;

update public.workspaces
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where invite_code is null or btrim(invite_code) = '';

create unique index if not exists workspaces_invite_code_idx
  on public.workspaces (invite_code);

alter table public.workspace_members
  add column if not exists email text,
  add column if not exists app_role text,
  add column if not exists status text default 'active',
  add column if not exists joined_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.workspace_members
set
  role = case
    when lower(coalesce(app_role, role, 'member')) in ('owner') then 'owner'
    when lower(coalesce(app_role, role, 'member')) in ('admin', 'leader', 'manager') then 'admin'
    else 'member'
  end,
  app_role = case
    when lower(coalesce(app_role, role, 'member')) in ('owner') then 'owner'
    when lower(coalesce(app_role, role, 'member')) in ('admin', 'leader', 'manager') then 'admin'
    else 'member'
  end,
  status = case
    when lower(coalesce(status, 'active')) in ('inactive', 'removed') then lower(status)
    else 'active'
  end,
  joined_at = coalesce(joined_at, created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_role_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_role_check
      check (role in ('owner', 'admin', 'member'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_app_role_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_app_role_check
      check (app_role in ('owner', 'admin', 'member'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_status_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_status_check
      check (status in ('active', 'inactive', 'removed'));
  end if;
end $$;

alter table public.targets
  add column if not exists status text default 'available',
  add column if not exists created_by_member_id uuid references public.workspace_members(id) on delete set null,
  add column if not exists blocked_reason text,
  add column if not exists blocked_at timestamptz,
  add column if not exists completed_by_member_id uuid references public.workspace_members(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists due_date date,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.targets
set
  status = case
    when coalesce(is_archived, false) then 'archived'
    when completed_at is not null then 'completed'
    when blocked_at is not null then 'blocked'
    when claimed_by_member_id is not null then 'claimed'
    else 'available'
  end,
  due_date = coalesce(due_date, start_date),
  updated_at = coalesce(updated_at, created_at, now()),
  archived_at = case
    when coalesce(is_archived, false) and archived_at is null then coalesce(updated_at, created_at, now())
    else archived_at
  end;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'targets_status_check'
  ) then
    alter table public.targets
      add constraint targets_status_check
      check (status in ('available', 'claimed', 'blocked', 'completed', 'archived'));
  end if;
end $$;

create table if not exists public.target_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_id uuid references public.targets(id) on delete cascade,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.target_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_id uuid not null references public.targets(id) on delete cascade,
  member_id uuid references public.workspace_members(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists target_activity_workspace_created_idx
  on public.target_activity (workspace_id, created_at desc);

create index if not exists target_activity_target_created_idx
  on public.target_activity (target_id, created_at desc);

create index if not exists target_notes_target_created_idx
  on public.target_notes (target_id, created_at desc);

create index if not exists targets_workspace_status_idx
  on public.targets (workspace_id, status);

create index if not exists targets_claimed_by_idx
  on public.targets (claimed_by_member_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_members_touch_updated_at on public.workspace_members;
create trigger workspace_members_touch_updated_at
  before update on public.workspace_members
  for each row execute function public.touch_updated_at();

drop trigger if exists targets_touch_updated_at on public.targets;
create trigger targets_touch_updated_at
  before update on public.targets
  for each row execute function public.touch_updated_at();

drop trigger if exists target_notes_touch_updated_at on public.target_notes;
create trigger target_notes_touch_updated_at
  before update on public.target_notes
  for each row execute function public.touch_updated_at();

create or replace function public.current_workspace_member_id(p_workspace_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.id
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  order by wm.created_at asc
  limit 1;
$$;

create or replace function public.current_workspace_role(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  order by wm.created_at asc
  limit 1;
$$;

create or replace function public.require_workspace_member(p_workspace_id uuid)
returns public.workspace_members
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members;
begin
  select *
  into v_member
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;

  if v_member.id is null then
    raise exception 'Active team membership is required.';
  end if;

  return v_member;
end;
$$;

create or replace function public.require_workspace_manager(p_workspace_id uuid)
returns public.workspace_members
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members;
begin
  v_member := public.require_workspace_member(p_workspace_id);

  if v_member.role not in ('owner', 'admin') then
    raise exception 'Owner or admin permission is required.';
  end if;

  return v_member;
end;
$$;

create or replace function public.create_activity_log(
  p_workspace_id uuid,
  p_target_id uuid,
  p_action text,
  p_old_status text default null,
  p_new_status text default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_actor_member_id uuid;
begin
  v_actor_member_id := public.current_workspace_member_id(p_workspace_id);

  insert into public.target_activity (
    workspace_id,
    target_id,
    actor_member_id,
    action,
    old_status,
    new_status,
    note,
    metadata
  )
  values (
    p_workspace_id,
    p_target_id,
    v_actor_member_id,
    p_action,
    p_old_status,
    p_new_status,
    nullif(btrim(coalesce(p_note, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_activity_id;

  return v_activity_id;
end;
$$;

create or replace function public.get_accessible_workspaces()
returns table (id uuid, name text, owner_id uuid, invite_code text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct w.id, w.name, w.owner_id, w.invite_code
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = auth.uid()
    and wm.status = 'active'
  order by w.name asc;
$$;

create or replace function public.create_team(team_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_member_id uuid;
  v_email text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a team.';
  end if;

  if btrim(coalesce(team_name, '')) = '' then
    raise exception 'Team name is required.';
  end if;

  v_email := auth.jwt() ->> 'email';
  v_display_name := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'display_name',
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    v_email,
    'Owner'
  );

  insert into public.workspaces (name, owner_id, invite_code)
  values (
    left(btrim(team_name), 80),
    auth.uid(),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  )
  returning * into v_workspace;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    email,
    display_name,
    role,
    app_role,
    status,
    joined_at
  )
  values (
    v_workspace.id,
    auth.uid(),
    v_email,
    left(v_display_name, 120),
    'owner',
    'owner',
    'active',
    now()
  )
  returning id into v_member_id;

  perform public.create_activity_log(
    v_workspace.id,
    null,
    'member_joined',
    null,
    null,
    'Team owner created the team.',
    jsonb_build_object('member_id', v_member_id)
  );

  return v_workspace;
end;
$$;

create or replace function public.join_team_by_invite_code(invite_code_input text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_existing_member public.workspace_members;
  v_member_id uuid;
  v_email text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a team.';
  end if;

  select *
  into v_workspace
  from public.workspaces
  where upper(invite_code) = upper(btrim(coalesce(invite_code_input, '')))
  limit 1;

  if v_workspace.id is null then
    raise exception 'Invite code was not found.';
  end if;

  select *
  into v_existing_member
  from public.workspace_members
  where workspace_id = v_workspace.id
    and user_id = auth.uid()
  order by created_at asc
  limit 1;

  v_email := auth.jwt() ->> 'email';
  v_display_name := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'display_name',
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    v_email,
    'Member'
  );

  if v_existing_member.id is not null then
    update public.workspace_members
    set status = 'active',
        email = coalesce(email, v_email),
        display_name = coalesce(nullif(display_name, ''), left(v_display_name, 120)),
        joined_at = coalesce(joined_at, now())
    where id = v_existing_member.id
    returning id into v_member_id;
  else
    insert into public.workspace_members (
      workspace_id,
      user_id,
      email,
      display_name,
      role,
      app_role,
      status,
      joined_at
    )
    values (
      v_workspace.id,
      auth.uid(),
      v_email,
      left(v_display_name, 120),
      'member',
      'member',
      'active',
      now()
    )
    returning id into v_member_id;
  end if;

  perform public.create_activity_log(
    v_workspace.id,
    null,
    'member_joined',
    null,
    null,
    'Member joined by invite code.',
    jsonb_build_object('member_id', v_member_id)
  );

  return v_workspace;
end;
$$;

create or replace function public.add_workspace_member_by_email(
  target_workspace_id uuid,
  teammate_email text,
  member_role text default 'member'
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager public.workspace_members;
  v_member public.workspace_members;
  v_role text;
  v_email text;
  v_user_id uuid;
begin
  v_manager := public.require_workspace_manager(target_workspace_id);
  v_role := case
    when lower(coalesce(member_role, 'member')) in ('owner') then 'owner'
    when lower(coalesce(member_role, 'member')) in ('admin', 'leader', 'manager') then 'admin'
    else 'member'
  end;
  v_email := lower(btrim(coalesce(teammate_email, '')));

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required.';
  end if;

  select id
  into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  select *
  into v_member
  from public.workspace_members
  where workspace_id = target_workspace_id
    and lower(coalesce(email, '')) = v_email
  limit 1;

  if v_member.id is not null then
    update public.workspace_members
    set role = v_role,
        app_role = v_role,
        status = case when user_id is null then 'inactive' else 'active' end,
        user_id = coalesce(user_id, v_user_id),
        email = v_email
    where id = v_member.id
    returning * into v_member;
  else
    insert into public.workspace_members (
      workspace_id,
      user_id,
      email,
      display_name,
      role,
      app_role,
      status
    )
    values (
      target_workspace_id,
      v_user_id,
      v_email,
      v_email,
      v_role,
      v_role,
      case when v_user_id is null then 'inactive' else 'active' end
    )
    returning * into v_member;
  end if;

  perform public.create_activity_log(
    target_workspace_id,
    null,
    'member_invited',
    null,
    null,
    'Member invite prepared.',
    jsonb_build_object('email', v_email, 'role', v_role, 'invited_by', v_manager.id)
  );

  return v_member;
end;
$$;

create or replace function public.create_target(
  team_id uuid,
  target_title text,
  target_description text default '',
  target_priority text default 'medium',
  target_due_date date default null
)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members;
  v_target public.targets;
begin
  v_member := public.require_workspace_member(team_id);

  if btrim(coalesce(target_title, '')) = '' then
    raise exception 'Target title is required.';
  end if;

  insert into public.targets (
    workspace_id,
    owner_member_id,
    title,
    description,
    category,
    priority,
    frequency,
    target_amount,
    unit,
    start_date,
    due_date,
    status,
    created_by_member_id,
    is_archived
  )
  values (
    team_id,
    null,
    left(btrim(target_title), 160),
    left(coalesce(target_description, ''), 2000),
    '',
    case when target_priority in ('low', 'medium', 'high', 'urgent') then target_priority else 'medium' end,
    'once',
    1,
    'task',
    coalesce(target_due_date, current_date),
    target_due_date,
    'available',
    v_member.id,
    false
  )
  returning * into v_target;

  perform public.create_activity_log(
    team_id,
    v_target.id,
    'target_created',
    null,
    'available',
    null,
    jsonb_build_object('title', v_target.title)
  );

  return v_target;
end;
$$;

create or replace function public.claim_target(target_id uuid)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_member public.workspace_members;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_member(v_target.workspace_id);

  if v_target.status <> 'available' then
    raise exception 'Only available targets can be claimed.';
  end if;

  update public.targets
  set status = 'claimed',
      claimed_by_member_id = v_member.id,
      claimed_at = now(),
      blocked_reason = null,
      blocked_at = null,
      is_archived = false
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_claimed',
    'available',
    'claimed',
    null,
    jsonb_build_object('claimed_by_member_id', v_member.id)
  );

  return v_target;
end;
$$;

create or replace function public.release_target(target_id uuid, release_reason text default null)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_member public.workspace_members;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_member(v_target.workspace_id);

  if v_target.status <> 'claimed' or v_target.claimed_by_member_id <> v_member.id then
    raise exception 'Members can release only their own claimed target.';
  end if;

  update public.targets
  set status = 'available',
      claimed_by_member_id = null,
      claimed_at = null,
      blocked_reason = null,
      blocked_at = null
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_released',
    'claimed',
    'available',
    release_reason,
    '{}'::jsonb
  );

  return v_target;
end;
$$;

create or replace function public.release_target_claim(target_id uuid)
returns public.targets
language sql
security definer
set search_path = public
as $$
  select * from public.release_target(target_id, null);
$$;

create or replace function public.force_release_target(target_id uuid, release_reason text)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_manager public.workspace_members;
  v_old_status text;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_manager := public.require_workspace_manager(v_target.workspace_id);

  if v_target.status not in ('claimed', 'blocked') then
    raise exception 'Only claimed or blocked targets can be force released.';
  end if;

  if btrim(coalesce(release_reason, '')) = '' then
    raise exception 'Force release reason is required.';
  end if;

  v_old_status := v_target.status;

  update public.targets
  set status = 'available',
      claimed_by_member_id = null,
      claimed_at = null,
      blocked_reason = null,
      blocked_at = null
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_force_released',
    v_old_status,
    'available',
    release_reason,
    jsonb_build_object('released_by_member_id', v_manager.id)
  );

  return v_target;
end;
$$;

create or replace function public.block_target(target_id uuid, block_reason text)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_member public.workspace_members;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_member(v_target.workspace_id);

  if v_target.status <> 'claimed' or v_target.claimed_by_member_id <> v_member.id then
    raise exception 'Members can block only their own claimed target.';
  end if;

  if btrim(coalesce(block_reason, '')) = '' then
    raise exception 'Block reason is required.';
  end if;

  update public.targets
  set status = 'blocked',
      blocked_reason = left(btrim(block_reason), 1000),
      blocked_at = now()
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_blocked',
    'claimed',
    'blocked',
    block_reason,
    '{}'::jsonb
  );

  return v_target;
end;
$$;

create or replace function public.complete_target(target_id uuid)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_member public.workspace_members;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_member(v_target.workspace_id);

  if v_target.status not in ('claimed', 'blocked') then
    raise exception 'Only claimed or blocked targets can be completed.';
  end if;

  if v_target.claimed_by_member_id <> v_member.id and v_member.role not in ('owner', 'admin') then
    raise exception 'Only the claimant, owner, or admin can complete this target.';
  end if;

  update public.targets
  set status = 'completed',
      completed_by_member_id = v_member.id,
      completed_at = now(),
      blocked_reason = null,
      blocked_at = null
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_completed',
    case when v_target.blocked_at is not null then 'blocked' else 'claimed' end,
    'completed',
    null,
    jsonb_build_object('completed_by_member_id', v_member.id)
  );

  return v_target;
end;
$$;

create or replace function public.reopen_target(target_id uuid)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_manager public.workspace_members;
  v_old_status text;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_manager := public.require_workspace_manager(v_target.workspace_id);
  v_old_status := v_target.status;

  update public.targets
  set status = 'available',
      claimed_by_member_id = null,
      claimed_at = null,
      blocked_reason = null,
      blocked_at = null,
      completed_by_member_id = null,
      completed_at = null,
      is_archived = false,
      archived_at = null
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_reopened',
    v_old_status,
    'available',
    null,
    jsonb_build_object('reopened_by_member_id', v_manager.id)
  );

  return v_target;
end;
$$;

create or replace function public.archive_target(target_id uuid)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_manager public.workspace_members;
  v_old_status text;
begin
  select *
  into v_target
  from public.targets
  where id = target_id
  for update;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_manager := public.require_workspace_manager(v_target.workspace_id);
  v_old_status := v_target.status;

  update public.targets
  set status = 'archived',
      is_archived = true,
      archived_at = now()
  where id = v_target.id
  returning * into v_target;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'target_archived',
    v_old_status,
    'archived',
    null,
    jsonb_build_object('archived_by_member_id', v_manager.id)
  );

  return v_target;
end;
$$;

create or replace function public.add_target_note(target_id uuid, note_body text)
returns public.target_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_member public.workspace_members;
  v_note public.target_notes;
begin
  select *
  into v_target
  from public.targets
  where id = target_id;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_member(v_target.workspace_id);

  if btrim(coalesce(note_body, '')) = '' then
    raise exception 'Note body is required.';
  end if;

  insert into public.target_notes (workspace_id, target_id, member_id, body)
  values (v_target.workspace_id, v_target.id, v_member.id, left(btrim(note_body), 2000))
  returning * into v_note;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'note_added',
    v_target.status,
    v_target.status,
    null,
    jsonb_build_object('note_id', v_note.id)
  );

  return v_note;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.targets enable row level security;
alter table public.target_activity enable row level security;
alter table public.target_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspaces' and policyname = 'workspaces_member_select'
  ) then
    create policy workspaces_member_select on public.workspaces
      for select
      using (
        owner_id = auth.uid()
        or public.current_workspace_member_id(workspaces.id) is not null
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_members' and policyname = 'workspace_members_team_select'
  ) then
    create policy workspace_members_team_select on public.workspace_members
      for select
      using (public.current_workspace_member_id(workspace_members.workspace_id) is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'targets' and policyname = 'targets_team_select'
  ) then
    create policy targets_team_select on public.targets
      for select
      using (public.current_workspace_member_id(targets.workspace_id) is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'target_activity' and policyname = 'target_activity_team_select'
  ) then
    create policy target_activity_team_select on public.target_activity
      for select
      using (public.current_workspace_member_id(target_activity.workspace_id) is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'target_notes' and policyname = 'target_notes_team_select'
  ) then
    create policy target_notes_team_select on public.target_notes
      for select
      using (public.current_workspace_member_id(target_notes.workspace_id) is not null);
  end if;
end $$;

grant execute on function public.get_accessible_workspaces() to authenticated;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team_by_invite_code(text) to authenticated;
grant execute on function public.add_workspace_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.create_target(uuid, text, text, text, date) to authenticated;
grant execute on function public.claim_target(uuid) to authenticated;
grant execute on function public.release_target(uuid, text) to authenticated;
grant execute on function public.release_target_claim(uuid) to authenticated;
grant execute on function public.force_release_target(uuid, text) to authenticated;
grant execute on function public.block_target(uuid, text) to authenticated;
grant execute on function public.complete_target(uuid) to authenticated;
grant execute on function public.reopen_target(uuid) to authenticated;
grant execute on function public.archive_target(uuid) to authenticated;
grant execute on function public.add_target_note(uuid, text) to authenticated;
