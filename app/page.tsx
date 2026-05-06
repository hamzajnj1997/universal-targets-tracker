"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

type Frequency = "daily" | "weekly" | "monthly";
type Priority = "low" | "medium" | "high" | "urgent";
type StatusFilter = "all" | "onTrack" | "close" | "behind";

type Member = {
  id: string;
  name: string;
  role: string;
};

type Target = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  ownerId: string;
  frequency: Frequency;
  targetAmount: number;
  unit: string;
  startDate: string;
};

type ProgressLog = {
  id: string;
  targetId: string;
  date: string;
  achievedAmount: number;
  createdAt: string;
};

type SavedAppState = {
  members: Member[];
  targets: Target[];
  logs: ProgressLog[];
  lastSavedAt?: string;
};

type BackupFile = Partial<SavedAppState> & {
  exportedAt?: string;
  appName?: string;
  version?: number;
  selectedDate?: string;
  calendarMonth?: string;
};

const STORAGE_KEY = "universal-targets-tracker-demo-v4";

const roleOptions = [
  "Owner",
  "Admin",
  "Parent",
  "Teacher",
  "Manager",
  "Member",
  "Student",
  "Child",
  "Viewer",
];

const suggestedCategories = [
  "General",
  "School",
  "Business",
  "Content",
  "Health",
  "Family",
  "Sales",
  "Admin",
  "Personal",
  "Finance",
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "behind", label: "Behind" },
  { value: "close", label: "Close" },
  { value: "onTrack", label: "On Track" },
];

const initialMembers: Member[] = [
  { id: "me", name: "Me", role: "Owner" },
  { id: "family", name: "Family Member", role: "Member" },
  { id: "team", name: "Team Member", role: "Member" },
  { id: "student", name: "Student", role: "Student" },
];

function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayISO() {
  return formatDateISO(new Date());
}

const initialTargets: Target[] = [
  {
    id: "video",
    title: "Make video",
    description:
      "Counts as done when the video is finished and ready to publish.",
    category: "Content",
    priority: "high",
    ownerId: "me",
    frequency: "daily",
    targetAmount: 1,
    unit: "video",
    startDate: todayISO(),
  },
  {
    id: "ideas",
    title: "Plan content ideas",
    description:
      "Each idea should include a clear topic, hook, and basic outline.",
    category: "Content",
    priority: "medium",
    ownerId: "me",
    frequency: "weekly",
    targetAmount: 7,
    unit: "ideas",
    startDate: todayISO(),
  },
  {
    id: "calls",
    title: "Sales calls",
    description: "Only completed calls count. Missed calls carry forward.",
    category: "Sales",
    priority: "urgent",
    ownerId: "team",
    frequency: "daily",
    targetAmount: 10,
    unit: "calls",
    startDate: todayISO(),
  },
  {
    id: "reading",
    title: "Read pages",
    description: "Pages count when they are actually read, not just opened.",
    category: "School",
    priority: "medium",
    ownerId: "student",
    frequency: "daily",
    targetAmount: 5,
    unit: "pages",
    startDate: todayISO(),
  },
];

function toDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00`);
}

function isValidDateISO(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetween(startDate: string, endDate: string) {
  return Math.floor(
    (toDate(endDate).getTime() - toDate(startDate).getTime()) / 86400000
  );
}

function monthsBetween(startDate: string, endDate: string) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth()
  );
}

function addDays(dateISO: string, days: number) {
  const date = toDate(dateISO);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

function addMonths(dateISO: string, months: number) {
  const date = toDate(dateISO);
  date.setMonth(date.getMonth() + months);
  return formatDateISO(date);
}

function monthStartISO(dateISO: string) {
  const date = toDate(dateISO);
  date.setDate(1);
  return formatDateISO(date);
}

function getMonthLabel(dateISO: string) {
  return toDate(dateISO).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getDateLabel(dateISO: string) {
  return toDate(dateISO).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getShortDayLabel(dateISO: string) {
  return toDate(dateISO).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function getMondayBasedWeekday(date: Date) {
  return (date.getDay() + 6) % 7;
}

function isFrequency(value: unknown): value is Frequency {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function isPriority(value: unknown): value is Priority {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "urgent"
  );
}

function periodsDue(target: Target, dateISO: string) {
  if (dateISO < target.startDate) return 0;

  if (target.frequency === "daily") {
    return daysBetween(target.startDate, dateISO) + 1;
  }

  if (target.frequency === "weekly") {
    return Math.floor(daysBetween(target.startDate, dateISO) / 7) + 1;
  }

  return monthsBetween(target.startDate, dateISO) + 1;
}

function getStatus(pending: number, progress: number) {
  if (pending === 0) return "On Track";
  if (progress >= 80) return "Close";
  return "Behind";
}

function statusClass(status: string) {
  if (status === "Behind") return "bg-red-500/20 text-red-300";
  if (status === "Close") return "bg-yellow-500/20 text-yellow-300";
  return "bg-emerald-500/20 text-emerald-300";
}

function priorityLabel(priority: Priority) {
  return (
    priorityOptions.find((option) => option.value === priority)?.label ??
    "Medium"
  );
}

function priorityRank(priority: Priority) {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function priorityClass(priority: Priority) {
  if (priority === "urgent") {
    return "bg-red-500/25 text-red-200 border-red-400/30";
  }

  if (priority === "high") {
    return "bg-orange-500/25 text-orange-200 border-orange-400/30";
  }

  if (priority === "medium") {
    return "bg-blue-500/20 text-blue-200 border-blue-400/30";
  }

  return "bg-slate-500/20 text-slate-200 border-slate-400/30";
}

function statusMatchesFilter(status: string, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "behind") return status === "Behind";
  if (filter === "close") return status === "Close";
  if (filter === "onTrack") return status === "On Track";
  return true;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatSavedTime(value: string | null) {
  if (!value) return "Not saved yet";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Home() {
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(monthStartISO(todayISO()));
  const [selectedMemberId, setSelectedMemberId] = useState("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasLoadedSavedData, setHasLoadedSavedData] = useState(false);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Member");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("tasks");
  const [newFrequency, setNewFrequency] = useState<Frequency>("daily");
  const [newOwnerId, setNewOwnerId] = useState("me");

  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(
    {}
  );

  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editOwnerId, setEditOwnerId] = useState("me");
  const [editFrequency, setEditFrequency] = useState<Frequency>("daily");
  const [editAmount, setEditAmount] = useState(1);
  const [editUnit, setEditUnit] = useState("tasks");

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberRole, setEditMemberRole] = useState("Member");

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDate, setEditLogDate] = useState(todayISO());
  const [editLogAmount, setEditLogAmount] = useState(1);

  const categoryOptions = useMemo(() => {
    const currentCategories = targets
      .map((target) => target.category || "General")
      .filter(Boolean);

    return Array.from(
      new Set([...suggestedCategories, ...currentCategories])
    ).sort((a, b) => a.localeCompare(b));
  }, [targets]);

  function normalizeMembers(rawMembers: unknown[]): Member[] {
    return rawMembers
      .map((item) => item as Partial<Member>)
      .filter((member) => typeof member.id === "string")
      .map((member) => ({
        id: member.id as string,
        name:
          typeof member.name === "string" && member.name.trim()
            ? member.name.trim()
            : "Unnamed member",
        role:
          typeof member.role === "string" && member.role.trim()
            ? member.role.trim()
            : "Member",
      }));
  }

  function normalizeTargets(rawTargets: unknown[]): Target[] {
    return rawTargets
      .map((item) => item as Partial<Target>)
      .filter((target) => typeof target.id === "string")
      .map((target) => ({
        id: target.id as string,
        title:
          typeof target.title === "string" && target.title.trim()
            ? target.title.trim()
            : "Untitled target",
        description:
          typeof target.description === "string" ? target.description : "",
        category:
          typeof target.category === "string" && target.category.trim()
            ? target.category.trim()
            : "General",
        priority: isPriority(target.priority) ? target.priority : "medium",
        ownerId:
          typeof target.ownerId === "string" && target.ownerId
            ? target.ownerId
            : "me",
        frequency: isFrequency(target.frequency) ? target.frequency : "daily",
        targetAmount:
          typeof target.targetAmount === "number" && target.targetAmount > 0
            ? target.targetAmount
            : 1,
        unit:
          typeof target.unit === "string" && target.unit.trim()
            ? target.unit.trim()
            : "tasks",
        startDate: isValidDateISO(target.startDate)
          ? (target.startDate as string)
          : todayISO(),
      }));
  }

  function normalizeLogs(rawLogs: unknown[]): ProgressLog[] {
    return rawLogs
      .map((item) => item as Partial<ProgressLog>)
      .filter(
        (log) => typeof log.id === "string" && typeof log.targetId === "string"
      )
      .map((log) => ({
        id: log.id as string,
        targetId: log.targetId as string,
        date: isValidDateISO(log.date) ? (log.date as string) : todayISO(),
        achievedAmount:
          typeof log.achievedAmount === "number" && log.achievedAmount > 0
            ? log.achievedAmount
            : 1,
        createdAt:
          typeof log.createdAt === "string" && log.createdAt
            ? log.createdAt
            : `${
                isValidDateISO(log.date) ? log.date : todayISO()
              }T00:00:00.000Z`,
      }));
  }

  useEffect(() => {
    const savedData = window.localStorage.getItem(STORAGE_KEY);

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData) as SavedAppState;

        if (Array.isArray(parsedData.members)) {
          setMembers(normalizeMembers(parsedData.members));
        }

        if (Array.isArray(parsedData.targets)) {
          setTargets(normalizeTargets(parsedData.targets));
        }

        if (Array.isArray(parsedData.logs)) {
          setLogs(normalizeLogs(parsedData.logs));
        }

        if (typeof parsedData.lastSavedAt === "string") {
          setLastSavedAt(parsedData.lastSavedAt);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHasLoadedSavedData(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedData) return;

    const savedAt = new Date().toISOString();
    setLastSavedAt(savedAt);

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        members,
        targets,
        logs,
        lastSavedAt: savedAt,
      })
    );
  }, [members, targets, logs, hasLoadedSavedData]);

  function calculateTargetSnapshot(target: Target, dateISO: string) {
    const owner = members.find((member) => member.id === target.ownerId);
    const required = periodsDue(target, dateISO) * target.targetAmount;

    const achieved = logs
      .filter((log) => log.targetId === target.id && log.date <= dateISO)
      .reduce((sum, log) => sum + log.achievedAmount, 0);

    const pending = Math.max(0, required - achieved);
    const surplus = Math.max(0, achieved - required);
    const progress =
      required === 0
        ? 100
        : Math.min(100, Math.round((achieved / required) * 100));

    const recentLogs = logs
      .filter((log) => log.targetId === target.id)
      .slice()
      .sort((a, b) =>
        (b.createdAt || b.date).localeCompare(a.createdAt || a.date)
      )
      .slice(0, 4);

    return {
      target,
      owner,
      required,
      achieved,
      pending,
      surplus,
      progress,
      recentLogs,
      status: getStatus(pending, progress),
    };
  }

  function rowMatchesFilters(row: ReturnType<typeof calculateTargetSnapshot>) {
    const query = searchQuery.trim().toLowerCase();

    const memberMatches =
      selectedMemberId === "all" || row.target.ownerId === selectedMemberId;

    const priorityMatches =
      priorityFilter === "all" || row.target.priority === priorityFilter;

    const statusMatches = statusMatchesFilter(row.status, statusFilter);

    const categoryMatches =
      categoryFilter === "all" || row.target.category === categoryFilter;

    const searchableText = [
      row.target.title,
      row.target.description,
      row.target.category,
      row.target.unit,
      row.target.frequency,
      priorityLabel(row.target.priority),
      row.owner?.name ?? "",
      row.owner?.role ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const searchMatches = !query || searchableText.includes(query);

    return (
      memberMatches &&
      priorityMatches &&
      statusMatches &&
      categoryMatches &&
      searchMatches
    );
  }

  function calculateDaySnapshot(dateISO: string) {
    const rows = targets
      .map((target) => calculateTargetSnapshot(target, dateISO))
      .filter(rowMatchesFilters);

    const required = rows.reduce((sum, row) => sum + row.required, 0);
    const achieved = rows.reduce((sum, row) => sum + row.achieved, 0);
    const pending = rows.reduce((sum, row) => sum + row.pending, 0);
    const progress =
      required === 0
        ? 100
        : Math.min(100, Math.round((achieved / required) * 100));

    return {
      date: dateISO,
      required,
      achieved,
      pending,
      progress,
      status: getStatus(pending, progress),
    };
  }

  const dashboard = useMemo(() => {
    return targets.map((target) =>
      calculateTargetSnapshot(target, selectedDate)
    );
  }, [targets, logs, selectedDate, members]);

  const visibleDashboard = useMemo(() => {
    return dashboard
      .filter(rowMatchesFilters)
      .slice()
      .sort((a, b) => {
        const priorityDifference =
          priorityRank(b.target.priority) - priorityRank(a.target.priority);

        if (priorityDifference !== 0) return priorityDifference;

        const pendingDifference = b.pending - a.pending;

        if (pendingDifference !== 0) return pendingDifference;

        return a.target.title.localeCompare(b.target.title);
      });
  }, [
    dashboard,
    selectedMemberId,
    searchQuery,
    priorityFilter,
    statusFilter,
    categoryFilter,
    members,
  ]);

  const categoryOverview = useMemo(() => {
    const groups = new Map<
      string,
      {
        category: string;
        targetCount: number;
        pending: number;
        achieved: number;
        required: number;
      }
    >();

    for (const row of visibleDashboard) {
      const category = row.target.category || "General";
      const existing =
        groups.get(category) ??
        {
          category,
          targetCount: 0,
          pending: 0,
          achieved: 0,
          required: 0,
        };

      existing.targetCount += 1;
      existing.pending += row.pending;
      existing.achieved += row.achieved;
      existing.required += row.required;

      groups.set(category, existing);
    }

    return Array.from(groups.values())
      .map((group) => {
        const progress =
          group.required === 0
            ? 100
            : Math.min(
                100,
                Math.round((group.achieved / group.required) * 100)
              );

        return {
          ...group,
          progress,
          status: getStatus(group.pending, progress),
        };
      })
      .sort((a, b) => {
        const pendingDifference = b.pending - a.pending;

        if (pendingDifference !== 0) return pendingDifference;

        return a.category.localeCompare(b.category);
      });
  }, [visibleDashboard]);

  const memberOverview = useMemo(() => {
    return members.map((member) => {
      const memberRows = dashboard.filter(
        (row) => row.target.ownerId === member.id
      );

      const required = memberRows.reduce((sum, row) => sum + row.required, 0);
      const achieved = memberRows.reduce((sum, row) => sum + row.achieved, 0);
      const pending = memberRows.reduce((sum, row) => sum + row.pending, 0);
      const progress =
        required === 0
          ? 100
          : Math.min(100, Math.round((achieved / required) * 100));

      return {
        member,
        required,
        achieved,
        pending,
        progress,
        targetCount: memberRows.length,
        status: getStatus(pending, progress),
      };
    });
  }, [members, dashboard]);

  const dashboardInsights = useMemo(() => {
    const mostBehindCategory =
      categoryOverview.filter((category) => category.pending > 0)[0] ?? null;

    const memberGroups = new Map<
      string,
      {
        member: Member;
        targetCount: number;
        pending: number;
        achieved: number;
        required: number;
      }
    >();

    for (const row of visibleDashboard) {
      const member =
        members.find((item) => item.id === row.target.ownerId) ??
        row.owner ??
        {
          id: row.target.ownerId,
          name: "Unknown",
          role: "Unknown",
        };

      const existing =
        memberGroups.get(member.id) ??
        {
          member,
          targetCount: 0,
          pending: 0,
          achieved: 0,
          required: 0,
        };

      existing.targetCount += 1;
      existing.pending += row.pending;
      existing.achieved += row.achieved;
      existing.required += row.required;

      memberGroups.set(member.id, existing);
    }

    const mostBehindMember =
      Array.from(memberGroups.values())
        .filter((row) => row.pending > 0)
        .sort((a, b) => b.pending - a.pending)[0] ?? null;

    const overdueTargets = visibleDashboard
      .filter((row) => row.pending > 0)
      .slice()
      .sort((a, b) => {
        const priorityDifference =
          priorityRank(b.target.priority) - priorityRank(a.target.priority);

        if (priorityDifference !== 0) return priorityDifference;

        return b.pending - a.pending;
      });

    const highestPriorityOverdueTarget = overdueTargets[0] ?? null;
    const recommendedFocus = overdueTargets.slice(0, 3);

    return {
      mostBehindCategory,
      mostBehindMember,
      highestPriorityOverdueTarget,
      recommendedFocus,
    };
  }, [categoryOverview, visibleDashboard, members]);

  const selectedDaySummary = useMemo(() => {
    return calculateDaySnapshot(selectedDate);
  }, [
    selectedDate,
    selectedMemberId,
    searchQuery,
    priorityFilter,
    statusFilter,
    categoryFilter,
    targets,
    logs,
    members,
  ]);

  const completionHistory = useMemo(() => {
    const lastThirtyDays = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(selectedDate, index - 29);
      const snapshot = calculateDaySnapshot(date);
      const active = snapshot.required > 0;
      const complete = active && snapshot.pending === 0;

      return {
        ...snapshot,
        active,
        complete,
      };
    });

    let currentStreak = 0;

    for (let index = lastThirtyDays.length - 1; index >= 0; index -= 1) {
      const day = lastThirtyDays[index];

      if (!day.active || !day.complete) break;

      currentStreak += 1;
    }

    let bestStreak = 0;
    let runningStreak = 0;

    for (const day of lastThirtyDays) {
      if (day.active && day.complete) {
        runningStreak += 1;
        bestStreak = Math.max(bestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    const lastSevenDays = lastThirtyDays.slice(-7);
    const activeSevenDays = lastSevenDays.filter((day) => day.active).length;
    const completedSevenDays = lastSevenDays.filter(
      (day) => day.active && day.complete
    ).length;

    const completionRate =
      activeSevenDays === 0
        ? 100
        : Math.round((completedSevenDays / activeSevenDays) * 100);

    return {
      lastSevenDays,
      currentStreak,
      bestStreak,
      completionRate,
      completedSevenDays,
      activeSevenDays,
    };
  }, [
    selectedDate,
    selectedMemberId,
    searchQuery,
    priorityFilter,
    statusFilter,
    categoryFilter,
    targets,
    logs,
    members,
  ]);

  const monthCalendarDays = useMemo(() => {
    const firstDayOfMonth = toDate(calendarMonth);
    const leadingDays = getMondayBasedWeekday(firstDayOfMonth);
    const firstGridDate = addDays(calendarMonth, -leadingDays);
    const currentMonthKey = calendarMonth.slice(0, 7);

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(firstGridDate, index);
      const snapshot = calculateDaySnapshot(date);

      return {
        ...snapshot,
        isCurrentMonth: date.startsWith(currentMonthKey),
        isToday: date === todayISO(),
        isSelected: date === selectedDate,
      };
    });
  }, [
    calendarMonth,
    selectedDate,
    selectedMemberId,
    searchQuery,
    priorityFilter,
    statusFilter,
    categoryFilter,
    targets,
    logs,
    members,
  ]);

  function selectCalendarDate(dateISO: string) {
    setSelectedDate(dateISO);
    setCalendarMonth(monthStartISO(dateISO));
  }

  function clearFilters() {
    setSearchQuery("");
    setPriorityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSelectedMemberId("all");
  }

  function logProgress(targetId: string, amount: number) {
    if (amount <= 0) return;

    setLogs((currentLogs) => [
      ...currentLogs,
      {
        id: crypto.randomUUID(),
        targetId,
        date: selectedDate,
        achievedAmount: amount,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function logManualProgress(targetId: string) {
    const rawAmount = manualAmounts[targetId];
    const amount = Number(rawAmount);

    if (!rawAmount || Number.isNaN(amount) || amount <= 0) {
      window.alert("Enter a valid achieved amount greater than 0.");
      return;
    }

    logProgress(targetId, amount);

    setManualAmounts((currentAmounts) => ({
      ...currentAmounts,
      [targetId]: "",
    }));
  }

  function startEditingProgressLog(log: ProgressLog) {
    setEditingLogId(log.id);
    setEditLogDate(log.date);
    setEditLogAmount(log.achievedAmount);
  }

  function cancelEditingProgressLog() {
    setEditingLogId(null);
    setEditLogDate(todayISO());
    setEditLogAmount(1);
  }

  function saveEditedProgressLog() {
    if (!editingLogId) return;

    if (!editLogDate) {
      window.alert("Log date cannot be empty.");
      return;
    }

    if (Number.isNaN(editLogAmount) || editLogAmount <= 0) {
      window.alert("Log amount must be greater than 0.");
      return;
    }

    setLogs((currentLogs) =>
      currentLogs.map((log) =>
        log.id === editingLogId
          ? { ...log, date: editLogDate, achievedAmount: editLogAmount }
          : log
      )
    );

    cancelEditingProgressLog();
  }

  function deleteProgressLog(logId: string) {
    const log = logs.find((item) => item.id === logId);
    if (!log) return;

    const shouldDelete = window.confirm(
      `Delete this progress log of +${log.achievedAmount} from ${log.date}?`
    );

    if (!shouldDelete) return;

    setLogs((currentLogs) => currentLogs.filter((item) => item.id !== logId));

    if (editingLogId === logId) cancelEditingProgressLog();
  }

  function startEditingTarget(target: Target) {
    setEditingTargetId(target.id);
    setEditTitle(target.title);
    setEditDescription(target.description ?? "");
    setEditCategory(target.category || "General");
    setEditPriority(target.priority ?? "medium");
    setEditOwnerId(target.ownerId);
    setEditFrequency(target.frequency);
    setEditAmount(target.targetAmount);
    setEditUnit(target.unit);
  }

  function cancelEditingTarget() {
    setEditingTargetId(null);
    setEditTitle("");
    setEditDescription("");
    setEditCategory("General");
    setEditPriority("medium");
    setEditOwnerId("me");
    setEditFrequency("daily");
    setEditAmount(1);
    setEditUnit("tasks");
  }

  function saveEditedTarget() {
    if (!editingTargetId) return;

    if (!editTitle.trim()) {
      window.alert("Target name cannot be empty.");
      return;
    }

    if (Number.isNaN(editAmount) || editAmount <= 0) {
      window.alert("Target amount must be greater than 0.");
      return;
    }

    if (!editUnit.trim()) {
      window.alert("Unit cannot be empty.");
      return;
    }

    setTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.id === editingTargetId
          ? {
              ...target,
              title: editTitle.trim(),
              description: editDescription.trim(),
              category: editCategory.trim() || "General",
              priority: editPriority,
              ownerId: editOwnerId,
              frequency: editFrequency,
              targetAmount: editAmount,
              unit: editUnit.trim(),
            }
          : target
      )
    );

    cancelEditingTarget();
  }

  function startEditingMember(member: Member) {
    setEditingMemberId(member.id);
    setEditMemberName(member.name);
    setEditMemberRole(member.role);
  }

  function cancelEditingMember() {
    setEditingMemberId(null);
    setEditMemberName("");
    setEditMemberRole("Member");
  }

  function saveEditedMember() {
    if (!editingMemberId) return;

    if (!editMemberName.trim()) {
      window.alert("Member name cannot be empty.");
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === editingMemberId
          ? { ...member, name: editMemberName.trim(), role: editMemberRole }
          : member
      )
    );

    cancelEditingMember();
  }

  function addTarget() {
    if (!newTitle.trim()) return;

    if (newAmount <= 0) {
      window.alert("Target amount must be greater than 0.");
      return;
    }

    if (!newUnit.trim()) {
      window.alert("Unit cannot be empty.");
      return;
    }

    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory.trim() || "General",
        priority: newPriority,
        ownerId: newOwnerId,
        frequency: newFrequency,
        targetAmount: newAmount,
        unit: newUnit.trim(),
        startDate: selectedDate,
      },
    ]);

    setNewTitle("");
    setNewDescription("");
    setNewCategory("General");
    setNewPriority("medium");
    setNewAmount(1);
    setNewUnit("tasks");
    setNewFrequency("daily");
  }

  function addMember() {
    if (!newMemberName.trim()) return;

    const newMemberId = crypto.randomUUID();

    setMembers((currentMembers) => [
      ...currentMembers,
      { id: newMemberId, name: newMemberName.trim(), role: newMemberRole },
    ]);

    setNewOwnerId(newMemberId);
    setNewMemberName("");
    setNewMemberRole("Member");
  }

  function deleteTarget(targetId: string) {
    const target = targets.find((item) => item.id === targetId);
    if (!target) return;

    const shouldDelete = window.confirm(
      `Delete target "${target.title}"? Its progress logs will also be removed.`
    );

    if (!shouldDelete) return;

    setTargets((currentTargets) =>
      currentTargets.filter((item) => item.id !== targetId)
    );

    setLogs((currentLogs) =>
      currentLogs.filter((log) => log.targetId !== targetId)
    );

    if (editingTargetId === targetId) cancelEditingTarget();
  }

  function deleteMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;

    if (members.length <= 1) {
      window.alert("You must keep at least one member.");
      return;
    }

    const memberTargets = targets.filter(
      (target) => target.ownerId === memberId
    );

    const shouldDelete = window.confirm(
      `Delete member "${member.name}"? This will also delete ${memberTargets.length} targets assigned to this member.`
    );

    if (!shouldDelete) return;

    const memberTargetIds = memberTargets.map((target) => target.id);

    setMembers((currentMembers) =>
      currentMembers.filter((item) => item.id !== memberId)
    );

    setTargets((currentTargets) =>
      currentTargets.filter((target) => target.ownerId !== memberId)
    );

    setLogs((currentLogs) =>
      currentLogs.filter((log) => !memberTargetIds.includes(log.targetId))
    );

    if (selectedMemberId === memberId) setSelectedMemberId("all");

    if (newOwnerId === memberId || editOwnerId === memberId) {
      const nextMember = members.find((item) => item.id !== memberId);
      const nextMemberId = nextMember?.id ?? "me";
      setNewOwnerId(nextMemberId);
      setEditOwnerId(nextMemberId);
    }

    if (editingMemberId === memberId) cancelEditingMember();

    if (
      editingTargetId &&
      memberTargets.some((target) => target.id === editingTargetId)
    ) {
      cancelEditingTarget();
    }
  }

  function clearProgressLogs() {
    const shouldClear = window.confirm(
      "Clear all progress logs? Targets and members will stay, but achieved values will reset to zero."
    );

    if (!shouldClear) return;

    setLogs([]);
    cancelEditingProgressLog();
  }

  function exportTargetsCsv() {
    const rows = targets.map((target) => {
      const owner = members.find((member) => member.id === target.ownerId);

      return [
        target.id,
        target.title,
        target.description,
        target.category,
        priorityLabel(target.priority),
        owner?.name ?? "Unknown",
        owner?.role ?? "Unknown",
        target.frequency,
        target.targetAmount,
        target.unit,
        target.startDate,
      ];
    });

    const csv = buildCsv(
      [
        "Target ID",
        "Title",
        "Description",
        "Category",
        "Priority",
        "Owner",
        "Owner Role",
        "Frequency",
        "Target Amount",
        "Unit",
        "Start Date",
      ],
      rows
    );

    downloadTextFile(`targets-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportProgressLogsCsv() {
    const rows = logs.map((log) => {
      const target = targets.find((item) => item.id === log.targetId);
      const owner = target
        ? members.find((member) => member.id === target.ownerId)
        : undefined;

      return [
        log.id,
        log.date,
        log.achievedAmount,
        target?.unit ?? "",
        target?.title ?? "Deleted target",
        target?.category ?? "",
        log.targetId,
        owner?.name ?? "Unknown",
        owner?.role ?? "Unknown",
        log.createdAt,
      ];
    });

    const csv = buildCsv(
      [
        "Log ID",
        "Progress Date",
        "Achieved Amount",
        "Unit",
        "Target Title",
        "Category",
        "Target ID",
        "Owner",
        "Owner Role",
        "Created At",
      ],
      rows
    );

    downloadTextFile(
      `progress-logs-${todayISO()}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  function exportFullBackupJson() {
    const backup = {
      exportedAt: new Date().toISOString(),
      appName: "Universal Targets Tracker",
      version: 21,
      selectedDate,
      calendarMonth,
      lastSavedAt,
      members,
      targets,
      logs,
    };

    downloadTextFile(
      `universal-targets-tracker-backup-${todayISO()}.json`,
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function triggerImportBackup() {
    importFileInputRef.current?.click();
  }

  async function importBackupJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFile;

      if (
        !Array.isArray(parsed.members) ||
        !Array.isArray(parsed.targets) ||
        !Array.isArray(parsed.logs)
      ) {
        window.alert(
          "This backup is not valid. It must contain members, targets, and logs."
        );
        return;
      }

      const importedMembers = normalizeMembers(parsed.members);
      const importedTargets = normalizeTargets(parsed.targets);
      const importedLogs = normalizeLogs(parsed.logs);

      if (importedMembers.length === 0) {
        window.alert("This backup has no valid members.");
        return;
      }

      const validMemberIds = new Set(importedMembers.map((member) => member.id));

      const safeTargets = importedTargets.map((target) => ({
        ...target,
        ownerId: validMemberIds.has(target.ownerId)
          ? target.ownerId
          : importedMembers[0].id,
      }));

      const validTargetIds = new Set(safeTargets.map((target) => target.id));
      const safeLogs = importedLogs.filter((log) =>
        validTargetIds.has(log.targetId)
      );

      const shouldImport = window.confirm(
        `Import this backup? This will replace your current data with ${importedMembers.length} members, ${safeTargets.length} targets, and ${safeLogs.length} progress logs.`
      );

      if (!shouldImport) return;

      setMembers(importedMembers);
      setTargets(safeTargets);
      setLogs(safeLogs);
      setSelectedMemberId("all");
      setSearchQuery("");
      setPriorityFilter("all");
      setStatusFilter("all");
      setCategoryFilter("all");
      setManualAmounts({});
      cancelEditingTarget();
      cancelEditingMember();
      cancelEditingProgressLog();

      if (isValidDateISO(parsed.selectedDate)) {
        setSelectedDate(parsed.selectedDate as string);
      }

      if (isValidDateISO(parsed.calendarMonth)) {
        setCalendarMonth(monthStartISO(parsed.calendarMonth as string));
      } else if (isValidDateISO(parsed.selectedDate)) {
        setCalendarMonth(monthStartISO(parsed.selectedDate as string));
      }

      window.alert("Backup imported successfully.");
    } catch {
      window.alert("Could not import this file. Please choose a valid JSON backup.");
    } finally {
      event.target.value = "";
    }
  }

  function resetDemoData() {
    const shouldReset = window.confirm(
      "Reset demo data? This will restore the original members and targets."
    );

    if (!shouldReset) return;

    window.localStorage.removeItem(STORAGE_KEY);
    setMembers(initialMembers);
    setTargets(initialTargets);
    setLogs([]);
    setSelectedMemberId("all");
    setSelectedDate(todayISO());
    setCalendarMonth(monthStartISO(todayISO()));
    setSearchQuery("");
    setPriorityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setNewOwnerId("me");
    setNewCategory("General");
    setManualAmounts({});
    cancelEditingTarget();
    cancelEditingMember();
    cancelEditingProgressLog();
  }

  const totalPending = visibleDashboard.reduce((sum, row) => sum + row.pending, 0);
  const totalAchieved = visibleDashboard.reduce((sum, row) => sum + row.achieved, 0);
  const totalRequired = visibleDashboard.reduce((sum, row) => sum + row.required, 0);
  const totalLogs = logs.length;

  const selectedMemberName =
    selectedMemberId === "all"
      ? "All members"
      : members.find((member) => member.id === selectedMemberId)?.name ??
        "Unknown";

  const activeFilterCount = [
    searchQuery.trim() ? "search" : "",
    selectedMemberId !== "all" ? "member" : "",
    priorityFilter !== "all" ? "priority" : "",
    statusFilter !== "all" ? "status" : "",
    categoryFilter !== "all" ? "category" : "",
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <datalist id="category-options">
          {categoryOptions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <header className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Universal Targets Tracker
            </p>

            <h1 className="mt-3 text-4xl font-bold">
              Workspace targets, backlog, and progress
            </h1>

            <p className="mt-3 max-w-3xl text-slate-300">
              Track daily, weekly, and monthly targets for individuals,
              families, teams, businesses, and classrooms. Missed work carries
              forward. Extra work gives future credit.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
            <FieldLabel label="Selected date">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => selectCalendarDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white"
              />
            </FieldLabel>

            <FieldLabel label="View member">
              <select
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white"
              >
                <option value="all">All members</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <StatCard label="Pending" value={totalPending} />
          <StatCard label="Achieved" value={totalAchieved} />
          <StatCard label="Required" value={totalRequired} />
          <StatCard label="Members" value={members.length} />
          <StatCard label="Logs" value={totalLogs} />
        </section>

        <section className="mb-8 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
              Dashboard insights
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Warnings and recommended focus
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Quick signals based on the selected date and active filters.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Most behind category</p>

              {dashboardInsights.mostBehindCategory ? (
                <>
                  <p className="mt-2 text-xl font-bold">
                    {dashboardInsights.mostBehindCategory.category}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {dashboardInsights.mostBehindCategory.pending} pending ·{" "}
                    {dashboardInsights.mostBehindCategory.targetCount} targets
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xl font-bold text-emerald-300">
                  No backlog
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Most behind member</p>

              {dashboardInsights.mostBehindMember ? (
                <>
                  <p className="mt-2 text-xl font-bold">
                    {dashboardInsights.mostBehindMember.member.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {dashboardInsights.mostBehindMember.pending} pending ·{" "}
                    {dashboardInsights.mostBehindMember.targetCount} targets
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xl font-bold text-emerald-300">
                  No backlog
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Highest priority overdue</p>

              {dashboardInsights.highestPriorityOverdueTarget ? (
                <>
                  <p className="mt-2 text-xl font-bold">
                    {dashboardInsights.highestPriorityOverdueTarget.target.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {priorityLabel(
                      dashboardInsights.highestPriorityOverdueTarget.target
                        .priority
                    )}{" "}
                    · {dashboardInsights.highestPriorityOverdueTarget.pending}{" "}
                    {
                      dashboardInsights.highestPriorityOverdueTarget.target.unit
                    }{" "}
                    pending
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xl font-bold text-emerald-300">
                  All clear
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Today&apos;s focus list</p>

              {dashboardInsights.recommendedFocus.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {dashboardInsights.recommendedFocus.map((row, index) => (
                    <div
                      key={row.target.id}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                    >
                      <p className="font-semibold">
                        {index + 1}. {row.target.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {row.pending} {row.target.unit} pending ·{" "}
                        {priorityLabel(row.target.priority)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xl font-bold text-emerald-300">
                  Nothing urgent
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Local data status
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Saved in this browser
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Your prototype data is stored locally in this browser. Export a
                JSON backup before clearing browser data or changing devices.
              </p>
            </div>

            <StatusBox label="Last saved" value={formatSavedTime(lastSavedAt)} />
            <StatusBox
              label="Saved records"
              value={`${members.length} members · ${targets.length} targets`}
            />
            <StatusBox label="Progress logs" value={`${logs.length} logs`} />
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-purple-400/20 bg-purple-400/10 p-5">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-purple-300">
              Completion history
            </p>
            <h2 className="mt-2 text-2xl font-bold">Consistency and streaks</h2>
            <p className="mt-2 text-sm text-slate-300">
              Based on the selected date and current filters. A day counts as
              complete when its filtered required work has no pending amount.
            </p>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <StatusBox
              label="Current streak"
              value={`${completionHistory.currentStreak} days`}
            />
            <StatusBox
              label="Best streak"
              value={`${completionHistory.bestStreak} days`}
            />
            <StatusBox
              label="7-day completion"
              value={`${completionHistory.completionRate}%`}
            />
            <StatusBox
              label="Completed days"
              value={`${completionHistory.completedSevenDays}/${completionHistory.activeSevenDays}`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-7">
            {completionHistory.lastSevenDays.map((day) => (
              <div
                key={day.date}
                className={`rounded-2xl border p-4 ${
                  day.complete
                    ? "border-emerald-400/30 bg-emerald-400/10"
                    : day.active
                    ? "border-red-400/30 bg-red-400/10"
                    : "border-white/10 bg-slate-950/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{getShortDayLabel(day.date)}</p>
                    <p className="text-xs text-slate-400">{day.date.slice(5)}</p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      day.complete
                        ? "bg-emerald-500/20 text-emerald-300"
                        : day.active
                        ? "bg-red-500/20 text-red-300"
                        : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {day.complete ? "Done" : day.active ? "Open" : "No work"}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${day.progress}%` }}
                  />
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  <p>Pending: {day.pending}</p>
                  <p>Required: {day.required}</p>
                  <p>Achieved: {day.achieved}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5">
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
                Category overview
              </p>
              <h2 className="mt-2 text-2xl font-bold">Work grouped by category</h2>
              <p className="mt-2 text-sm text-slate-300">
                Shows pending, achieved, required, and progress for the current
                date and active filters.
              </p>
            </div>

            <p className="text-sm text-slate-400">
              {categoryOverview.length} visible categories
            </p>
          </div>

          {categoryOverview.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryOverview.map((category) => (
                <div
                  key={category.category}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200">
                        {category.category}
                      </span>
                      <h3 className="mt-3 text-xl font-bold">
                        {category.targetCount}{" "}
                        {category.targetCount === 1 ? "target" : "targets"}
                      </h3>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                        category.status
                      )}`}
                    >
                      {category.progress}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${category.progress}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-900 p-3">
                      <p className="text-slate-400">Pending</p>
                      <p className="mt-1 text-lg font-bold">{category.pending}</p>
                    </div>

                    <div className="rounded-xl bg-slate-900 p-3">
                      <p className="text-slate-400">Achieved</p>
                      <p className="mt-1 text-lg font-bold">{category.achieved}</p>
                    </div>

                    <div className="rounded-xl bg-slate-900 p-3">
                      <p className="text-slate-400">Required</p>
                      <p className="mt-1 text-lg font-bold">{category.required}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
              No category data to show with the current filters.
            </div>
          )}
        </section>

        <section className="mb-8 flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
          <button
            onClick={clearProgressLogs}
            className="rounded-xl border border-yellow-400/30 px-4 py-2 text-sm text-yellow-200 hover:bg-yellow-400/10"
          >
            Clear progress only
          </button>

          <button
            onClick={resetDemoData}
            className="rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-200 hover:bg-red-400/10"
          >
            Reset demo data
          </button>

          <p className="flex items-center text-sm text-slate-400">
            Dashboard insights update automatically when filters, progress, or
            selected date changes.
          </p>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Backup, export, and import</h2>
            <p className="mt-1 text-sm text-slate-400">
              Download your data or restore a full JSON backup created by this
              app.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportTargetsCsv}
              className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Export targets CSV
            </button>

            <button
              onClick={exportProgressLogsCsv}
              className="rounded-xl border border-cyan-400/30 px-4 py-3 font-semibold text-cyan-200 hover:bg-cyan-400/10"
            >
              Export progress logs CSV
            </button>

            <button
              onClick={exportFullBackupJson}
              className="rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
            >
              Export full backup JSON
            </button>

            <button
              onClick={triggerImportBackup}
              className="rounded-xl border border-emerald-400/30 px-4 py-3 font-semibold text-emerald-200 hover:bg-emerald-400/10"
            >
              Import backup JSON
            </button>

            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importBackupJson}
              className="hidden"
            />
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Search and filters</h2>
              <p className="mt-1 text-sm text-slate-400">
                Showing {visibleDashboard.length} matching targets. Active
                filters: {activeFilterCount}
              </p>
            </div>

            <button
              onClick={clearFilters}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search targets, categories, notes, units, owners, or roles..."
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            />

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  Category: {category}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as "all" | Priority)
              }
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              <option value="all">All priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  Priority: {priority.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              {statusFilterOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
                Logging date
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                {getDateLabel(selectedDate)}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Any Tick done, +1, +3, or custom log you enter now will be saved
                for {selectedDate}.
              </p>
            </div>

            <StatusBox
              label="Pending on this date"
              value={selectedDaySummary.pending}
            />
            <StatusBox
              label="Required by this date"
              value={selectedDaySummary.required}
            />
            <StatusBox
              label="Achieved by this date"
              value={selectedDaySummary.achieved}
            />
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Month calendar</h2>
              <p className="mt-1 text-sm text-slate-400">
                Click any day to open that date. Filter: {selectedMemberName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
              >
                Previous month
              </button>

              <div className="min-w-48 rounded-xl bg-slate-900 px-4 py-2 text-center font-semibold">
                {getMonthLabel(calendarMonth)}
              </div>

              <button
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
              >
                Next month
              </button>

              <button
                onClick={() => {
                  setSelectedDate(todayISO());
                  setCalendarMonth(monthStartISO(todayISO()));
                }}
                className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                Today
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-slate-300"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthCalendarDays.map((day) => (
              <button
                key={day.date}
                onClick={() => selectCalendarDate(day.date)}
                className={`min-h-32 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${
                  day.isSelected
                    ? "border-cyan-400 bg-cyan-400/10"
                    : day.isToday
                    ? "border-emerald-400/70 bg-emerald-400/10"
                    : day.isCurrentMonth
                    ? "border-white/10 bg-slate-900"
                    : "border-white/5 bg-slate-950/50 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {Number(day.date.slice(8, 10))}
                  </p>

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(
                      day.status
                    )}`}
                  >
                    {day.status}
                  </span>
                </div>

                <p className="mt-3 text-2xl font-bold">{day.pending}</p>
                <p className="text-xs text-slate-400">pending</p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${day.progress}%` }}
                  />
                </div>

                <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <p>Req: {day.required}</p>
                  <p>Done: {day.achieved}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Selected day&apos;s work</h2>
              <p className="mt-1 text-sm text-slate-400">
                {selectedDate} · Showing {selectedMemberName}
              </p>
            </div>

            <div className="space-y-4">
              {visibleDashboard.map((row) => {
                const isEditing = editingTargetId === row.target.id;

                return (
                  <div
                    key={row.target.id}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                  >
                    {isEditing ? (
                      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
                        <h3 className="mb-4 text-xl font-bold text-cyan-200">
                          Edit target
                        </h3>

                        <div className="grid gap-3 md:grid-cols-2">
                          <FieldLabel label="Target name">
                            <input
                              value={editTitle}
                              onChange={(event) =>
                                setEditTitle(event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            />
                          </FieldLabel>

                          <FieldLabel label="Category">
                            <input
                              list="category-options"
                              value={editCategory}
                              onChange={(event) =>
                                setEditCategory(event.target.value)
                              }
                              placeholder="Example: School"
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            />
                          </FieldLabel>

                          <FieldLabel label="Priority">
                            <select
                              value={editPriority}
                              onChange={(event) =>
                                setEditPriority(event.target.value as Priority)
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            >
                              {priorityOptions.map((priority) => (
                                <option key={priority.value} value={priority.value}>
                                  {priority.label}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>

                          <FieldLabel label="Assigned member">
                            <select
                              value={editOwnerId}
                              onChange={(event) =>
                                setEditOwnerId(event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            >
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>

                          <FieldLabel label="Frequency">
                            <select
                              value={editFrequency}
                              onChange={(event) =>
                                setEditFrequency(event.target.value as Frequency)
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </FieldLabel>

                          <FieldLabel label="Target amount">
                            <input
                              type="number"
                              min="1"
                              value={editAmount}
                              onChange={(event) =>
                                setEditAmount(Number(event.target.value))
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            />
                          </FieldLabel>

                          <FieldLabel label="Unit">
                            <input
                              value={editUnit}
                              onChange={(event) => setEditUnit(event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            />
                          </FieldLabel>

                          <div className="md:col-span-2">
                            <FieldLabel label="Notes / what counts as done">
                              <textarea
                                value={editDescription}
                                onChange={(event) =>
                                  setEditDescription(event.target.value)
                                }
                                placeholder="Example: Counts only when the work is finished and reviewed."
                                rows={3}
                                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                              />
                            </FieldLabel>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={saveEditedTarget}
                            className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
                          >
                            Save changes
                          </button>

                          <button
                            onClick={cancelEditingTarget}
                            className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold">
                                {row.target.title}
                              </h3>

                              <span className="rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200">
                                {row.target.category || "General"}
                              </span>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClass(
                                  row.target.priority
                                )}`}
                              >
                                {priorityLabel(row.target.priority)}
                              </span>

                              <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300">
                                {row.target.frequency}
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                                  row.status
                                )}`}
                              >
                                {row.status}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-400">
                              Owner: {row.owner?.name ?? "Unknown"} · Role:{" "}
                              {row.owner?.role ?? "Unknown"} · Target:{" "}
                              {row.target.targetAmount} {row.target.unit} /{" "}
                              {row.target.frequency}
                            </p>

                            {row.target.description && (
                              <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                                <span className="font-semibold text-cyan-300">
                                  Notes:
                                </span>{" "}
                                {row.target.description}
                              </p>
                            )}

                            <p className="mt-2 text-sm text-slate-300">
                              Required by selected date: {row.required}{" "}
                              {row.target.unit}. Achieved: {row.achieved}{" "}
                              {row.target.unit}.
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/5 p-4 text-right">
                            <p className="text-sm text-slate-400">Need now</p>
                            <p className="text-3xl font-bold">
                              {row.pending} {row.target.unit}
                            </p>

                            {row.surplus > 0 && (
                              <p className="mt-1 text-sm text-emerald-300">
                                Surplus credit: {row.surplus}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-cyan-400"
                            style={{ width: `${row.progress}%` }}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                logProgress(
                                  row.target.id,
                                  row.pending || row.target.targetAmount
                                )
                              }
                              className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
                            >
                              Tick done
                            </button>

                            <button
                              onClick={() => logProgress(row.target.id, 1)}
                              className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
                            >
                              +1 actual
                            </button>

                            <button
                              onClick={() => logProgress(row.target.id, 3)}
                              className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
                            >
                              +3 actual
                            </button>

                            <button
                              onClick={() => startEditingTarget(row.target)}
                              className="rounded-xl border border-cyan-400/30 px-4 py-2 text-cyan-200 hover:bg-cyan-400/10"
                            >
                              Edit target
                            </button>

                            <button
                              onClick={() => deleteTarget(row.target.id)}
                              className="rounded-xl border border-red-400/30 px-4 py-2 text-red-200 hover:bg-red-400/10"
                            >
                              Delete target
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              value={manualAmounts[row.target.id] ?? ""}
                              onChange={(event) =>
                                setManualAmounts((currentAmounts) => ({
                                  ...currentAmounts,
                                  [row.target.id]: event.target.value,
                                }))
                              }
                              placeholder="Amount"
                              className="w-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                            />

                            <button
                              onClick={() => logManualProgress(row.target.id)}
                              className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-950 hover:bg-slate-200"
                            >
                              Log custom
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="mb-3 text-sm font-semibold text-slate-300">
                            Recent progress logs
                          </p>

                          {row.recentLogs.length > 0 ? (
                            <div className="space-y-2">
                              {row.recentLogs.map((log) => {
                                const isEditingLog = editingLogId === log.id;

                                return (
                                  <div
                                    key={log.id}
                                    className="rounded-xl bg-slate-950 px-3 py-2 text-sm"
                                  >
                                    {isEditingLog ? (
                                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                                        <FieldLabel label="Log date">
                                          <input
                                            type="date"
                                            value={editLogDate}
                                            onChange={(event) =>
                                              setEditLogDate(event.target.value)
                                            }
                                            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white"
                                          />
                                        </FieldLabel>

                                        <FieldLabel label="Amount">
                                          <input
                                            type="number"
                                            min="1"
                                            value={editLogAmount}
                                            onChange={(event) =>
                                              setEditLogAmount(
                                                Number(event.target.value)
                                              )
                                            }
                                            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white"
                                          />
                                        </FieldLabel>

                                        <button
                                          onClick={saveEditedProgressLog}
                                          className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                                        >
                                          Save log
                                        </button>

                                        <button
                                          onClick={cancelEditingProgressLog}
                                          className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <span className="text-slate-300">
                                            {log.date}
                                          </span>
                                          <span className="ml-3 font-semibold text-cyan-300">
                                            +{log.achievedAmount}{" "}
                                            {row.target.unit}
                                          </span>
                                        </div>

                                        <div className="flex gap-2">
                                          <button
                                            onClick={() =>
                                              startEditingProgressLog(log)
                                            }
                                            className="rounded-lg border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10"
                                          >
                                            Edit log
                                          </button>

                                          <button
                                            onClick={() =>
                                              deleteProgressLog(log.id)
                                            }
                                            className="rounded-lg border border-red-400/30 px-3 py-1 text-xs text-red-200 hover:bg-red-400/10"
                                          >
                                            Delete log
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">
                              No progress logged yet.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {visibleDashboard.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                  No matching targets found. Clear filters or change your
                  search.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-2xl font-bold">Workspace overview</h2>

              <div className="space-y-3">
                {memberOverview.map((row) => {
                  const isEditingMember = editingMemberId === row.member.id;

                  return (
                    <div
                      key={row.member.id}
                      className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                    >
                      {isEditingMember ? (
                        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
                          <h3 className="mb-4 text-lg font-bold text-cyan-200">
                            Edit member
                          </h3>

                          <div className="space-y-3">
                            <FieldLabel label="Member name">
                              <input
                                value={editMemberName}
                                onChange={(event) =>
                                  setEditMemberName(event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                              />
                            </FieldLabel>

                            <FieldLabel label="Role">
                              <select
                                value={editMemberRole}
                                onChange={(event) =>
                                  setEditMemberRole(event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                              >
                                {roleOptions.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </FieldLabel>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={saveEditedMember}
                              className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
                            >
                              Save member
                            </button>

                            <button
                              onClick={cancelEditingMember}
                              className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{row.member.name}</p>
                              <p className="text-sm text-slate-400">
                                {row.member.role} · {row.targetCount} targets
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                                row.status
                              )}`}
                            >
                              {row.progress}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${row.progress}%` }}
                            />
                          </div>

                          <p className="mt-3 text-sm text-slate-300">
                            Pending: {row.pending} · Achieved: {row.achieved} ·
                            Required: {row.required}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => startEditingMember(row.member)}
                              className="rounded-xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
                            >
                              Edit member
                            </button>

                            <button
                              onClick={() => deleteMember(row.member.id)}
                              className="rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-200 hover:bg-red-400/10"
                            >
                              Delete member
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-2xl font-bold">Add member</h2>

              <div className="space-y-3">
                <input
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="Example: Ahmed"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <select
                  value={newMemberRole}
                  onChange={(event) => setNewMemberRole(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                <button
                  onClick={addMember}
                  className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Add member
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-2xl font-bold">Add target</h2>

              <div className="space-y-3">
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Example: Read pages"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <input
                  list="category-options"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Category, e.g. School"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <textarea
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Notes / what counts as done"
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <select
                  value={newPriority}
                  onChange={(event) =>
                    setNewPriority(event.target.value as Priority)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      Priority: {priority.label}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="1"
                    value={newAmount}
                    onChange={(event) =>
                      setNewAmount(Number(event.target.value))
                    }
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  />

                  <input
                    value={newUnit}
                    onChange={(event) => setNewUnit(event.target.value)}
                    placeholder="unit"
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  />
                </div>

                <select
                  value={newFrequency}
                  onChange={(event) =>
                    setNewFrequency(event.target.value as Frequency)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                <select
                  value={newOwnerId}
                  onChange={(event) => setNewOwnerId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      Assign to: {member.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={addTarget}
                  className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
                >
                  Add target
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
    </div>
  );
}

function StatusBox({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label>
      <p className="mb-2 text-sm text-slate-400">{label}</p>
      {children}
    </label>
  );
}