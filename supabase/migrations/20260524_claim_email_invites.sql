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

  return query
  with claimed as (
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
  ),
  activity as (
    insert into public.target_activity (
      workspace_id,
      target_id,
      actor_member_id,
      action,
      note,
      metadata
    )
    select
      workspace_id,
      null,
      id,
      'member_joined',
      'Pending email invite claimed after sign in.',
      jsonb_build_object('member_id', id, 'email', v_email)
    from claimed
    returning 1
  )
  select * from claimed;
end;
$$;

grant execute on function public.claim_workspace_invites_for_current_user() to authenticated;
