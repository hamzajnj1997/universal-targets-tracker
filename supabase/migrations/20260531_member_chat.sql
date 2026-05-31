create table if not exists public.member_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_member_id uuid not null references public.workspace_members(id) on delete cascade,
  recipient_member_id uuid not null references public.workspace_members(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint member_messages_body_check check (char_length(trim(body)) between 1 and 4000),
  constraint member_messages_not_self_check check (sender_member_id <> recipient_member_id)
);

create index if not exists member_messages_workspace_created_idx
  on public.member_messages (workspace_id, created_at desc);

create index if not exists member_messages_sender_recipient_idx
  on public.member_messages (sender_member_id, recipient_member_id, created_at desc);

create index if not exists member_messages_recipient_sender_idx
  on public.member_messages (recipient_member_id, sender_member_id, created_at desc);

alter table public.member_messages enable row level security;

drop policy if exists member_messages_select_own on public.member_messages;
create policy member_messages_select_own on public.member_messages
  for select
  using (
    public.current_workspace_member_id(member_messages.workspace_id) in (
      member_messages.sender_member_id,
      member_messages.recipient_member_id
    )
  );

drop policy if exists member_messages_insert_team on public.member_messages;
create policy member_messages_insert_team on public.member_messages
  for insert
  with check (
    public.current_workspace_member_id(member_messages.workspace_id) = member_messages.sender_member_id
    and exists (
      select 1
      from public.workspace_members recipient
      where recipient.id = member_messages.recipient_member_id
        and recipient.workspace_id = member_messages.workspace_id
        and coalesce(recipient.status, 'active') = 'active'
    )
  );

drop policy if exists member_messages_update_read on public.member_messages;
create policy member_messages_update_read on public.member_messages
  for update
  using (
    public.current_workspace_member_id(member_messages.workspace_id) =
      member_messages.recipient_member_id
  )
  with check (
    public.current_workspace_member_id(member_messages.workspace_id) =
      member_messages.recipient_member_id
  );

grant select, insert, update on table public.member_messages to authenticated;
