create table if not exists public.target_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_id uuid not null references public.targets(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_by_member_id uuid references public.workspace_members(id) on delete set null,
  completed_by_member_id uuid references public.workspace_members(id) on delete set null,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_checklist_items_title_check
    check (char_length(btrim(title)) between 1 and 240)
);

create index if not exists target_checklist_items_workspace_idx
  on public.target_checklist_items (workspace_id, target_id, sort_order, created_at);

create index if not exists target_checklist_items_target_idx
  on public.target_checklist_items (target_id, sort_order, created_at);

alter table public.target_checklist_items enable row level security;

drop trigger if exists target_checklist_items_touch_updated_at on public.target_checklist_items;
create trigger target_checklist_items_touch_updated_at
  before update on public.target_checklist_items
  for each row execute function public.touch_updated_at();

drop policy if exists target_checklist_items_team_select on public.target_checklist_items;
create policy target_checklist_items_team_select on public.target_checklist_items
  for select
  using (public.current_workspace_member_id(target_checklist_items.workspace_id) is not null);

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

  v_member := public.require_workspace_member(v_target.workspace_id);

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

  v_member := public.require_workspace_member(v_item.workspace_id);
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

  v_member := public.require_workspace_member(v_item.workspace_id);

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

grant select on table public.target_checklist_items to authenticated;
grant execute on function public.add_target_checklist_item(uuid, text) to authenticated;
grant execute on function public.toggle_target_checklist_item(uuid, boolean) to authenticated;
grant execute on function public.delete_target_checklist_item(uuid) to authenticated;
