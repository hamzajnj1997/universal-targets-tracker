"use client";

import type { TeamMember, WorkTarget } from "../../../lib/workOwnershipTypes";
import {
  filterTargetsForSearch,
  splitBoardTargets,
} from "../../../lib/workOwnershipRules";
import { TargetCard } from "./TargetCard";

type BoardMode = "board" | "my-work" | "completed";

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
};

type Section = {
  key: string;
  title: string;
  targets: WorkTarget[];
  accent: string;
  shell: string;
  emptyTitle: string;
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
}: LiveBoardProps) {
  const isSearching = searchQuery.trim().length > 0;
  const filteredTargets = filterTargetsForSearch(targets, searchQuery);
  const split = splitBoardTargets(filteredTargets, currentMember);

  const sections: Section[] =
    mode === "my-work"
      ? [
          {
            key: "my-work",
            title: "My Work",
            targets: split.myWork,
            accent: "bg-cyan-300",
            shell: "border-sky-100 bg-sky-50/80",
            emptyTitle: "Clear.",
          },
        ]
      : mode === "completed"
        ? [
            {
              key: "completed",
              title: "Completed",
              targets: split.completed,
              accent: "bg-emerald-300",
              shell: "border-emerald-100 bg-emerald-50/80",
              emptyTitle: "None.",
            },
          ]
        : [
            {
              key: "available",
              title: "Available",
              targets: split.available,
              accent: "bg-cyan-300",
              shell: "border-cyan-100 bg-cyan-50/80",
              emptyTitle: "Clear.",
            },
            {
              key: "my-work",
              title: "My Work",
              targets: split.myWork,
              accent: "bg-sky-300",
              shell: "border-sky-100 bg-sky-50/80",
              emptyTitle: "Clear.",
            },
            {
              key: "claimed-others",
              title: "Claimed by Others",
              targets: split.claimedByOthers,
              accent: "bg-violet-300",
              shell: "border-violet-100 bg-violet-50/80",
              emptyTitle: "Clear.",
            },
            {
              key: "blocked",
              title: "Blocked",
              targets: split.blocked,
              accent: "bg-amber-300",
              shell: "border-amber-100 bg-amber-50/80",
              emptyTitle: "Clear.",
            },
            {
              key: "completed",
              title: "Completed",
              targets: split.completed,
              accent: "bg-emerald-300",
              shell: "border-emerald-100 bg-emerald-50/80",
              emptyTitle: "None.",
            },
          ];
  const boardGridClass =
    mode === "board"
      ? "flex gap-3 overflow-x-auto pb-3"
      : "grid gap-4";
  const sectionScrollClass =
    mode === "board" ? "xl:max-h-[calc(100vh-190px)] xl:overflow-y-auto" : "";
  const sectionHeaderClass =
    mode === "board" ? "sticky top-0 z-10 -mx-2 -mt-2 bg-inherit px-3 pt-2" : "px-1";
  const sectionLayoutClass =
    mode === "board" ? "min-h-[360px] min-w-[280px] flex-1 basis-[280px] xl:min-w-[300px]" : "";

  return (
    <div className={boardGridClass}>
      {sections.map((section) => (
        <section
          key={section.key}
          className={`min-w-0 rounded-lg border p-2 shadow-sm ${section.shell} ${sectionScrollClass} ${sectionLayoutClass}`}
        >
          <div className={`mb-2 flex items-center justify-between gap-3 ${sectionHeaderClass}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${section.accent}`} />
                <h2 className="text-base font-bold text-slate-950">{section.title}</h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
              {section.targets.length}
            </span>
          </div>

          {section.targets.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-white/75 px-3 py-2">
              <p className="text-xs font-semibold text-slate-500">
                {isSearching ? "No matches." : section.emptyTitle}
              </p>
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
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
