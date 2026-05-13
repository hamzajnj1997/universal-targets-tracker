# Universal Targets Tracker � Beta QA Checklist

Use this checklist before every production deployment.

Current beta priority:
- Prevent data loss
- Keep onboarding understandable
- Keep cloud sync manual and explicit
- Avoid adding features before core flows are stable

---

## 1. Fresh visitor flow

- [ ] Open production app in a normal browser tab.
- [ ] Confirm the app loads without console-breaking errors.
- [ ] Confirm the first-run section clearly offers:
  - Try demo workspace
  - Start empty workspace
  - Import backup
- [ ] Confirm the app does not use prototype/foundation wording in visible user-facing copy.

---

## 2. Demo workspace flow

- [ ] Click Try demo workspace.
- [ ] Confirm the warning explains local data will be replaced.
- [ ] Confirm sample teammate profiles appear.
- [ ] Confirm sample targets appear.
- [ ] Confirm dashboard totals update.
- [ ] Confirm calendar still renders.

---

## 3. Empty workspace flow

- [ ] Click Start empty workspace.
- [ ] Confirm warning recommends exporting a backup first.
- [ ] Confirm local workspace resets to one owner profile.
- [ ] Confirm no old targets remain.
- [ ] Confirm no old logs remain.
- [ ] Refresh page.
- [ ] Confirm empty workspace persists.

---

## 4. Backup/export/import flow

- [ ] Add one teammate profile.
- [ ] Add one target.
- [ ] Log progress.
- [ ] Export JSON backup.
- [ ] Start empty workspace.
- [ ] Import the JSON backup.
- [ ] Confirm teammate profiles restore.
- [ ] Confirm targets restore.
- [ ] Confirm progress logs restore.
- [ ] Confirm selected date/calendar still work after import.
- [ ] Confirm activity history restores after import.

---

## 5. Cloud sync flow

Only test with non-critical data.

- [ ] Sign in.
- [ ] Confirm account status appears.
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

---

## 6. Teammate profile management flow

- [ ] Add a teammate profile.
- [ ] Edit the teammate profile name.
- [ ] Edit the teammate profile role.
- [ ] Delete the teammate profile.
- [ ] Confirm warning explains assigned targets/logs can be deleted.
- [ ] Confirm at least one teammate profile must remain.

---

## 7. Target management flow

- [ ] Add a target.
- [ ] Edit title, category, priority, frequency, unit, owner, and target amount.
- [ ] Archive the target.
- [ ] Confirm archived target is hidden from active view.
- [ ] Restore the target.
- [ ] Delete the target.
- [ ] Confirm warning explains progress logs will also be deleted.

---

## 8. Progress logging flow

- [ ] Log progress for today.
- [ ] Log progress for a past date.
- [ ] Edit a progress log.
- [ ] Delete a progress log.
- [ ] Confirm warning says the delete cannot be undone.
- [ ] Confirm totals update after each change.

---

## 9. Calendar flow

- [ ] Open monthly calendar.
- [ ] Select today.
- [ ] Select a past date.
- [ ] Select a future date.
- [ ] Confirm selected day summary updates.
- [ ] Confirm future/past status labels make sense.
- [ ] Confirm progress logging uses the selected date.

---

## 10. Filters/search flow

- [ ] Search by target title.
- [ ] Filter by teammate profile.
- [ ] Filter by category.
- [ ] Filter by priority.
- [ ] Filter by status.
- [ ] Filter active/archived targets.
- [ ] Clear filters.
- [ ] Confirm empty states explain whether filters are hiding results.

---

## 11. Mobile layout flow

Test at mobile width.

- [ ] Header is readable.
- [ ] Navigation is usable.
- [ ] First-run choice buttons stack correctly.
- [ ] Target cards are readable.
- [ ] Calendar is usable.
- [ ] Settings buttons are not cramped.
- [ ] No horizontal scrolling.

---

## 12. Release gate

A production deployment is allowed only if:

- [ ] npm run lint passes.
- [ ] npm run build passes.
- [ ] Git working tree is clean.
- [ ] Current commit is pushed to origin/main.
- [ ] Vercel production deployment succeeds.
- [ ] At least the fresh visitor, backup/import, and cloud sync cancel tests pass manually.

---

## Rollback

Stable rollback tag:

```powershell
git checkout v42b-cloud-activity-history
```

Latest production commit should be checked with:

```powershell
git log --oneline -5
git status
```
