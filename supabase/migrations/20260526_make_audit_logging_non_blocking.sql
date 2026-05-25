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

  begin
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
  exception
    when insufficient_privilege or undefined_table or undefined_column then
      return null;
  end;

  return v_activity_id;
end;
$$;

drop function if exists public.claim_workspace_invites_for_current_user();
create or replace function public.claim_workspace_invites_for_current_user()
returns setof public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_display_name text;
  v_member public.workspace_members;
begin
  if auth.uid() is null then
    raise exception 'Sign in before claiming team invites.';
  end if;

  v_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A verified account email is required.';
  end if;

  v_display_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    v_email,
    'Member'
  );

  for v_member in
    update public.workspace_members wm
    set user_id = auth.uid(),
        email = coalesce(nullif(wm.email, ''), v_email),
        display_name = coalesce(nullif(wm.display_name, ''), left(v_display_name, 120)),
        status = 'active',
        joined_at = coalesce(wm.joined_at, now()),
        updated_at = now()
    where lower(coalesce(wm.email, '')) = v_email
      and wm.status <> 'removed'
      and (wm.user_id is null or wm.user_id = auth.uid() or wm.status <> 'active')
      and not exists (
        select 1
        from public.workspace_members existing
        where existing.workspace_id = wm.workspace_id
          and existing.user_id = auth.uid()
          and existing.status = 'active'
          and existing.id <> wm.id
      )
    returning wm.*
  loop
    perform public.create_activity_log(
      v_member.workspace_id,
      null,
      'member_joined',
      null,
      null,
      'Pending email invite claimed after sign in.',
      jsonb_build_object('member_id', v_member.id, 'email', v_email)
    );

    return next v_member;
  end loop;

  return;
end;
$$;

grant execute on function public.create_activity_log(uuid, uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.claim_workspace_invites_for_current_user() to authenticated;
grant select on table public.target_activity to authenticated;
