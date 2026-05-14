# Universal Targets Tracker - Beta QA Checklist

Use this checklist before every production deployment.

Current beta priority:
- Prevent data loss
- Keep onboarding understandable
- Keep cloud sync manual and explicit
- Keep local profiles, invites, memberships, and permissions conceptually separate
- Avoid adding features before core flows are stable

Current stable beta tag:

```powershell
v45a-client-safe-date-hydration
```

---

## 1. Fresh visitor flow

- [ ] Open production app in a normal browser tab.
- [ ] Confirm the app loads without console-breaking errors.
- [ ] Confirm the public root first shows the neutral loading shell, not a stale baked date.
- [ ] Confirm the first-run or demo state is understandable.
- [ ] Confirm visible copy uses current model language:
  - local profile
  - pending invite
  - active workspace member
  - permission preset
- [ ] Confirm the app does not show outdated copy such as:
  - teammate profile
  - current role
  - owner role
  - Family Member

---

## 2. Demo workspace flow

- [ ] Click Try demo workspace.
- [ ] Confirm the warning explains local data will be replaced.
- [ ] Confirm sample local profiles appear:
  - Me
  - Sales profile
  - Study profile
- [ ] Confirm sample targets appear.
- [ ] Confirm weekly targets show Due This Week, not Due Today.
- [ ] Confirm dashboard totals update.
- [ ] Confirm calendar renders.

---

## 3. Empty workspace flow

- [ ] Click Start empty workspace.
- [ ] Confirm warning recommends exporting a backup first.
- [ ] Confirm local workspace resets to one local profile.
- [ ] Confirm no old targets remain.
- [ ] Confirm no old logs remain.
- [ ] Refresh page.
- [ ] Confirm empty workspace persists.

---

## 4. Local profile management flow

- [ ] Add a local profile.
- [ ] Confirm there is no role dropdown.
- [ ] Edit the local profile name.
- [ ] Delete the local profile.
- [ ] Confirm warning explains assigned targets/logs can be deleted.
- [ ] Confirm at least one local profile must remain.

---

## 5. Target management flow

- [ ] Add a target.
- [ ] Edit title, category, priority, frequency, unit, assigned profile, and target amount.
- [ ] Archive the target.
- [ ] Confirm archived target is hidden from active view.
- [ ] Restore the target.
- [ ] Delete the target.
- [ ] Confirm warning explains progress logs will also be deleted.

---

## 6. Progress logging flow

- [ ] Log progress for today.
- [ ] Log progress for a past date.
- [ ] Edit a progress log.
- [ ] Delete a progress log.
- [ ] Confirm warning says the delete cannot be undone.
- [ ] Confirm totals update after each change.
- [ ] Confirm activity history records destructive/data movement actions.

---

## 7. Calendar flow

- [ ] Open monthly calendar.
- [ ] Select today.
- [ ] Select a past date.
- [ ] Select a future date.
- [ ] Confirm selected day summary updates.
- [ ] Confirm past missed work carries into today.
- [ ] Confirm future days do not compound missed backlog infinitely.
- [ ] Confirm progress logging uses the selected date.

---

## 8. Filters/search flow

- [ ] Search by target title.
- [ ] Filter by local profile.
- [ ] Filter by category.
- [ ] Filter by priority.
- [ ] Filter by status.
- [ ] Filter active/archived targets.
- [ ] Clear filters.
- [ ] Confirm empty states explain whether filters are hiding results.

---

## 9. Backup/export/import flow

- [ ] Add one local profile.
- [ ] Add one target.
- [ ] Log progress.
- [ ] Export JSON backup.
- [ ] Confirm backup filename includes workspace slug.
- [ ] Start empty workspace.
- [ ] Import the JSON backup.
- [ ] Confirm local profiles restore.
- [ ] Confirm targets restore.
- [ ] Confirm progress logs restore.
- [ ] Confirm selected date/calendar still work after import.
- [ ] Confirm activity history restores after import.
- [ ] Export targets CSV and confirm headers do not say Owner Role.
- [ ] Export progress logs CSV and confirm headers do not say Owner Role.

---

## 10. Cloud sync flow

Only test with non-critical data.

- [ ] Sign in.
- [ ] Confirm account status appears.
- [ ] Confirm backend status does not stay stuck on Checking backend.
- [ ] Save local data to cloud.
- [ ] Confirm overwrite warning appears.
- [ ] Confirm save completes without error.
- [ ] Change local data.
- [ ] Click Load cloud data.
- [ ] Cancel the confirmation.
- [ ] Confirm local data does not change.
- [ ] Click Load cloud data again.
- [ ] Confirm load warning recommends backup first.
- [ ] Confirm cloud data loads correctly.
- [ ] Confirm activity history survives cloud save/load.
- [ ] Confirm registered workspace membership rows are not deleted by local cloud save.

---

## 11. Invite and permission model copy

Real invite sending is not live yet.

- [ ] Confirm Add local profile explains that email invites come later.
- [ ] Confirm future flow reads pending invite to active workspace member.
- [ ] Confirm permission area says Current permission preset.
- [ ] Confirm permission badges say Manage profiles, Assign targets, Approve work, Submit work, and Edit settings.
- [ ] Confirm no visible UI presents Owner/Admin/Student/Parent/Viewer as local profile identity types.

---

## 12. Mobile layout flow

Test at mobile width.

- [ ] Header is readable.
- [ ] Navigation is usable.
- [ ] First-run choice buttons stack correctly.
- [ ] Target cards are readable.
- [ ] Calendar is usable.
- [ ] Settings buttons are not cramped.
- [ ] No unexpected horizontal scrolling except intended calendar overflow.

---

## 13. Release gate

A production deployment is allowed only if:

- [ ] npm run lint passes.
- [ ] npm run build passes.
- [ ] Git working tree is clean.
- [ ] Current commit is pushed to origin/main.
- [ ] Vercel production deployment succeeds.
- [ ] Production root HTML returns status 200.
- [ ] Production root HTML shows Loading your workspace before hydration.
- [ ] At least fresh visitor, local profile, target, progress logging, backup/import, and cloud sync cancel tests pass manually.

---

## Rollback

Latest stable rollback tag:

```powershell
git checkout v45a-client-safe-date-hydration
```

Latest production commit should be checked with:

```powershell
git log --oneline -6
git status
```
