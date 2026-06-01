"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  BoardCapabilities,
  TargetActivity,
  TargetChecklistItem,
  TargetNote,
  TeamMember,
  WorkTarget,
} from "../../../lib/workOwnershipTypes";
import {
  canArchiveTarget,
  canBlockTarget,
  canCompleteTarget,
  canContribute,
  canForceReleaseTarget,
  canReleaseTarget,
  canReopenTarget,
  formatDateLabel,
  formatRepeatLabel,
  formatRepeatWindowLabel,
  formatRelativeTime,
  getTargetDueState,
  memberName,
  statusLabel,
} from "../../../lib/workOwnershipRules";

export type TargetDrawerAction =
  | "claim"
  | "release"
  | "forceRelease"
  | "block"
  | "complete"
  | "reopen"
  | "archive";

type TargetDrawerProps = {
  target: WorkTarget;
  members: TeamMember[];
  activities: TargetActivity[];
  notes: TargetNote[];
  checklistItems: TargetChecklistItem[];
  capabilities: BoardCapabilities;
  currentMember: TeamMember | null;
  busy: boolean;
  onClose: () => void;
  onAction: (action: TargetDrawerAction, target: WorkTarget, reason?: string) => void;
  onAddNote: (target: WorkTarget, body: string) => void;
  onAddChecklistItem: (target: WorkTarget, title: string) => void;
  onToggleChecklistItem: (target: WorkTarget, itemId: string, isDone: boolean) => void;
  onDeleteChecklistItem: (target: WorkTarget, itemId: string) => void;
};

function initialsForName(name: string) {
  const words = name
    .replace(/@.*/, "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function TargetDrawer({
  target,
  members,
  activities,
  notes,
  checklistItems,
  capabilities,
  currentMember,
  busy,
  onClose,
  onAction,
  onAddNote,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
}: TargetDrawerProps) {
  const [releaseReason, setReleaseReason] = useState("");
  const [forceReason, setForceReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [checklistTitle, setChecklistTitle] = useState("");

  const targetActivities = activities.filter((activity) => activity.targetId === target.id);
  const targetNotes = notes
    .filter((note) => note.targetId === target.id)
    .toSorted(
      (firstNote, secondNote) =>
        new Date(firstNote.createdAt).getTime() - new Date(secondNote.createdAt).getTime()
    );
  const targetChecklistItems = checklistItems
    .filter((item) => item.targetId === target.id)
    .toSorted(
      (firstItem, secondItem) =>
        firstItem.sortOrder - secondItem.sortOrder ||
        new Date(firstItem.createdAt).getTime() - new Date(secondItem.createdAt).getTime()
    );
  const completedChecklistItems = targetChecklistItems.filter((item) => item.isDone).length;
  const checklistProgress =
    targetChecklistItems.length > 0
      ? Math.round((completedChecklistItems / targetChecklistItems.length) * 100)
      : 0;
  const currentMemberName = currentMember?.name ?? "You";
  const currentMemberInitials = initialsForName(currentMemberName);
  const dueState = getTargetDueState(target);
  const repeatLabel = formatRepeatLabel(target);
  const repeatWindowLabel = formatRepeatWindowLabel(target);
  const canEditTargetDetails = canContribute(currentMember);
  const canRelease = canReleaseTarget(currentMember, target);
  const canForceRelease = canForceReleaseTarget(currentMember, target);
  const canBlock = capabilities.supportsBlockers && canBlockTarget(currentMember, target);
  const canComplete = canCompleteTarget(currentMember, target);
  const canReopen =
    capabilities.schemaMode === "workOwnership" &&
    target.status === "completed" &&
    canReopenTarget(currentMember);
  const canArchive = target.status !== "archived" && canArchiveTarget(currentMember);
  const titleId = `target-drawer-title-${target.id}`;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function submitNote() {
    if (!noteBody.trim()) return;
    onAddNote(target, noteBody);
    setNoteBody("");
  }

  function submitChecklistItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checklistTitle.trim()) return;
    onAddChecklistItem(target, checklistTitle);
    setChecklistTitle("");
  }

  return (
    <div
      className="fixed inset-0 z-50 grid bg-slate-950/35 backdrop-blur-sm lg:grid-cols-[1fr_560px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close target details"
        onClick={onClose}
        className="hidden lg:block"
      />
      <aside className="h-full overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-500">
              Target details
            </p>
            <h2
              id={titleId}
              className="mt-2 break-words text-2xl font-bold text-slate-950"
            >
              {target.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                {statusLabel(target.status)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                {target.priority}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                Due {formatDateLabel(target.dueDate)}
              </span>
              {repeatLabel ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                  {repeatLabel}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Close
          </button>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-semibold text-slate-950">{statusLabel(target.status)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Priority</dt>
            <dd className="font-semibold capitalize text-slate-950">{target.priority}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Due date</dt>
            <dd className="font-semibold text-slate-950">{formatDateLabel(target.dueDate)}</dd>
          </div>
          {repeatLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Repeat</dt>
              <dd className="text-right font-semibold text-slate-950">{repeatLabel}</dd>
            </div>
          ) : null}
          {repeatWindowLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Repeat window</dt>
              <dd className="text-right font-semibold text-slate-950">
                {repeatWindowLabel}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Claimed by</dt>
            <dd className="text-right font-semibold text-slate-950">
              {memberName(target.claimedById, members)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Claim age</dt>
            <dd className="font-semibold text-slate-950">{formatRelativeTime(target.claimedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Completed by</dt>
            <dd className="text-right font-semibold text-slate-950">
              {memberName(target.completedById, members, "Not completed")}
            </dd>
          </div>
        </dl>

        {target.description ? (
          <section className="mt-5">
            <h3 className="text-sm font-semibold text-slate-950">Details</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {target.description}
            </p>
          </section>
        ) : null}

        {dueState === "overdue" || dueState === "today" ? (
          <section
            className={
              dueState === "overdue"
                ? "mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4"
                : "mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4"
            }
          >
            <h3
              className={
                dueState === "overdue"
                  ? "text-sm font-semibold text-rose-800"
                  : "text-sm font-semibold text-amber-800"
              }
            >
              {dueState === "overdue" ? "Overdue target" : "Due today"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Due date: {formatDateLabel(target.dueDate)}
            </p>
          </section>
        ) : null}

        {target.blockedReason ? (
          <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-800">Block reason</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">{target.blockedReason}</p>
          </section>
        ) : null}

        <section className="mt-5 rounded-xl border border-sky-100 bg-sky-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-950">Checklist</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {targetChecklistItems.length === 0
                  ? "No steps yet"
                  : `${completedChecklistItems}/${targetChecklistItems.length} done`}
              </p>
            </div>
            <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-black text-sky-800">
              {checklistProgress}%
            </span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${Math.max(targetChecklistItems.length ? 6 : 0, checklistProgress)}%` }}
            />
          </div>

          {capabilities.supportsChecklists && canEditTargetDetails ? (
            <>
              <form onSubmit={submitChecklistItem} className="mt-3 flex gap-2">
                <input
                  value={checklistTitle}
                  onChange={(event) => setChecklistTitle(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-sky-100 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400"
                  placeholder="Add a step"
                />
                <button
                  type="submit"
                  disabled={busy || !checklistTitle.trim()}
                  className="rounded-md bg-sky-500 px-3 py-2 text-sm font-black text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add
                </button>
              </form>

              <div className="mt-3 space-y-2">
                {targetChecklistItems.length === 0 ? (
                  <p className="rounded-md border border-dashed border-sky-200 bg-white p-3 text-sm text-slate-500">
                    Add the steps that make this target actually finished.
                  </p>
                ) : (
                  targetChecklistItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={item.isDone}
                        disabled={busy}
                        onChange={(event) =>
                          onToggleChecklistItem(target, item.id, event.target.checked)
                        }
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
                        aria-label={`Mark ${item.title} ${item.isDone ? "not done" : "done"}`}
                      />
                      <span
                        className={
                          item.isDone
                            ? "min-w-0 flex-1 truncate text-sm font-semibold text-slate-400 line-through"
                            : "min-w-0 flex-1 truncate text-sm font-semibold text-slate-800"
                        }
                      >
                        {item.title}
                      </span>
                      {item.completedAt ? (
                        <span className="hidden text-[11px] font-bold text-emerald-700 sm:inline">
                          {formatRelativeTime(item.completedAt)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDeleteChecklistItem(target, item.id)}
                        disabled={busy}
                        className="rounded-md px-2 py-1 text-xs font-bold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : capabilities.supportsChecklists ? (
            <p className="mt-3 rounded-lg border border-sky-100 bg-white p-3 text-sm leading-6 text-slate-500">
              Guests can view checklist progress but cannot change it.
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-sky-100 bg-white p-3 text-sm leading-6 text-slate-500">
              Checklists need the checklist database migration.
            </p>
          )}
        </section>

        <section className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Actions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {canComplete ? (
              <button
                type="button"
                onClick={() => onAction("complete", target)}
                disabled={busy}
                className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Complete
              </button>
            ) : null}
            {target.status === "available" ? (
              <button
                type="button"
                onClick={() => onAction("claim", target)}
                disabled={busy}
                className="rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Claim
              </button>
            ) : null}
            {canReopen ? (
              <button
                type="button"
                onClick={() => onAction("reopen", target)}
                disabled={busy}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reopen
              </button>
            ) : null}
            {canArchive ? (
              <button
                type="button"
                onClick={() => onAction("archive", target)}
                disabled={busy}
                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Archive
              </button>
            ) : null}
          </div>

          {canRelease ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <label className="text-xs font-semibold text-slate-400" htmlFor="release-reason">
                Release note
              </label>
              <textarea
                id="release-reason"
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-400 focus:bg-white"
                placeholder="Optional: why are you releasing it?"
              />
              <button
                type="button"
                onClick={() => onAction("release", target, releaseReason)}
                disabled={busy}
                className="mt-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Release
              </button>
            </div>
          ) : null}

          {canBlock ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label className="text-xs font-semibold text-amber-800" htmlFor="block-reason">
                Block reason
              </label>
              <textarea
                id="block-reason"
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400"
                placeholder="Required: what is stopping this?"
              />
              <button
                type="button"
                onClick={() => onAction("block", target, blockReason)}
                disabled={busy || !blockReason.trim()}
                className="mt-2 rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Block
              </button>
            </div>
          ) : null}

          {!capabilities.supportsBlockers && target.status === "claimed" ? (
            <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-500">
              Blocking requires the upgraded work ownership database. Claim,
              release, and complete still work in legacy mode.
            </p>
          ) : null}

          {canForceRelease ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <label className="text-xs font-semibold text-rose-800" htmlFor="force-reason">
                Owner/admin release reason
              </label>
              <textarea
                id="force-reason"
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-rose-400"
                placeholder="Required: why should this be released?"
              />
              <button
                type="button"
                onClick={() => onAction("forceRelease", target, forceReason)}
                disabled={busy || !forceReason.trim()}
                className="mt-2 rounded-md bg-rose-400 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Force release
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-950">Comments</h3>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
              {targetNotes.length}
            </span>
          </div>
          {capabilities.supportsNotes && canEditTargetDetails ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-800 ring-1 ring-sky-200">
                {currentMemberInitials}
              </span>
              <div className="min-w-0 flex-1">
                <textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder="Write a comment..."
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={submitNote}
                    disabled={busy || !noteBody.trim()}
                    className="rounded-full bg-sky-500 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          ) : capabilities.supportsNotes ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-500">
              Guests can view comments but cannot post.
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-500">
              Notes require the upgraded work ownership database.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {targetNotes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                No comments yet.
              </p>
            ) : (
              targetNotes.map((note) => {
                const authorName = memberName(note.userId, members, "Team member");
                const authorInitials = initialsForName(authorName);
                const isMine = currentMember?.id === note.userId;

                return (
                  <div
                    key={note.id}
                    className={`flex items-start gap-2 ${isMine ? "flex-row-reverse" : ""}`}
                  >
                    <span
                      title={authorName}
                      className={
                        isMine
                          ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200"
                          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600 ring-1 ring-slate-200"
                      }
                    >
                      {authorInitials}
                    </span>
                    <div className={`min-w-0 max-w-[82%] ${isMine ? "text-right" : ""}`}>
                      <div
                        className={
                          isMine
                            ? "rounded-2xl rounded-tr-md bg-sky-500 px-3 py-2 text-left text-sm leading-6 text-white shadow-sm"
                            : "rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 shadow-sm"
                        }
                      >
                        <p className="whitespace-pre-wrap break-words">{note.body}</p>
                      </div>
                      <p className="mt-1 px-1 text-[11px] font-semibold text-slate-500">
                        {authorName} · {formatRelativeTime(note.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-slate-950">Audit history</h3>
          {!capabilities.supportsActivityLog ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-500">
              Legacy mode shows completion history from progress logs. Full
              claim, release, block, and note audit records require the database
              upgrade.
            </p>
          ) : null}
          <div className="mt-3 space-y-3">
            {targetActivities.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No activity recorded yet.
              </p>
            ) : (
              targetActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">
                      {activity.action.replaceAll("_", " ")}
                    </p>
                    <time className="text-xs text-slate-500">
                      {formatRelativeTime(activity.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-slate-400">
                    {memberName(activity.actorId, members, "System")}
                    {activity.note ? ` - ${activity.note}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
