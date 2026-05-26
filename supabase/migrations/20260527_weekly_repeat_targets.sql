drop function if exists public.create_target(uuid, text, text, text, date);
drop function if exists public.create_target(uuid, text, text, text, date, boolean, integer, text[]);

create or replace function public.create_target(
  team_id uuid,
  target_title text,
  target_description text default '',
  target_priority text default 'medium',
  target_due_date date default null,
  target_repeats_weekly boolean default false,
  target_repeat_count_per_week integer default null,
  target_repeat_days text[] default '{}'::text[]
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
begin
  v_member := public.require_workspace_member(team_id);

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
    case when v_repeats_weekly then 'weekly' else 'once' end,
    v_repeat_count,
    case when v_repeats_weekly then 'days:' || array_to_string(v_repeat_days, ',') else 'task' end,
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
    jsonb_build_object(
      'title', v_target.title,
      'repeat_days', v_repeat_days,
      'repeat_count_per_week', v_repeat_count
    )
  );

  return v_target;
end;
$$;

grant execute on function public.create_target(uuid, text, text, text, date, boolean, integer, text[]) to authenticated;
