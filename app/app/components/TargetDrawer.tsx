"use client";

import { useState } from "react";
import type {
  BoardCapabilities,
  TargetActivity,
  TargetNote,
  TeamMember,
  WorkTarget,
} from "../../../lib/workOwnershipTypes";
import {
  canArchiveTarget,
  canBlockTarget,
  canCompleteTarget,
  canForceReleaseTarget,
  canReleaseTarget,
  canReopenTarget,
  formatDateLabel,
  formatRelativeTime,
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
  capabilities: BoardCapabilities;
  currentMember: TeamMember | null;
  busy: boolean;
  onClose: () => void;
  onAction: (action: TargetDrawerAction, target: WorkTarget, reason?: string) => void;
  onAddNote: (target: WorkTarget, body: string) => void;
};

export function TargetDrawer({
  target,
  members,
  activities,
  notes,
  capabilities,
  currentMember,
  busy,
  onClose,
  onAction,
  onAddNote,
}: TargetDrawerProps) {
  const [releaseReason, setReleaseReason] = useState("");
  const [forceReason, setForceReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const targetActivities = activities.filter((activity) => activity.targetId === target.id);
  const targetNotes = notes.filter((note) => note.targetId === target.id);
  const canRelease = canReleaseTarget(currentMember, target);
  const canForceRelease = canForceReleaseTarget(currentMember, target);
  const canBlock = capabilities.supportsBlockers && canBlockTarget(currentMember, target);
  const canComplete = canCompleteTarget(currentMember, target);
  const canReopen = target.status === "completed" && canReopenTarget(currentMember);
  const canArchive = target.status !== "archived" && canArchiveTarget(currentMember);

  function submitNote() {
    if (!noteBody.trim()) return;
    onAddNote(target, noteBody);
    setNoteBody("");
  }

  return (
    <div className="fixed inset-0 z-50 grid bg-slate-950/70 backdrop-blur-sm lg:grid-cols-[1fr_520px]">
      <button
        type="button"
        aria-label="Close target details"
        onClick={onClose}
        className="hidden lg:block"
      />
      <aside className="h-full overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Target
            </p>
            <h2 className="mt-2 break-words text-2xl font-bold text-white">
              {target.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
          >
            Close
          </button>
        </div>

        <dl className="mt-6 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-semibold text-white">{statusLabel(target.status)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Priority</dt>
            <dd className="font-semibold capitalize text-white">{target.priority}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Due date</dt>
            <dd className="font-semibold text-white">{formatDateLabel(target.dueDate)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Claimed by</dt>
            <dd className="text-right font-semibold text-white">
              {memberName(target.claimedById, members)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Claim age</dt>
            <dd className="font-semibold text-white">{formatRelativeTime(target.claimedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Completed by</dt>
            <dd className="text-right font-semibold text-white">
              {memberName(target.completedById, members, "Not completed")}
            </dd>
          </div>
        </dl>

        {target.description ? (
          <section className="mt-5">
            <h3 className="text-sm font-semibold text-white">Details</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300">
              {target.description}
            </p>
          </section>
        ) : null}

        {target.blockedReason ? (
          <section className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
            <h3 className="text-sm font-semibold text-amber-100">Block reason</h3>
            <p className="mt-2 text-sm leading-6 text-amber-50">{target.blockedReason}</p>
          </section>
        ) : null}

        <section className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Actions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {canComplete ? (
              <button
                type="button"
                onClick={() => onAction("complete", target)}
                disabled={busy}
                className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Complete
              </button>
            ) : null}
            {target.status === "available" ? (
              <button
                type="button"
                onClick={() => onAction("claim", target)}
                disabled={busy}
                className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Claim
              </button>
            ) : null}
            {canReopen ? (
              <button
                type="button"
                onClick={() => onAction("reopen", target)}
                disabled={busy}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reopen
              </button>
            ) : null}
            {canArchive ? (
              <button
                type="button"
                onClick={() => onAction("archive", target)}
                disabled={busy}
                className="rounded-md border border-rose-400/40 px-3 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Archive
              </button>
            ) : null}
          </div>

          {canRelease ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <label className="text-xs font-semibold text-slate-400" htmlFor="release-reason">
                Release reason
              </label>
              <textarea
                id="release-reason"
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                placeholder="Optional"
              />
              <button
                type="button"
                onClick={() => onAction("release", target, releaseReason)}
                disabled={busy}
                className="mt-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Release
              </button>
            </div>
          ) : null}

          {canBlock ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
              <label className="text-xs font-semibold text-amber-100" htmlFor="block-reason">
                Block reason
              </label>
              <textarea
                id="block-reason"
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-amber-300/40 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-200"
                placeholder="Required"
              />
              <button
                type="button"
                onClick={() => onAction("block", target, blockReason)}
                disabled={busy || !blockReason.trim()}
                className="mt-2 rounded-md bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Block
              </button>
            </div>
          ) : null}

          {!capabilities.supportsBlockers && target.status === "claimed" ? (
            <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm leading-6 text-slate-400">
              Blocking requires the upgraded work ownership database. Claim,
              release, and complete still work in legacy mode.
            </p>
          ) : null}

          {canForceRelease ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3">
              <label className="text-xs font-semibold text-rose-100" htmlFor="force-reason">
                Force release reason
              </label>
              <textarea
                id="force-reason"
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-rose-300/40 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-rose-200"
                placeholder="Required for owner/admin"
              />
              <button
                type="button"
                onClick={() => onAction("forceRelease", target, forceReason)}
                disabled={busy || !forceReason.trim()}
                className="mt-2 rounded-md bg-rose-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Force release
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-white">Notes</h3>
          {capabilities.supportsNotes ? (
            <div className="mt-3 grid gap-2">
              <textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                placeholder="Add a note"
              />
              <button
                type="button"
                onClick={submitNote}
                disabled={busy || !noteBody.trim()}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add note
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm leading-6 text-slate-400">
              Notes require the upgraded work ownership database.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {targetNotes.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-400">
                No notes yet.
              </p>
            ) : (
              targetNotes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                >
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {note.body}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {memberName(note.userId, members, "Team member")} -{" "}
                    {formatRelativeTime(note.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-white">Audit history</h3>
          {!capabilities.supportsActivityLog ? (
            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm leading-6 text-slate-400">
              Legacy mode shows completion history from progress logs. Full
              claim, release, block, and note audit records require the database
              upgrade.
            </p>
          ) : null}
          <div className="mt-3 space-y-3">
            {targetActivities.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-400">
                No activity recorded yet.
              </p>
            ) : (
              targetActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">
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
