alter table public.workspace_members
  add column if not exists designation text,
  add column if not exists reports_to_member_id uuid references public.workspace_members(id) on delete set null;

create index if not exists workspace_members_reports_to_idx
  on public.workspace_members (workspace_id, reports_to_member_id);

create or replace function public.update_member_org(
  target_member_id uuid,
  member_designation text,
  manager_member_id uuid default null
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager public.workspace_members;
  v_target public.workspace_members;
  v_reports_to public.workspace_members;
  v_updated public.workspace_members;
  v_designation text;
begin
  select *
  into v_target
  from public.workspace_members
  where id = target_member_id
    and coalesce(status, 'active') <> 'removed';

  if v_target.id is null then
    raise exception 'Member not found.';
  end if;

  select *
  into v_manager
  from public.workspace_members
  where workspace_id = v_target.workspace_id
    and user_id = auth.uid()
    and coalesce(status, 'active') = 'active'
  limit 1;

  if v_manager.id is null or v_manager.role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can update organization structure.';
  end if;

  if manager_member_id is not null then
    if manager_member_id = target_member_id then
      raise exception 'A member cannot report to themselves.';
    end if;

    select *
    into v_reports_to
    from public.workspace_members
    where id = manager_member_id
      and workspace_id = v_target.workspace_id
      and coalesce(status, 'active') = 'active';

    if v_reports_to.id is null then
      raise exception 'Manager must be an active member of this team.';
    end if;
  end if;

  v_designation := left(nullif(trim(coalesce(member_designation, '')), ''), 120);

  update public.workspace_members
  set designation = coalesce(v_designation, 'Team Member'),
      reports_to_member_id = manager_member_id,
      updated_at = now()
  where id = target_member_id
  returning * into v_updated;

  return v_updated;
end;
$$;

grant execute on function public.update_member_org(uuid, text, uuid) to authenticated;
