alter table public.workspaces
  add column if not exists logo_data_url text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists working_days text[] not null default array['mon', 'tue', 'wed', 'thu', 'fri'],
  add column if not exists date_format text not null default 'dd/mm/yyyy';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_logo_size_check'
  ) then
    alter table public.workspaces
      add constraint workspaces_logo_size_check
      check (logo_data_url is null or char_length(logo_data_url) <= 200000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_date_format_check'
  ) then
    alter table public.workspaces
      add constraint workspaces_date_format_check
      check (date_format in ('dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_working_days_check'
  ) then
    alter table public.workspaces
      add constraint workspaces_working_days_check
      check (
        working_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        and cardinality(working_days) between 1 and 7
      );
  end if;
end $$;

drop function if exists public.get_accessible_workspaces();
create or replace function public.get_accessible_workspaces()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  invite_code text,
  logo_data_url text,
  timezone text,
  working_days text[],
  date_format text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    w.id,
    w.name,
    w.owner_id,
    w.invite_code,
    w.logo_data_url,
    w.timezone,
    w.working_days,
    w.date_format
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = auth.uid()
    and wm.status = 'active'
  order by w.name asc;
$$;

drop function if exists public.update_workspace_settings(uuid, text, text, text, text[], text);
create or replace function public.update_workspace_settings(
  target_workspace_id uuid,
  team_name text,
  team_logo_data_url text default null,
  team_timezone text default 'UTC',
  team_working_days text[] default array['mon', 'tue', 'wed', 'thu', 'fri'],
  team_date_format text default 'dd/mm/yyyy'
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager public.workspace_members;
  v_workspace public.workspaces;
begin
  v_manager := public.require_workspace_manager(target_workspace_id);

  if btrim(coalesce(team_name, '')) = '' then
    raise exception 'Team name is required.';
  end if;

  if team_date_format not in ('dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd') then
    raise exception 'Choose a valid date format.';
  end if;

  if team_working_days is null
    or cardinality(team_working_days) = 0
    or cardinality(team_working_days) > 7
    or not (team_working_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  then
    raise exception 'Choose at least one valid working day.';
  end if;

  update public.workspaces
  set
    name = left(btrim(team_name), 80),
    logo_data_url = nullif(team_logo_data_url, ''),
    timezone = left(btrim(coalesce(team_timezone, 'UTC')), 80),
    working_days = team_working_days,
    date_format = team_date_format
  where id = target_workspace_id
  returning * into v_workspace;

  perform public.create_activity_log(
    target_workspace_id,
    null,
    'target_updated',
    null,
    null,
    'Workspace settings updated.',
    jsonb_build_object('actor_member_id', v_manager.id)
  );

  return v_workspace;
end;
$$;

drop function if exists public.transfer_team_ownership(uuid, uuid);
create or replace function public.transfer_team_ownership(
  target_workspace_id uuid,
  new_owner_member_id uuid
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner public.workspace_members;
  v_new_owner public.workspace_members;
  v_workspace public.workspaces;
begin
  v_owner := public.require_workspace_member(target_workspace_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only the owner can transfer ownership.';
  end if;

  select *
  into v_new_owner
  from public.workspace_members
  where id = new_owner_member_id
    and workspace_id = target_workspace_id
    and status = 'active';

  if v_new_owner.id is null then
    raise exception 'Choose an active member.';
  end if;

  if v_new_owner.user_id is null then
    raise exception 'The new owner must accept the invite first.';
  end if;

  update public.workspace_members
  set role = 'admin', app_role = 'admin'
  where workspace_id = target_workspace_id
    and role = 'owner';

  update public.workspace_members
  set role = 'owner', app_role = 'owner'
  where id = v_new_owner.id;

  update public.workspaces
  set owner_id = v_new_owner.user_id
  where id = target_workspace_id
  returning * into v_workspace;

  perform public.create_activity_log(
    target_workspace_id,
    null,
    'role_changed',
    null,
    null,
    'Workspace ownership transferred.',
    jsonb_build_object('from_member_id', v_owner.id, 'to_member_id', v_new_owner.id)
  );

  return v_workspace;
end;
$$;

drop function if exists public.leave_team(uuid);
create or replace function public.leave_team(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members;
begin
  v_member := public.require_workspace_member(target_workspace_id);

  if v_member.role = 'owner' then
    raise exception 'Transfer ownership before leaving this team.';
  end if;

  update public.workspace_members
  set status = 'removed'
  where id = v_member.id;

  perform public.create_activity_log(
    target_workspace_id,
    null,
    'role_changed',
    null,
    null,
    'Member left the workspace.',
    jsonb_build_object('member_id', v_member.id)
  );
end;
$$;

drop function if exists public.delete_team(uuid);
create or replace function public.delete_team(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members;
begin
  v_member := public.require_workspace_member(target_workspace_id);
  if v_member.role <> 'owner' then
    raise exception 'Only the owner can delete this team.';
  end if;

  delete from public.workspaces
  where id = target_workspace_id;
end;
$$;

grant execute on function public.get_accessible_workspaces() to authenticated;
grant execute on function public.update_workspace_settings(uuid, text, text, text, text[], text) to authenticated;
grant execute on function public.transfer_team_ownership(uuid, uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.delete_team(uuid) to authenticated;
