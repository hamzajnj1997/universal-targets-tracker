"use client";

import { useState, type DragEvent } from "react";
import type { TeamMember, WorkTarget } from "../../../lib/workOwnershipTypes";
import {
  filterTargetsForSearch,
  splitBoardTargets,
} from "../../../lib/workOwnershipRules";
import { TargetCard } from "./TargetCard";

type BoardMode = "board" | "my-work" | "completed";
type BoardLaneKey = "available" | "my-work" | "claimed-others" | "blocked" | "completed";

type LiveBoardProps = {
  mode: BoardMode;
  targets: WorkTarget[];
  members: TeamMember[];
  currentMember: TeamMember | null;
  searchQuery: string;
  busyTargetId: string | null;
  onClaim: (target: WorkTarget) => void;
  onComplete: (target: WorkTarget) => void;
  onOpenTarget: (target: WorkTarget) => void;
  onCreateTarget?: () => void;
  onMoveTarget?: (target: WorkTarget, lane: BoardLaneKey) => void;
};

type Section = {
  key: BoardLaneKey;
  title: string;
  targets: WorkTarget[];
  accent: string;
  shell: string;
  emptyTitle: string;
  emptyBody: string;
  emptyActionLabel?: string;
};

export function LiveBoard({
  mode,
  targets,
  members,
  currentMember,
  searchQuery,
  busyTargetId,
  onClaim,
  onComplete,
  onOpenTarget,
  onCreateTarget,
  onMoveTarget,
}: LiveBoardProps) {
  const [draggingTargetId, setDraggingTargetId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<BoardLaneKey | null>(null);
  const isSearching = searchQuery.trim().length > 0;
  const filteredTargets = filterTargetsForSearch(targets, searchQuery);
  const split = splitBoardTargets(filteredTargets, currentMember);
  const claimedByMeTargets = split.myWork.filter(
    (target) => target.status === "claimed"
  );
  const draggingTarget =
    filteredTargets.find((target) => target.id === draggingTargetId) ?? null;
  const isManager =
    currentMember?.role === "owner" || currentMember?.role === "admin";

  function canDropInLane(target: WorkTarget | null, lane: BoardLaneKey) {
    if (!target || mode !== "board" || !onMoveTarget) return false;
    if (lane === "claimed-others" || lane === "blocked") return false;
    if (lane === "my-work") {
      return target.status === "available" || (target.status === "completed" && isManager);
    }
    if (lane === "available") {
      if (target.status === "completed" || target.status === "blocked") return isManager;
      return target.status === "claimed" && (target.claimedById === currentMember?.id || isManager);
    }
    return (
      (target.status === "claimed" || target.status === "blocked") &&
      (target.claimedById === currentMember?.id || isManager)
    );
  }

  function handleDragStart(target: WorkTarget, event: DragEvent<HTMLElement>) {
    if (mode !== "board") return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", target.id);
    setDraggingTargetId(target.id);
  }

  function handleDragOver(lane: BoardLaneKey, event: DragEvent<HTMLElement>) {
    if (!canDropInLane(draggingTarget, lane)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverLane(lane);
  }

  function handleDrop(lane: BoardLaneKey, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const targetId = event.dataTransfer.getData("text/plain") || draggingTargetId;
    const target = filteredTargets.find((item) => item.id === targetId) ?? null;
    setDragOverLane(null);
    setDraggingTargetId(null);
    if (!target || !canDropInLane(target, lane)) return;
    onMoveTarget?.(target, lane);
  }

  function handleDragEnd() {
    setDragOverLane(null);
    setDraggingTargetId(null);
  }

  const sections: Section[] =
    mode === "my-work"
      ? [
          {
            key: "my-work",
            title: "My Work",
            targets: split.myWork,
            accent: "bg-cyan-300",
            shell: "border-sky-100 bg-sky-50/50",
            emptyTitle: "No work assigned.",
            emptyBody: "Claim a target from Available when you are ready for the next job.",
          },
        ]
      : mode === "completed"
        ? [
            {
              key: "completed",
              title: "Completed",
              targets: split.completed,
              accent: "bg-emerald-300",
              shell: "border-emerald-100 bg-emerald-50/50",
              emptyTitle: "No completed work yet.",
              emptyBody: "Completed targets will collect here after the team finishes them.",
            },
          ]
        : [
            {
              key: "available",
              title: "Available",
              targets: split.available,
              accent: "bg-cyan-500",
              shell: "border-cyan-100 bg-cyan-50/45",
              emptyTitle: "No targets available.",
              emptyBody: "Create the next target to get the team moving.",
              emptyActionLabel: "Create target",
            },
            {
              key: "my-work",
              title: "My Work",
              targets: claimedByMeTargets,
              accent: "bg-sky-500",
              shell: "border-sky-100 bg-sky-50/45",
              emptyTitle: "Nothing claimed.",
              emptyBody: "Claim a target from Available to start working.",
            },
            {
              key: "claimed-others",
              title: "Claimed by Others",
              targets: split.claimedByOthers,
              accent: "bg-violet-500",
              shell: "border-violet-100 bg-violet-50/45",
              emptyTitle: "No one else is holding work.",
              emptyBody: "Claimed targets from other team members appear here.",
            },
            {
              key: "blocked",
              title: "Blocked",
              targets: split.blocked,
              accent: "bg-amber-500",
              shell: "border-amber-100 bg-amber-50/45",
              emptyTitle: "No blockers.",
              emptyBody: "Blocked work appears here with its reason.",
            },
            {
              key: "completed",
              title: "Completed",
              targets: split.completed,
              accent: "bg-emerald-500",
              shell: "border-emerald-100 bg-emerald-50/45",
              emptyTitle: "Nothing completed yet.",
              emptyBody: "Finished targets move here after completion.",
            },
          ];
  const boardGridClass =
    mode === "board"
      ? "flex gap-3 overflow-x-auto pb-4"
      : "grid gap-4";
  const sectionScrollClass =
    mode === "board" ? "xl:max-h-[calc(100vh-190px)] xl:overflow-y-auto" : "";
  const sectionHeaderClass =
    mode === "board" ? "sticky top-0 z-10 -mx-2 -mt-2 bg-inherit px-3 pt-2" : "px-1";
  const sectionLayoutClass =
    mode === "board" ? "min-h-[360px] min-w-[320px] shrink-0 basis-[320px] xl:min-w-[340px] xl:basis-[340px]" : "";

  return (
    <div className={boardGridClass}>
      {sections.map((section) => (
        <section
          key={section.key}
          onDragOver={(event) => handleDragOver(section.key, event)}
          onDragLeave={() => setDragOverLane((lane) => (lane === section.key ? null : lane))}
          onDrop={(event) => handleDrop(section.key, event)}
          className={`min-w-0 rounded-lg border p-2 shadow-sm transition ${section.shell} ${sectionScrollClass} ${sectionLayoutClass} ${dragOverLane === section.key ? "ring-2 ring-sky-500 ring-offset-2" : ""}`}
        >
          <div className={`mb-2 flex items-center justify-between gap-3 ${sectionHeaderClass}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${section.accent}`} />
                <h2 className="text-base font-bold text-slate-950">{section.title}</h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
              {section.targets.length}
            </span>
          </div>

          {section.targets.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3">
              <p className="text-sm font-bold text-slate-800">
                {isSearching ? "No matches." : section.emptyTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isSearching
                  ? "Try a different title, owner, priority, or due date."
                  : section.emptyBody}
              </p>
              {!isSearching && section.emptyActionLabel && onCreateTarget ? (
                <button
                  type="button"
                  onClick={onCreateTarget}
                  className="mt-3 rounded-md bg-sky-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-600"
                >
                  {section.emptyActionLabel}
                </button>
              ) : null}
            </div>
          ) : (
            <div className={mode === "board" ? "grid gap-2" : "grid gap-2 lg:grid-cols-2 2xl:grid-cols-3"}>
              {section.targets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  members={members}
                  currentMember={currentMember}
                  busy={busyTargetId === target.id}
                  onClaim={onClaim}
                  onComplete={onComplete}
                  onOpen={onOpenTarget}
                  draggable={mode === "board"}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
