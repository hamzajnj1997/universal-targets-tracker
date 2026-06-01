alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  drop constraint if exists workspace_members_app_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
    check (role in ('owner', 'admin', 'member', 'guest')),
  add constraint workspace_members_app_role_check
    check (app_role in ('owner', 'admin', 'member', 'guest'));

create or replace function public.require_workspace_contributor(p_workspace_id uuid)
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

  if v_member.role = 'guest' then
    raise exception 'Guests have read-only access.';
  end if;

  return v_member;
end;
$$;

drop function if exists public.add_workspace_member_by_email(uuid, text, text);
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
    when lower(coalesce(member_role, 'member')) in ('guest', 'viewer', 'client', 'readonly', 'read-only') then 'guest'
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

drop function if exists public.create_target(uuid, text, text, text, date);
drop function if exists public.create_target(uuid, text, text, text, date, boolean, integer, text[]);
drop function if exists public.create_target(uuid, text, text, text, date, boolean, integer, text[], date, date);

create or replace function public.create_target(
  team_id uuid,
  target_title text,
  target_description text default '',
  target_priority text default 'medium',
  target_due_date date default null,
  target_repeats_weekly boolean default false,
  target_repeat_count_per_week integer default null,
  target_repeat_days text[] default '{}'::text[],
  target_repeat_start_date date default null,
  target_repeat_end_date date default null
)
returns public.targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members;
  v_target public.targets;
  v_repeat_days text[] := '{}'::text[];
  v_repeats_weekly boolean := false;
  v_repeat_count integer := 1;
  v_repeat_start_date date := null;
  v_repeat_end_date date := null;
begin
  v_member := public.require_workspace_contributor(team_id);

  if btrim(coalesce(target_title, '')) = '' then
    raise exception 'Target title is required.';
  end if;

  select coalesce(array_agg(day order by first_seen), '{}'::text[])
  into v_repeat_days
  from (
    select day, min(day_order) as first_seen
    from unnest(coalesce(target_repeat_days, '{}'::text[])) with ordinality as selected(day, day_order)
    where day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
    group by day
  ) valid_days;

  v_repeats_weekly := coalesce(target_repeats_weekly, false) and cardinality(v_repeat_days) > 0;
  v_repeat_count := case when v_repeats_weekly then cardinality(v_repeat_days) else 1 end;
  v_repeat_start_date := case
    when v_repeats_weekly then coalesce(target_repeat_start_date, target_due_date, current_date)
    else null
  end;
  v_repeat_end_date := case when v_repeats_weekly then target_repeat_end_date else null end;

  if v_repeats_weekly and v_repeat_end_date is not null and v_repeat_end_date < v_repeat_start_date then
    raise exception 'Repeat end date must be on or after the start date.';
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
    repeat_start_date,
    repeat_end_date,
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
    case when v_repeats_weekly then 'weekly' else 'once' end,
    v_repeat_count,
    case when v_repeats_weekly then 'days:' || array_to_string(v_repeat_days, ',') else 'task' end,
    coalesce(v_repeat_start_date, target_due_date, current_date),
    coalesce(target_due_date, v_repeat_start_date),
    v_repeat_start_date,
    v_repeat_end_date,
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
    jsonb_build_object(
      'title', v_target.title,
      'repeat_days', v_repeat_days,
      'repeat_count_per_week', v_repeat_count,
      'repeat_start_date', v_repeat_start_date,
      'repeat_end_date', v_repeat_end_date
    )
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

  v_member := public.require_workspace_contributor(v_target.workspace_id);

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

drop function if exists public.release_target_claim(uuid);
drop function if exists public.release_target(uuid, text);
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

  v_member := public.require_workspace_contributor(v_target.workspace_id);

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

  v_member := public.require_workspace_contributor(v_target.workspace_id);

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

  v_member := public.require_workspace_contributor(v_target.workspace_id);

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

  v_member := public.require_workspace_contributor(v_target.workspace_id);

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

create or replace function public.add_target_checklist_item(
  target_id uuid,
  item_title text
)
returns public.target_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.targets;
  v_member public.workspace_members;
  v_item public.target_checklist_items;
  v_sort_order integer;
begin
  select *
  into v_target
  from public.targets
  where id = target_id;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_contributor(v_target.workspace_id);

  if btrim(coalesce(item_title, '')) = '' then
    raise exception 'Checklist item title is required.';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_sort_order
  from public.target_checklist_items
  where target_checklist_items.target_id = v_target.id;

  insert into public.target_checklist_items (
    workspace_id,
    target_id,
    title,
    created_by_member_id,
    sort_order
  )
  values (
    v_target.workspace_id,
    v_target.id,
    left(btrim(item_title), 240),
    v_member.id,
    v_sort_order
  )
  returning * into v_item;

  perform public.create_activity_log(
    v_target.workspace_id,
    v_target.id,
    'checklist_item_added',
    v_target.status,
    v_target.status,
    v_item.title,
    jsonb_build_object('checklist_item_id', v_item.id, 'created_by_member_id', v_member.id)
  );

  return v_item;
end;
$$;

create or replace function public.toggle_target_checklist_item(
  checklist_item_id uuid,
  item_is_done boolean
)
returns public.target_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.target_checklist_items;
  v_target public.targets;
  v_member public.workspace_members;
  v_old_is_done boolean;
begin
  select *
  into v_item
  from public.target_checklist_items
  where id = checklist_item_id
  for update;

  if v_item.id is null then
    raise exception 'Checklist item was not found.';
  end if;

  select *
  into v_target
  from public.targets
  where id = v_item.target_id;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_contributor(v_item.workspace_id);
  v_old_is_done := v_item.is_done;

  update public.target_checklist_items
  set is_done = coalesce(item_is_done, false),
      completed_by_member_id = case when coalesce(item_is_done, false) then v_member.id else null end,
      completed_at = case when coalesce(item_is_done, false) then now() else null end
  where id = v_item.id
  returning * into v_item;

  if v_old_is_done is distinct from v_item.is_done then
    perform public.create_activity_log(
      v_item.workspace_id,
      v_item.target_id,
      case when v_item.is_done then 'checklist_item_completed' else 'checklist_item_reopened' end,
      v_target.status,
      v_target.status,
      v_item.title,
      jsonb_build_object('checklist_item_id', v_item.id, 'updated_by_member_id', v_member.id)
    );
  end if;

  return v_item;
end;
$$;

create or replace function public.delete_target_checklist_item(checklist_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.target_checklist_items;
  v_target public.targets;
  v_member public.workspace_members;
begin
  select *
  into v_item
  from public.target_checklist_items
  where id = checklist_item_id
  for update;

  if v_item.id is null then
    return;
  end if;

  select *
  into v_target
  from public.targets
  where id = v_item.target_id;

  if v_target.id is null then
    raise exception 'Target was not found.';
  end if;

  v_member := public.require_workspace_contributor(v_item.workspace_id);

  delete from public.target_checklist_items
  where id = v_item.id;

  perform public.create_activity_log(
    v_item.workspace_id,
    v_item.target_id,
    'checklist_item_deleted',
    v_target.status,
    v_target.status,
    v_item.title,
    jsonb_build_object('checklist_item_id', v_item.id, 'deleted_by_member_id', v_member.id)
  );
end;
$$;

drop policy if exists member_messages_insert_team on public.member_messages;
create policy member_messages_insert_team on public.member_messages
  for insert
  with check (
    public.current_workspace_member_id(member_messages.workspace_id) = member_messages.sender_member_id
    and public.current_workspace_role(member_messages.workspace_id) in ('owner', 'admin', 'member')
    and exists (
      select 1
      from public.workspace_members recipient
      where recipient.id = member_messages.recipient_member_id
        and recipient.workspace_id = member_messages.workspace_id
        and coalesce(recipient.status, 'active') = 'active'
        and coalesce(recipient.role, 'member') <> 'guest'
    )
  );

grant execute on function public.require_workspace_contributor(uuid) to authenticated;
grant execute on function public.add_workspace_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.create_target(uuid, text, text, text, date, boolean, integer, text[], date, date) to authenticated;
grant execute on function public.claim_target(uuid) to authenticated;
grant execute on function public.release_target(uuid, text) to authenticated;
grant execute on function public.release_target_claim(uuid) to authenticated;
grant execute on function public.block_target(uuid, text) to authenticated;
grant execute on function public.complete_target(uuid) to authenticated;
grant execute on function public.add_target_note(uuid, text) to authenticated;
grant execute on function public.add_target_checklist_item(uuid, text) to authenticated;
grant execute on function public.toggle_target_checklist_item(uuid, boolean) to authenticated;
grant execute on function public.delete_target_checklist_item(uuid) to authenticated;
