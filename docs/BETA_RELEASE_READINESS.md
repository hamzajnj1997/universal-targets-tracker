# Universal Targets Tracker - Beta Release Readiness

## Current beta checkpoint

Stable tag:

```text
v45a-client-safe-date-hydration
```

Production URL:

```text
https://universal-targets-tracker.vercel.app/
```

Current beta status: ready for limited manual beta if the QA checklist passes.

---

## What is ready

The current beta supports:

- Local workspace tracking
- Local profiles for assigning work
- Add, edit, archive, restore, and delete targets
- Manual progress logging
- Edit and delete individual progress logs
- Daily, weekly, monthly, and one-time target support
- Calendar forecast view
- Monthly calendar grid
- Selected day summary
- Dashboard insights
- Reports/settings views
- Screen customization presets
- LocalStorage persistence
- CSV export
- Full JSON backup export/import
- Activity history safety ledger
- Manual Supabase cloud save/load
- Cloud load confirmation/cancellation safety
- Backend timeout fallback to local mode
- Workspace identity naming
- Client-safe loading shell to avoid stale prerendered dates

---

## What is intentionally not ready

Do not claim these are live:

- Real email invite sending
- Invite acceptance links
- Multi-workspace switching
- Full per-member permission enforcement from the backend
- Billing/subscription enforcement
- Automatic real-time sync
- Multi-user conflict resolution
- Organization admin console
- Audit log export
- Native mobile app
- Public landing/pricing site

---

## Current product model

Use this language consistently:

- User account: registered person in the system.
- Local profile: temporary beta assignment placeholder inside one browser workspace.
- Pending invite: future email invitation that has not been accepted.
- Workspace member: registered user after accepting an invite.
- Permission preset: what a workspace member can do.

Do not describe local profiles as real users or accepted workspace members.

---

## Data safety warning

This beta is not safe for critical production operations yet.

Users must be told:

- Browser local data can be lost if browser storage is cleared.
- JSON backup should be exported before destructive actions.
- Manual cloud sync can overwrite cloud data.
- Cloud load can replace local data.
- Real-time sync is not enabled.
- Email invites are not live.

---

## Beta tester script

Ask each beta tester to complete this exact script:

1. Open the production app.
2. Start with demo workspace.
3. Add one local profile.
4. Add one daily target.
5. Add one weekly target.
6. Log progress for today.
7. Select a past date and log progress.
8. Edit one target.
9. Delete one progress log.
10. Export a full JSON backup.
11. Start fresh locally.
12. Import the backup.
13. Confirm data restored.
14. Open mobile width and check readability.
15. Report confusing copy, broken buttons, or data loss risk.

Cloud sync should be tested only with non-critical data.

---

## Known limitations

- Local profiles are placeholders, not real invited users.
- Manual cloud sync is not automatic.
- Free workspace/team limits are launch-model copy only; quota enforcement is not active yet.
- Permission presets are mostly UX/model groundwork; not full backend authorization.
- The app currently focuses on the logged-in/local user's browser workspace.
- External beta users should export backups often.

---

## Beta go/no-go decision

Go for limited beta only if:

- Core local flows work.
- Backup/import works.
- Cloud sync cancellation safety works.
- Production root loads.
- Stale static date is not visible before hydration.
- No old role/member terminology appears in critical UI.
- No known data-loss bug remains unfixed.

Do not go wider than limited beta until real invite acceptance, workspace membership, and permission enforcement are implemented.
