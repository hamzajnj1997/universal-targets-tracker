# Real-Time Work Ownership Tracker

Focused live-board app for small teams that need to know what work is available,
who owns it right now, what is blocked, and what was completed today.

## Product Scope

Core workflow:

1. Create target
2. Claim target
3. Release, block, or complete target
4. Record audit activity and notes
5. Review board and dashboard

This app intentionally does not include CRM, HR, payroll, accounting, inventory,
chat, AI, or general business-management modules.

## Routes

- `/login`
- `/signup`
- `/forgot-password`
- `/onboarding`
- `/app/board`
- `/app/my-work`
- `/app/completed`
- `/app/dashboard`
- `/app/settings`
- `/app/settings/members`
- `/app/settings/team`
- `/app/settings/profile`

## Environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Database

Apply the migration before deploying app code that uses the new workflow:

```bash
supabase/migrations/20260521_work_ownership_tracker.sql
```

The migration preserves the existing workspace/member/target foundation and adds
work ownership status, blocker/completion fields, target activity, target notes,
and protected RPC actions.

## Development

```bash
npm run dev
```

Open `http://localhost:3000/app/board`.

## Validation

Run before deployment:

```bash
npm run lint
npm run build
```

Manual checks:

- Signup and login
- Create or join a team
- Create a target
- Claim, release, block, complete, reopen, and archive through allowed roles
- Audit log entries for target actions and notes
- Member permissions enforced by Supabase RPC/RLS
- Clean desktop and mobile board layouts
