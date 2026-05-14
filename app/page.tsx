/* eslint-disable react-hooks/set-state-in-effect */
﻿"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, getSupabaseConfigStatus } from "../lib/supabaseClient";
import { loadCloudDataFromCloud, saveLocalDataToCloud } from "../lib/cloudSync";

type Frequency = "once" | "daily" | "weekly" | "monthly";
type Priority = "low" | "medium" | "high" | "urgent";
type StatusFilter = "all" | "onTrack" | "close" | "behind";
type ArchiveFilter = "active" | "archived" | "all";
type ScreenSectionKey =
  | "quickStart"
  | "dashboardInsights"
  | "localDataStatus"
  | "completionHistory"
  | "categoryOverview"
  | "managementControls"
  | "backupTools"
  | "searchFilters"
  | "loggingSummary"
  | "monthCalendar"
  | "selectedDayWork"
  | "workspaceOverview"
  | "addMember"
  | "addTarget";
type ScreenSettings = Record<ScreenSectionKey, boolean>;
type ScreenPresetKey = "simple" | "manager" | "calendar" | "admin" | "full";
type SupabaseConnectionStatus = "checking" | "connected" | "missing" | "unreachable" | "error";
type AuthMode = "login" | "signup";
type AppView = "dashboard" | "targets" | "calendar" | "workspace" | "reports" | "settings";
type WorkspaceAuthorityRole = "owner" | "admin" | "leader" | "parent" | "member" | "viewer";
type WorkspaceMembershipStatus = "active" | "removed";
type WorkspaceInviteStatus = "pending" | "accepted" | "expired" | "revoked";
type ProgressLogStatus = "pending" | "approved" | "rejected";

type WorkspaceMembership = {
  workspaceId: string;
  userId: string;
  email: string;
  displayName: string;
  permissionPreset: WorkspaceAuthorityRole;
  status: WorkspaceMembershipStatus;
  joinedAt: string;
};

type WorkspaceInvite = {
  id: string;
  workspaceId: string;
  email: string;
  permissionPreset: WorkspaceAuthorityRole;
  status: WorkspaceInviteStatus;
  invitedByUserId: string;
  createdAt: string;
  expiresAt: string;
};

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
  isArchived: boolean;
  claimedByMemberId?: string;
  claimedAt?: string;
};

type ProgressLog = {
  id: string;
  targetId: string;
  date: string;
  achievedAmount: number;
  createdAt: string;
  status?: ProgressLogStatus;
  submittedByMemberId?: string;
  approvedByMemberId?: string;
  approvedAt?: string;
  rejectionReason?: string;
};

type ActivityEventAction =
  | "workspace_renamed"
  | "progress_log_deleted"
  | "target_deleted"
  | "member_deleted"
  | "progress_cleared"
  | "backup_imported"
  | "demo_workspace_loaded"
  | "fresh_workspace_started"
  | "cloud_saved"
  | "cloud_loaded";

type ActivityEvent = {
  id: string;
  action: ActivityEventAction;
  message: string;
  createdAt: string;
  workspaceName: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type SavedAppState = {
  workspaceName?: string;
  members: Member[];
  targets: Target[];
  logs: ProgressLog[];
  activityEvents?: ActivityEvent[];
  screenSettings?: ScreenSettings;
  currentAuthorityRole?: WorkspaceAuthorityRole;
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
const MAX_ACTIVITY_EVENTS = 100;
const APP_BACKUP_VERSION = 41;
const DEFAULT_WORKSPACE_NAME = "My Workspace";
const DEMO_WORKSPACE_NAME = "Demo Workspace";

const FREE_PLAN_NAME = "Free";
const FREE_PERSONAL_WORKSPACE_LIMIT = 1;
const FREE_TEAM_WORKSPACE_LIMIT = 3;
const FREE_OWNED_TEAM_SEAT_LIMIT = 10;
const FREE_PLAN_PENDING_INVITES_COUNT = true;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const SUPABASE_CONNECTION_TIMEOUT_MS = 6000;

const LOCAL_PROFILE_ROLE = "Local assignment profile";



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

const archiveFilterOptions: { value: ArchiveFilter; label: string }[] = [
  { value: "active", label: "Active targets" },
  { value: "archived", label: "Archived targets" },
  { value: "all", label: "All targets" },
];

const authorityRoleOptions: {
  value: WorkspaceAuthorityRole;
  label: string;
  description: string;
}[] = [
  {
    value: "owner",
    label: "Full access",
    description:
      "Can manage workspace settings, local profiles, targets, approvals, backups, and cloud sync.",
  },
  {
    value: "admin",
    label: "Workspace manager",
    description:
      "Can manage local profiles, assign work, approve progress, and operate most workspace tools.",
  },
  {
    value: "leader",
    label: "Work coordinator",
    description:
      "Can assign targets, monitor progress, and approve submitted work.",
  },
  {
    value: "parent",
    label: "Profile manager",
    description:
      "Legacy-compatible preset for managing local assignment profiles and approvals.",
  },
  {
    value: "member",
    label: "Contributor",
    description:
      "Can work on assigned/shared targets and submit progress.",
  },
  {
    value: "viewer",
    label: "View only",
    description:
      "Can view progress but cannot change workspace data.",
  },
];

const workspaceMembershipStatusLabels: Record<
  WorkspaceMembership["status"],
  string
> = {
  active: "Active workspace member",
  removed: "Removed workspace member",
};

const workspaceInviteStatusLabels: Record<WorkspaceInvite["status"], string> = {
  pending: "Pending invite",
  accepted: "Accepted invite",
  expired: "Expired invite",
  revoked: "Revoked invite",
};

const screenSectionOptions: {
  key: ScreenSectionKey;
  label: string;
  description: string;
  group: "Core" | "Planning" | "Management" | "Admin";
}[] = [
  { key: "quickStart", label: "Beginner guide", description: "Plain-English tutorial for first-time users and fresh workspaces.", group: "Core" },
  { key: "dashboardInsights", label: "Dashboard insights", description: "Warnings, behind categories, and recommended focus.", group: "Core" },
  { key: "localDataStatus", label: "Local data status", description: "Browser save status and record counts.", group: "Admin" },
  { key: "completionHistory", label: "Completion history", description: "Streaks, recent completion rate, and day-by-day history.", group: "Planning" },
  { key: "categoryOverview", label: "Category overview", description: "Pending, achieved, and required work grouped by category.", group: "Management" },
  { key: "managementControls", label: "Management controls", description: "Reset and clear-progress actions.", group: "Admin" },
  { key: "backupTools", label: "Backup and export tools", description: "CSV export, JSON backup, and backup restore.", group: "Admin" },
  { key: "searchFilters", label: "Search and filters", description: "Search, profile, category, priority, status, and archive filters.", group: "Core" },
  { key: "loggingSummary", label: "Logging date summary", description: "Selected date summary before logging progress.", group: "Core" },
  { key: "monthCalendar", label: "Month calendar", description: "Monthly forecast grid with day-level backlog.", group: "Planning" },
  { key: "selectedDayWork", label: "Selected day work", description: "Main target cards, progress logging, editing, and logs.", group: "Core" },
  { key: "workspaceOverview", label: "Workspace overview", description: "Local profile performance summary and editing.", group: "Management" },
  { key: "addMember", label: "Add local profile", description: "Create local assignment profiles until email invites are added.", group: "Management" },
  { key: "addTarget", label: "Add target", description: "Create new targets, units, categories, assigned profiles, and frequency.", group: "Core" },
];

const defaultScreenSettings: ScreenSettings = {
  quickStart: true,
  dashboardInsights: true,
  localDataStatus: false,
  completionHistory: false,
  categoryOverview: false,
  managementControls: false,
  backupTools: false,
  searchFilters: true,
  loggingSummary: true,
  monthCalendar: false,
  selectedDayWork: true,
  workspaceOverview: true,
  addMember: false,
  addTarget: true,
};

const screenPresetOptions: {
  key: ScreenPresetKey;
  label: string;
  description: string;
  settings: ScreenSettings;
}[] = [
  {
    key: "simple",
    label: "Simple View",
    description: "Clean daily tracking with only the essentials.",
    settings: defaultScreenSettings,
  },
  {
    key: "manager",
    label: "Manager View",
    description: "Insights, categories, workspace performance, and work cards.",
    settings: {
      quickStart: false,
      dashboardInsights: true,
      localDataStatus: false,
      completionHistory: false,
      categoryOverview: true,
      managementControls: false,
      backupTools: false,
      searchFilters: true,
      loggingSummary: true,
      monthCalendar: false,
      selectedDayWork: true,
      workspaceOverview: true,
      addMember: false,
      addTarget: false,
    },
  },
  {
    key: "calendar",
    label: "Calendar View",
    description: "Planning-first layout with calendar, streaks, and selected day work.",
    settings: {
      quickStart: false,
      dashboardInsights: false,
      localDataStatus: false,
      completionHistory: true,
      categoryOverview: false,
      managementControls: false,
      backupTools: false,
      searchFilters: true,
      loggingSummary: true,
      monthCalendar: true,
      selectedDayWork: true,
      workspaceOverview: false,
      addMember: false,
      addTarget: false,
    },
  },
  {
    key: "admin",
    label: "Admin View",
    description: "Setup, backup, workspace, and maintenance controls.",
    settings: {
      quickStart: true,
      dashboardInsights: false,
      localDataStatus: true,
      completionHistory: false,
      categoryOverview: false,
      managementControls: true,
      backupTools: true,
      searchFilters: true,
      loggingSummary: false,
      monthCalendar: false,
      selectedDayWork: false,
      workspaceOverview: true,
      addMember: true,
      addTarget: true,
    },
  },
  {
    key: "full",
    label: "Full View",
    description: "Everything visible for power users and internal testing.",
    settings: {
      quickStart: true,
      dashboardInsights: true,
      localDataStatus: true,
      completionHistory: true,
      categoryOverview: true,
      managementControls: true,
      backupTools: true,
      searchFilters: true,
      loggingSummary: true,
      monthCalendar: true,
      selectedDayWork: true,
      workspaceOverview: true,
      addMember: true,
      addTarget: true,
    },
  },
];

const appViewOptions: {
  key: AppView;
  label: string;
  description: string;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Today, warnings, and recommended focus.",
  },
  {
    key: "targets",
    label: "Targets",
    description: "Search, add, edit, archive, and log target progress.",
  },
  {
    key: "calendar",
    label: "Calendar",
    description: "Plan by date and review the monthly forecast.",
  },
  {
    key: "workspace",
    label: "Workspace",
    description: "Local assignment profiles, invites, and workspace setup.",
  },
  {
    key: "reports",
    label: "Reports",
    description: "History, categories, exports, and backups.",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Account, backend, local status, and screen controls.",
  },
];

const initialMembers: Member[] = [
  { id: "me", name: "Me", role: LOCAL_PROFILE_ROLE },
  { id: "team", name: "Sales profile", role: LOCAL_PROFILE_ROLE },
  { id: "student", name: "Study profile", role: LOCAL_PROFILE_ROLE },
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
    isArchived: false,
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
    isArchived: false,
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
    isArchived: false,
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
    isArchived: false,
  },
];

function createDemoTargetsForDate(startDate: string) {
  return initialTargets.map((target) => ({
    ...target,
    startDate,
  }));
}

function toDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00`);
}

function isValidDateISO(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isPositiveFiniteNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function parseNumberInput(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    end.getMonth() - start.getMonth()
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
  return value === "once" || value === "daily" || value === "weekly" || value === "monthly";
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

  if (dateISO > todayISO()) {
    return 1;
  }

  if (target.frequency === "once") {
    return 1;
  }

  if (target.frequency === "daily") {
    return daysBetween(target.startDate, dateISO) + 1;
  }

  if (target.frequency === "weekly") {
    return Math.floor(daysBetween(target.startDate, dateISO) / 7) + 1;
  }

  return monthsBetween(target.startDate, dateISO) + 1;
}

function getDueStatusLabel(frequency?: Frequency) {
  if (frequency === "weekly") return "Due This Week";
  if (frequency === "monthly") return "Due This Month";
  return "Due Today";
}

function getStatus(
  pending: number,
  progress: number,
  dateISO?: string,
  frequency?: Frequency
) {
  if (pending === 0) return "Done";

  const today = todayISO();

  if (dateISO && dateISO > today) return "Upcoming";
  if (dateISO && dateISO === today) {
    return progress >= 80 ? "Almost Done" : getDueStatusLabel(frequency);
  }

  if (progress >= 80) return "Almost Done";
  return "Overdue";
}

function statusClass(status: string) {
  if (status === "Overdue") return "bg-red-500/20 text-red-300";
  if (
    status === "Due Today" ||
    status === "Due This Week" ||
    status === "Due This Month"
  ) {
    return "bg-orange-500/20 text-orange-300";
  }
  if (status === "Upcoming") return "bg-blue-500/20 text-blue-300";
  if (status === "Almost Done") return "bg-yellow-500/20 text-yellow-300";
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
  if (filter === "behind") return status === "Overdue";
  if (filter === "close") return status === "Almost Done";
  if (filter === "onTrack") return status === "Done";
  return true;
}

function singularizeUnit(unit: string) {
  const trimmed = unit.trim() || "unit";
  const lower = trimmed.toLowerCase();

  if (lower.endsWith("ies") && trimmed.length > 3) {
    return trimmed.slice(0, -3) + "y";
  }

  if (lower.endsWith("s") && !lower.endsWith("ss") && trimmed.length > 1) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

function pluralizeUnit(unit: string) {
  const singular = singularizeUnit(unit);
  const lower = singular.toLowerCase();

  if (lower.endsWith("y") && !/[aeiou]y$/i.test(lower)) {
    return singular.slice(0, -1) + "ies";
  }

  if (
    lower.endsWith("s") ||
    lower.endsWith("x") ||
    lower.endsWith("ch") ||
    lower.endsWith("sh")
  ) {
    return singular + "es";
  }

  return singular + "s";
}

function formatQuantity(amount: number, unit: string) {
  return amount + " " + (amount === 1 ? singularizeUnit(unit) : pluralizeUnit(unit));
}

function formatCount(count: number, singularLabel: string, pluralLabel?: string) {
  return count + " " + (count === 1 ? singularLabel : pluralLabel ?? singularLabel + "s");
}

function archiveMatchesFilter(isArchived: boolean, filter: ArchiveFilter) {
  if (filter === "all") return true;
  if (filter === "archived") return isArchived;
  return !isArchived;
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not saved yet";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function getTargetEmptyState({
  hasTargets,
  activeTargetsCount,
  archiveFilter,
  activeFilterCount,
}: {
  hasTargets: boolean;
  activeTargetsCount: number;
  archiveFilter: ArchiveFilter;
  activeFilterCount: number;
}) {
  if (!hasTargets) {
    return {
      title: "No targets yet",
      body: "Add your first target from the Add target panel. Start with something simple, like one daily task.",
    };
  }

  if (archiveFilter === "active" && activeTargetsCount === 0) {
    return {
      title: "All targets are archived",
      body: "Switch the archive filter to Archived targets or All targets if you want to view or restore old work.",
    };
  }

  if (archiveFilter === "archived") {
    return {
      title: "No archived targets found",
      body: "Archived targets will appear here after you archive an old target. Active target history stays preserved.",
    };
  }

  if (activeFilterCount > 0) {
    return {
      title: "No targets match the current filters",
      body: "Clear filters, change the selected profile, or switch the archive filter to All targets.",
    };
  }

  return {
    title: "No matching targets found",
    body: "Try changing the selected date, profile, category, priority, status, or archive filter.",
  };
}

function normalizeScreenSettings(value: unknown): ScreenSettings {
  const normalized = { ...defaultScreenSettings };

  if (!value || typeof value !== "object") return normalized;

  const rawSettings = value as Partial<Record<ScreenSectionKey, unknown>>;

  for (const section of screenSectionOptions) {
    if (typeof rawSettings[section.key] === "boolean") {
      normalized[section.key] = rawSettings[section.key] as boolean;
    }
  }

  return normalized;
}

function screenSettingsEqual(a: ScreenSettings, b: ScreenSettings) {
  return screenSectionOptions.every(
    (section) => a[section.key] === b[section.key]
  );
}

function normalizeWorkspaceName(value: unknown) {
  if (typeof value !== "string") return DEFAULT_WORKSPACE_NAME;

  const trimmed = value.trim();

  if (!trimmed) return DEFAULT_WORKSPACE_NAME;

  return trimmed.slice(0, 80);
}

function formatWorkspaceFileSlug(value: unknown) {
  return (
    normalizeWorkspaceName(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

function isWorkspaceAuthorityRole(value: unknown): value is WorkspaceAuthorityRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "leader" ||
    value === "parent" ||
    value === "member" ||
    value === "viewer"
  );
}



function normalizeProgressLogStatus(value: unknown): ProgressLogStatus {
  if (value === "pending" || value === "approved" || value === "rejected") {
    return value;
  }

  return "approved";
}



function isActivityEventAction(value: unknown): value is ActivityEventAction {
  return (
    value === "workspace_renamed" ||
    value === "progress_log_deleted" ||
    value === "target_deleted" ||
    value === "member_deleted" ||
    value === "progress_cleared" ||
    value === "backup_imported" ||
    value === "demo_workspace_loaded" ||
    value === "fresh_workspace_started" ||
    value === "cloud_saved" ||
    value === "cloud_loaded"
  );
}

function normalizeActivityMetadata(
  value: unknown
): ActivityEvent["metadata"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized: Record<string, string | number | boolean | null> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    const safeKey = key.slice(0, 60);

    if (typeof rawValue === "string") {
      normalized[safeKey] = rawValue.slice(0, 160);
    } else if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      normalized[safeKey] = rawValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeActivityEvents(value: unknown): ActivityEvent[] {
  if (!Array.isArray(value)) return [];

  const events: ActivityEvent[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const rawEvent = item as Partial<ActivityEvent>;
    const createdAt = new Date(String(rawEvent.createdAt));

    if (
      typeof rawEvent.id !== "string" ||
      !isActivityEventAction(rawEvent.action) ||
      typeof rawEvent.message !== "string" ||
      Number.isNaN(createdAt.getTime())
    ) {
      continue;
    }

    const event: ActivityEvent = {
      id: rawEvent.id,
      action: rawEvent.action,
      message: rawEvent.message.slice(0, 240),
      createdAt: createdAt.toISOString(),
      workspaceName: normalizeWorkspaceName(rawEvent.workspaceName),
    };

    const metadata = normalizeActivityMetadata(rawEvent.metadata);

    if (metadata) {
      event.metadata = metadata;
    }

    events.push(event);
  }

  return events
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, MAX_ACTIVITY_EVENTS);
}

function formatActivityAction(action: ActivityEventAction) {
  const labels: Record<ActivityEventAction, string> = {
    workspace_renamed: "Workspace renamed",
    progress_log_deleted: "Progress log deleted",
    target_deleted: "Target deleted",
    member_deleted: "Local profile deleted",
    progress_cleared: "Progress cleared",
    backup_imported: "Backup imported",
    demo_workspace_loaded: "Demo workspace loaded",
    fresh_workspace_started: "Fresh workspace started",
    cloud_saved: "Cloud saved",
    cloud_loaded: "Cloud loaded",
  };

  return labels[action];
}
function getAuthorityCapabilities(role: WorkspaceAuthorityRole) {
  const canManageEverything = role === "owner";
  const canManageMembers =
    role === "owner" || role === "admin" || role === "leader" || role === "parent";
  const canAssignTargets = canManageMembers;
  const canApproveWork = canManageMembers;
  const canSubmitWork = role !== "viewer";
  const canEditSettings = role === "owner" || role === "admin";

  return {
    canManageEverything,
    canManageMembers,
    canAssignTargets,
    canApproveWork,
    canSubmitWork,
    canEditSettings,
  };
}

export default function Home() {
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceNameBeforeEditRef = useRef(DEMO_WORKSPACE_NAME);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(monthStartISO(todayISO()));
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [activeWorkerId, setActiveWorkerId] = useState("me");

  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");

  const [workspaceName, setWorkspaceName] = useState(DEMO_WORKSPACE_NAME);


  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasLoadedSavedData, setHasLoadedSavedData] = useState(false);

  const [newMemberName, setNewMemberName] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("tasks");
  const [newFrequency, setNewFrequency] = useState<Frequency>("daily");
  const [newStartDate, setNewStartDate] = useState(todayISO());
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
  const [editStartDate, setEditStartDate] = useState(todayISO());
  const [editAmount, setEditAmount] = useState(1);
  const [editUnit, setEditUnit] = useState("tasks");

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState("");

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDate, setEditLogDate] = useState(todayISO());
  const [editLogAmount, setEditLogAmount] = useState(1);

  const [screenSettings, setScreenSettings] = useState<ScreenSettings>(
    defaultScreenSettings
  );
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [currentAuthorityRole, setCurrentAuthorityRole] =
    useState<WorkspaceAuthorityRole>("owner");
  const [activeAppView, setActiveAppView] = useState<AppView>("dashboard");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [supabaseConnectionStatus, setSupabaseConnectionStatus] =
    useState<SupabaseConnectionStatus>("checking");
  const [supabaseConnectionMessage, setSupabaseConnectionMessage] = useState(
    "Checking backend connection..."
  );

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const [cloudSyncMessage, setCloudSyncMessage] = useState(
    "Manual cloud sync is available after sign in. Choose Save local data to cloud or Load cloud data deliberately. Sync is not automatic yet."
  );
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudWorkspaceName, setCloudWorkspaceName] = useState("");
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [, setHasDismissedSampleBanner] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfigStatus();

    if (!config.isConfigured) {
      setSupabaseConnectionStatus("missing");
      setSupabaseConnectionMessage(
        "Cloud account settings are missing. Local-only mode is active; export JSON backups before changing devices."
      );
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setSupabaseConnectionStatus("missing");
      setSupabaseConnectionMessage(
        "Cloud account connection could not be created. Local-only mode is active; export JSON backups before changing devices."
      );
      return;
    }

    let isMounted = true;
    const timeoutMessage =
      "Cloud backend is unreachable. Local-only mode is active; export JSON backups before changing devices.";

    withTimeout(
      supabase.auth.getSession(),
      SUPABASE_CONNECTION_TIMEOUT_MS,
      timeoutMessage
    )
      .then(({ error }) => {
        if (!isMounted) return;

        if (error) {
          setSupabaseConnectionStatus("error");
          setSupabaseConnectionMessage(error.message);
          return;
        }

        setSupabaseConnectionStatus("connected");
        setSupabaseConnectionMessage(
          "Cloud backend is connected. Sign in to manually save or load a cloud copy."
        );
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        const message =
          error instanceof Error
            ? error.message
            : "Could not reach the cloud backend.";

        if (message === timeoutMessage) {
          setSupabaseConnectionStatus("unreachable");
          setSupabaseConnectionMessage(timeoutMessage);
          return;
        }

        setSupabaseConnectionStatus("error");
        setSupabaseConnectionMessage(message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) return;

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      setCurrentUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(window.navigator.onLine);
    }

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") return;

    const canRegister = window.location.protocol === "https:";
    if (!canRegister) return;

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const currentCategories = targets
      .map((target) => target.category || "General")
      .filter(Boolean);

    return Array.from(
      new Set([...suggestedCategories, ...currentCategories])
    ).sort((a, b) => a.localeCompare(b));
  }, [targets]);

  function normalizeMembers(rawMembers: unknown[]): Member[] {
    const seenMemberIds = new Set<string>();
    const normalizedMembers: Member[] = [];

    for (const item of rawMembers) {
      const member = item as Partial<Member>;
      const id = typeof member.id === "string" ? member.id.trim() : "";

      if (!id || seenMemberIds.has(id)) continue;

      seenMemberIds.add(id);
      normalizedMembers.push({
        id,
        name:
          typeof member.name === "string" && member.name.trim()
            ? member.name.trim()
            : "Unnamed profile",
        role: LOCAL_PROFILE_ROLE,
      });
    }

    return normalizedMembers;
  }

  function normalizeTargets(rawTargets: unknown[]): Target[] {
    const seenTargetIds = new Set<string>();
    const normalizedTargets: Target[] = [];

    for (const item of rawTargets) {
      const target = item as Partial<Target>;
      const id = typeof target.id === "string" ? target.id.trim() : "";

      if (!id || seenTargetIds.has(id)) continue;

      const targetAmount =
        typeof target.targetAmount === "number" &&
        isPositiveFiniteNumber(target.targetAmount)
          ? target.targetAmount
          : 1;

      seenTargetIds.add(id);
      normalizedTargets.push({
        id,
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
          typeof target.ownerId === "string" && target.ownerId.trim()
            ? target.ownerId.trim()
            : "me",
        frequency: isFrequency(target.frequency) ? target.frequency : "daily",
        targetAmount,
        unit:
          typeof target.unit === "string" && target.unit.trim()
            ? target.unit.trim()
            : "tasks",
        startDate: isValidDateISO(target.startDate)
          ? target.startDate
          : todayISO(),
        isArchived:
          typeof target.isArchived === "boolean" ? target.isArchived : false,
        claimedByMemberId:
          typeof target.claimedByMemberId === "string" &&
          target.claimedByMemberId.trim()
            ? target.claimedByMemberId.trim()
            : undefined,
        claimedAt:
          typeof target.claimedAt === "string" && target.claimedAt
            ? target.claimedAt
            : undefined,
      });
    }

    return normalizedTargets;
  }

  function normalizeLogs(rawLogs: unknown[]): ProgressLog[] {
    const seenLogIds = new Set<string>();
    const normalizedLogs: ProgressLog[] = [];

    for (const item of rawLogs) {
      const log = item as Partial<ProgressLog>;
      const id = typeof log.id === "string" ? log.id.trim() : "";
      const targetId =
        typeof log.targetId === "string" ? log.targetId.trim() : "";

      if (!id || !targetId || seenLogIds.has(id)) continue;

      const date = isValidDateISO(log.date) ? log.date : todayISO();
      const achievedAmount =
        typeof log.achievedAmount === "number" &&
        isPositiveFiniteNumber(log.achievedAmount)
          ? log.achievedAmount
          : 1;

      seenLogIds.add(id);
      normalizedLogs.push({
        id,
        targetId,
        date,
        achievedAmount,
        createdAt:
          typeof log.createdAt === "string" && log.createdAt
            ? log.createdAt
            : `${date}T00:00:00.000Z`,
      });
    }

    return normalizedLogs;
  }

  function makeSafeState(rawState: Partial<SavedAppState>) {
    const importedMembers = Array.isArray(rawState.members)
      ? normalizeMembers(rawState.members)
      : [];
    const safeMembers = importedMembers.length > 0 ? importedMembers : initialMembers;
    const validMemberIds = new Set(safeMembers.map((member) => member.id));

    const safeTargets = (Array.isArray(rawState.targets)
      ? normalizeTargets(rawState.targets)
      : createDemoTargetsForDate(todayISO())
    ).map((target) => ({
      ...target,
      ownerId: validMemberIds.has(target.ownerId)
        ? target.ownerId
        : safeMembers[0].id,
      claimedByMemberId:
        target.claimedByMemberId && validMemberIds.has(target.claimedByMemberId)
          ? target.claimedByMemberId
          : undefined,
      claimedAt:
        target.claimedByMemberId && validMemberIds.has(target.claimedByMemberId)
          ? target.claimedAt
          : undefined,
    }));

    const validTargetIds = new Set(safeTargets.map((target) => target.id));
    const safeLogs = (Array.isArray(rawState.logs)
      ? normalizeLogs(rawState.logs)
      : []
    ).filter((log) => validTargetIds.has(log.targetId));

    const usedMemberIds = new Set(safeTargets.map((target) => target.ownerId));
    const demoVisibleMembers =
      normalizeWorkspaceName(rawState.workspaceName) === DEMO_WORKSPACE_NAME
        ? safeMembers.filter(
            (member) => member.id !== "family" || usedMemberIds.has(member.id)
          )
        : safeMembers;
    const finalMembers =
      demoVisibleMembers.length > 0 ? demoVisibleMembers : safeMembers;

    return {
      members: finalMembers,
      targets: safeTargets,
      logs: safeLogs,
    };
  }

  useEffect(() => {
    const clientToday = todayISO();
    const savedData = window.localStorage.getItem(STORAGE_KEY);

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData) as SavedAppState;
        const safeState = makeSafeState(parsedData);

        setMembers(safeState.members);
        setTargets(safeState.targets);
        setLogs(safeState.logs);
        setActivityEvents(normalizeActivityEvents(parsedData.activityEvents));
        setWorkspaceName(normalizeWorkspaceName(parsedData.workspaceName));
        setNewOwnerId(safeState.members[0]?.id ?? "me");
        setSelectedDate(clientToday);
        setCalendarMonth(monthStartISO(clientToday));

        if (parsedData.screenSettings) {
          setScreenSettings(normalizeScreenSettings(parsedData.screenSettings));
        }

        if (isWorkspaceAuthorityRole(parsedData.currentAuthorityRole)) {
          setCurrentAuthorityRole(parsedData.currentAuthorityRole);
        }

        if (typeof parsedData.lastSavedAt === "string") {
          setLastSavedAt(parsedData.lastSavedAt);
        } else {
          setLastSavedAt(new Date().toISOString());
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        setSelectedDate(clientToday);
        setCalendarMonth(monthStartISO(clientToday));
        setTargets(createDemoTargetsForDate(clientToday));
        setNewStartDate(clientToday);
        setEditStartDate(clientToday);
        setEditLogDate(clientToday);
        setLastSavedAt(new Date().toISOString());
      }
    } else {
      setSelectedDate(clientToday);
      setCalendarMonth(monthStartISO(clientToday));
      setTargets(createDemoTargetsForDate(clientToday));
      setNewStartDate(clientToday);
      setEditStartDate(clientToday);
      setEditLogDate(clientToday);
      setLastSavedAt(new Date().toISOString());
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
        workspaceName: normalizeWorkspaceName(workspaceName),
        members,
        targets,
        logs,
        activityEvents,
        screenSettings,
        lastSavedAt: savedAt,
      })
    );
  }, [workspaceName, members, targets, logs, activityEvents, screenSettings, hasLoadedSavedData]);


  

  function addActivityEvent(
    action: ActivityEventAction,
    message: string,
    metadata: ActivityEvent["metadata"] = {},
    eventWorkspaceName = workspaceName
  ) {
    const event: ActivityEvent = {
      id: createId("activity"),
      action,
      message: message.slice(0, 240),
      createdAt: new Date().toISOString(),
      workspaceName: normalizeWorkspaceName(eventWorkspaceName),
    };

    const safeMetadata = normalizeActivityMetadata(metadata);

    if (safeMetadata) {
      event.metadata = safeMetadata;
    }

    setActivityEvents((currentEvents) =>
      [event, ...currentEvents].slice(0, MAX_ACTIVITY_EVENTS)
    );
  }


  function commitWorkspaceNameChange() {
    const previousName = normalizeWorkspaceName(
      workspaceNameBeforeEditRef.current
    );
    const nextName = normalizeWorkspaceName(workspaceName);

    setWorkspaceName(nextName);

    if (previousName !== nextName) {
      addActivityEvent(
        "workspace_renamed",
        `Workspace renamed from "${previousName}" to "${nextName}".`,
        { from: previousName, to: nextName },
        nextName
      );
    }

    workspaceNameBeforeEditRef.current = nextName;
  }

  useEffect(() => {
    if (members.length === 0) return;

    const validMemberIds = new Set(members.map((member) => member.id));
    const fallbackMemberId = members[0].id;

    if (selectedMemberId !== "all" && !validMemberIds.has(selectedMemberId)) {
      setSelectedMemberId("all");
    }

    if (!validMemberIds.has(activeWorkerId)) {
      setActiveWorkerId(fallbackMemberId);
    }

    if (!validMemberIds.has(newOwnerId)) {
      setNewOwnerId(fallbackMemberId);
    }

    if (!validMemberIds.has(editOwnerId)) {
      setEditOwnerId(fallbackMemberId);
    }
  }, [members, selectedMemberId, activeWorkerId, newOwnerId, editOwnerId]);

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
            ? 0
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
      status: getStatus(pending, progress, dateISO, target.frequency),
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

    const archiveMatches = archiveMatchesFilter(
      row.target.isArchived,
      archiveFilter
    );

    const searchableText = [
      row.target.title,
      row.target.description,
      row.target.category,
      row.target.unit,
      row.target.frequency,
      row.target.isArchived ? "archived" : "active",
      priorityLabel(row.target.priority),
      row.owner?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const searchMatches = !query || searchableText.includes(query);

    return (
      memberMatches &&
      priorityMatches &&
      statusMatches &&
      categoryMatches &&
      archiveMatches &&
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
            ? 0
            : Math.min(100, Math.round((achieved / required) * 100));

    return {
      date: dateISO,
      required,
      achieved,
      pending,
      progress,
      status: getStatus(pending, progress, dateISO),
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
        if (a.target.isArchived !== b.target.isArchived) {
          return Number(a.target.isArchived) - Number(b.target.isArchived);
        }

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
    archiveFilter,
    members,
  ]);

  const pendingApprovalLogs = useMemo(() => {
    return logs
      .filter((log) => normalizeProgressLogStatus(log.status) === "pending")
      .map((log) => {
        const target = targets.find((item) => item.id === log.targetId);
        const submittedBy = members.find(
          (member) => member.id === log.submittedByMemberId
        );

        return {
          log,
          target,
          submittedBy,
        };
      })
      .filter((row) => Boolean(row.target))
      .sort((a, b) =>
        (b.log.createdAt || b.log.date).localeCompare(
          a.log.createdAt || a.log.date
        )
      );
  }, [logs, targets, members]);

  const rejectedApprovalLogs = useMemo(() => {
    return logs
      .filter((log) => normalizeProgressLogStatus(log.status) === "rejected")
      .map((log) => {
        const target = targets.find((item) => item.id === log.targetId);
        const submittedBy = members.find(
          (member) => member.id === log.submittedByMemberId
        );

        return {
          log,
          target,
          submittedBy,
        };
      })
      .filter((row) => Boolean(row.target))
      .sort((a, b) =>
        (b.log.createdAt || b.log.date).localeCompare(
          a.log.createdAt || a.log.date
        )
      )
      .slice(0, 5);
  }, [logs, targets, members]);

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
        (row) =>
          row.target.ownerId === member.id &&
          archiveMatchesFilter(row.target.isArchived, archiveFilter)
      );

      const required = memberRows.reduce((sum, row) => sum + row.required, 0);
      const achieved = memberRows.reduce((sum, row) => sum + row.achieved, 0);
      const pending = memberRows.reduce((sum, row) => sum + row.pending, 0);
      const progress =
          required === 0
            ? 0
            : Math.min(100, Math.round((achieved / required) * 100));

      return {
        member,
        required,
        achieved,
        pending,
        progress,
        targetCount: memberRows.length,
        status: getStatus(pending, progress, selectedDate),
      };
    });
  }, [members, dashboard, archiveFilter, selectedDate]);

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
          role: LOCAL_PROFILE_ROLE,
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
    selectedMemberId,
    searchQuery,
    priorityFilter,
    statusFilter,
    categoryFilter,
    archiveFilter,
    targets,
    logs,
    members,
  ]);

  const completionHistory = useMemo(() => {
    const historyEndDate = todayISO();
    const lastThirtyDays = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(historyEndDate, index - 29);
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
    archiveFilter,
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
    archiveFilter,
    targets,
    logs,
    members,
  ]);

  function selectCalendarDate(dateISO: string) {
    if (!isValidDateISO(dateISO)) return;

    setSelectedDate(dateISO);
    setCalendarMonth(monthStartISO(dateISO));
  }

  function clearFilters() {
    setSearchQuery("");
    setPriorityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setArchiveFilter("active");
    setSelectedMemberId("all");
  }

  function logProgress(targetId: string, amount: number) {
    if (!isPositiveFiniteNumber(amount) || !isValidDateISO(selectedDate)) return;

    setLogs((currentLogs) => [
      ...currentLogs,
      {
        id: createId("log"),
        targetId,
        date: selectedDate,
        achievedAmount: amount,
        createdAt: new Date().toISOString(),
        status: normalizeProgressLogStatus("approved"),
      },
    ]);
  }

  function logManualProgress(targetId: string) {
    const rawAmount = manualAmounts[targetId];
    const amount = Number(rawAmount);

    if (!rawAmount || !isPositiveFiniteNumber(amount)) {
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

    if (!isValidDateISO(editLogDate)) {
      window.alert("Log date must be a valid calendar date.");
      return;
    }

    if (!isPositiveFiniteNumber(editLogAmount)) {
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

    const target = targets.find((item) => item.id === log.targetId);

    const shouldDelete = window.confirm(
      `Delete this progress log?\n\nAmount: +${log.achievedAmount}\nDate: ${log.date}\n\nThis cannot be undone.`
    );

    if (!shouldDelete) return;

    setLogs((currentLogs) => currentLogs.filter((item) => item.id !== logId));

    addActivityEvent(
      "progress_log_deleted",
      `Progress log deleted: +${log.achievedAmount} on ${log.date}${target ? ` for "${target.title}"` : ""}.`,
      {
        logId,
        targetId: log.targetId,
        targetTitle: target?.title ?? "Unknown target",
        amount: log.achievedAmount,
        date: log.date,
      }
    );

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
    setEditStartDate(target.startDate);
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
    setEditStartDate(todayISO());
    setEditAmount(1);
    setEditUnit("tasks");
  }

  function saveEditedTarget() {
    if (!editingTargetId) return;

    if (!editTitle.trim()) {
      window.alert("Target name cannot be empty.");
      return;
    }

    if (!isValidDateISO(editStartDate)) {
      window.alert("Edited target date must be a valid calendar date.");
      return;
    }

    if (!isPositiveFiniteNumber(editAmount)) {
      window.alert("Target amount must be greater than 0.");
      return;
    }

    if (!editUnit.trim()) {
      window.alert("Unit cannot be empty.");
      return;
    }

    if (!members.some((member) => member.id === editOwnerId)) {
      window.alert("Choose a valid assigned local profile.");
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
              startDate: editStartDate,
              targetAmount: editAmount,
              unit: editUnit.trim(),
            }
          : target
      )
    );

    cancelEditingTarget();
  }

  function toggleTargetArchive(targetId: string) {
    const target = targets.find((item) => item.id === targetId);
    if (!target) return;

    const shouldToggle = window.confirm(
      target.isArchived
        ? `Restore target "${target.title}"? It will appear with active targets again.`
        : `Archive target "${target.title}"? Its progress logs will be kept, but it will be hidden from the active view.`
    );

    if (!shouldToggle) return;

    setTargets((currentTargets) =>
      currentTargets.map((item) =>
        item.id === targetId
          ? {
              ...item,
              isArchived: !item.isArchived,
            }
          : item
      )
    );

    if (editingTargetId === targetId) cancelEditingTarget();
  }

  function startEditingMember(member: Member) {
    setEditingMemberId(member.id);
    setEditMemberName(member.name);
  }

  function cancelEditingMember() {
    setEditingMemberId(null);
    setEditMemberName("");
  }

  function saveEditedMember() {
    if (!editingMemberId) return;

    if (!editMemberName.trim()) {
      window.alert("Local profile name cannot be empty.");
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === editingMemberId
          ? { ...member, name: editMemberName.trim(), role: LOCAL_PROFILE_ROLE }
          : member
      )
    );

    cancelEditingMember();
  }

  function getActiveWorkerId() {
    if (members.some((member) => member.id === activeWorkerId)) {
      return activeWorkerId;
    }

    if (
      selectedMemberId !== "all" &&
      members.some((member) => member.id === selectedMemberId)
    ) {
      return selectedMemberId;
    }

    return members[0]?.id ?? "";
  }

  function getClaimedMemberName(memberId?: string) {
    if (!memberId) return "";

    return members.find((member) => member.id === memberId)?.name ?? "Unknown";
  }

  function claimTarget(targetId: string) {
    if (!authorityCapabilities.canSubmitWork) {
      window.alert("View-only permission cannot claim tasks.");
      return;
    }

    const workerId = getActiveWorkerId();

    if (!workerId) {
      window.alert("Add or select a local profile before claiming a task.");
      return;
    }

    const target = targets.find((item) => item.id === targetId);

    if (!target) return;

    if (target.isArchived) {
      window.alert("Archived tasks cannot be claimed.");
      return;
    }

    if (target.claimedByMemberId && target.claimedByMemberId !== workerId) {
      window.alert(
        `This task is already being worked on by ${getClaimedMemberName(
          target.claimedByMemberId
        )}.`
      );
      return;
    }

    setTargets((currentTargets) =>
      currentTargets.map((item) =>
        item.id === targetId
          ? {
              ...item,
              claimedByMemberId: workerId,
              claimedAt: new Date().toISOString(),
            }
          : item
      )
    );
  }

  function releaseTargetClaim(targetId: string) {
    const workerId = getActiveWorkerId();
    const target = targets.find((item) => item.id === targetId);

    if (!target) return;

    const isOwnClaim = target.claimedByMemberId === workerId;

    if (!isOwnClaim && !authorityCapabilities.canAssignTargets) {
      window.alert("Only the person working on it or someone with assign-target permission can release this claim.");
      return;
    }

    setTargets((currentTargets) =>
      currentTargets.map((item) =>
        item.id === targetId
          ? {
              ...item,
              claimedByMemberId: undefined,
              claimedAt: undefined,
            }
          : item
      )
    );
  }

  function addQuickTaskFromList() {
    const title = quickTaskTitle.trim();

    if (!title) return;

    if (!authorityCapabilities.canAssignTargets) {
      window.alert("Only permission presets with target-management access can add or assign tasks.");
      return;
    }

    const ownerId =
      selectedMemberId !== "all" &&
      members.some((member) => member.id === selectedMemberId)
        ? selectedMemberId
        : members[0]?.id ?? "me";

    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id: createId("target"),
        title,
        description: "",
        category: "General",
        priority: "medium",
        ownerId,
        frequency: "once",
        targetAmount: 1,
        unit: "task",
        startDate: selectedDate,
        isArchived: false,
      },
    ]);

    setQuickTaskTitle("");
  }

  function addTarget() {
    if (!newTitle.trim()) return;

    if (!isValidDateISO(newStartDate)) {
      window.alert("Target date must be a valid calendar date.");
      return;
    }

    if (!isPositiveFiniteNumber(newAmount)) {
      window.alert("Target amount must be greater than 0.");
      return;
    }

    if (!newUnit.trim()) {
      window.alert("Unit cannot be empty.");
      return;
    }

    const ownerId = members.some((member) => member.id === newOwnerId)
      ? newOwnerId
      : members[0]?.id;

    if (!ownerId) {
      window.alert("Add at least one local profile before creating a target.");
      return;
    }

    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id: createId("target"),
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory.trim() || "General",
        priority: newPriority,
        ownerId,
        frequency: newFrequency,
        targetAmount: newAmount,
        unit: newUnit.trim(),
        startDate: newStartDate,
        isArchived: false,
      },
    ]);

    setNewTitle("");
    setNewDescription("");
    setNewCategory("General");
    setNewPriority("medium");
    setNewAmount(1);
    setNewUnit("tasks");
    setNewFrequency("daily");
    setNewStartDate(todayISO());
  }

  function addMember() {
    if (!authorityCapabilities.canManageMembers) {
      window.alert("Only permission presets with profile-management access can add local profiles.");
      return;
    }

    if (!newMemberName.trim()) return;

    const newMemberId = createId("member");

    setMembers((currentMembers) => [
      ...currentMembers,
      { id: newMemberId, name: newMemberName.trim(), role: LOCAL_PROFILE_ROLE },
    ]);

    setNewOwnerId(newMemberId);
    setNewMemberName("");
  }

  function deleteTarget(targetId: string) {
    const target = targets.find((item) => item.id === targetId);
    if (!target) return;

    const removedLogCount = logs.filter((log) => log.targetId === targetId).length;

    const shouldDelete = window.confirm(
      `Delete target "${target.title}"?\n\nThis will also delete all progress logs for this target.\n\nUse Archive instead if you want to keep history.\n\nThis cannot be undone.`
    );

    if (!shouldDelete) return;

    setTargets((currentTargets) =>
      currentTargets.filter((item) => item.id !== targetId)
    );

    setLogs((currentLogs) =>
      currentLogs.filter((log) => log.targetId !== targetId)
    );

    addActivityEvent(
      "target_deleted",
      `Target deleted: "${target.title}" (${removedLogCount} progress logs removed).`,
      {
        targetId,
        targetTitle: target.title,
        removedLogCount,
      }
    );

    if (editingTargetId === targetId) cancelEditingTarget();
  }

  function deleteMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;

    if (members.length <= 1) {
      window.alert("You must keep at least one local profile.");
      return;
    }

    const memberTargets = targets.filter(
      (target) => target.ownerId === memberId
    );

    const shouldDelete = window.confirm(
      `Delete local profile "${member.name}"?\n\nThis will also delete ${memberTargets.length} assigned targets and their related progress logs.\n\nThis cannot be undone.`
    );

    if (!shouldDelete) return;

    const memberTargetIds = memberTargets.map((target) => target.id);
    const removedLogCount = logs.filter((log) =>
      memberTargetIds.includes(log.targetId)
    ).length;

    setMembers((currentMembers) =>
      currentMembers.filter((item) => item.id !== memberId)
    );

    setTargets((currentTargets) =>
      currentTargets.filter((target) => target.ownerId !== memberId)
    );

    setLogs((currentLogs) =>
      currentLogs.filter((log) => !memberTargetIds.includes(log.targetId))
    );

    addActivityEvent(
      "member_deleted",
      `Local profile deleted: "${member.name}" (${memberTargets.length} targets and ${removedLogCount} progress logs removed).`,
      {
        memberId,
        memberName: member.name,
        removedTargetCount: memberTargets.length,
        removedLogCount,
      }
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
      [
      "Clear all progress logs?",
      "",
      "Targets and local profiles will stay.",
      "All achieved progress values will reset to zero.",
      "",
      "Export a backup first if this workspace matters.",
      "",
      "Continue?"
    ].join("\n")
    );

    if (!shouldClear) return;

    const clearedLogCount = logs.length;

    setLogs([]);
    addActivityEvent(
      "progress_cleared",
      `Progress cleared: ${clearedLogCount} progress logs removed.`,
      { clearedLogCount }
    );
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
        target.isArchived ? "Archived" : "Active",
        owner?.name ?? "Unknown",
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
        "Archive Status",
        "Assigned Profile",
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
        target?.isArchived ? "Archived" : "Active",
        log.targetId,
        owner?.name ?? "Unknown",
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
        "Archive Status",
        "Target ID",
        "Assigned Profile",
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
      workspaceName: normalizeWorkspaceName(workspaceName),
      version: APP_BACKUP_VERSION,
      selectedDate,
      calendarMonth,
      lastSavedAt,
      screenSettings,
      members,
      targets,
      logs,
      activityEvents,
    };

    downloadTextFile(
      `universal-targets-tracker-${formatWorkspaceFileSlug(workspaceName)}-backup-${todayISO()}.json`,
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
          "This backup is not valid. It must contain local profiles, targets, and logs."
        );
        return;
      }

      const safeState = makeSafeState(parsed);
      const importedWorkspaceName = normalizeWorkspaceName(parsed.workspaceName);

      if (safeState.members.length === 0) {
        window.alert("This backup has no valid local profiles.");
        return;
      }

      const shouldImport = window.confirm(
        `Import this backup?\n\nThis will replace the current local workspace on this device with:\n\nWorkspace: ${importedWorkspaceName}\n${safeState.members.length} local profiles\n${safeState.targets.length} targets\n${safeState.logs.length} progress logs\n\nExport a backup first if you may need the current workspace.\n\nContinue?`
      );

      if (!shouldImport) return;

      setMembers(safeState.members);
      setTargets(safeState.targets);
      setLogs(safeState.logs);
      setActivityEvents(normalizeActivityEvents(parsed.activityEvents));
      setWorkspaceName(importedWorkspaceName);

      addActivityEvent(
        "backup_imported",
        `Backup imported into "${importedWorkspaceName}": ${safeState.members.length} local profiles, ${safeState.targets.length} targets, ${safeState.logs.length} progress logs.`,
        {
          memberCount: safeState.members.length,
          targetCount: safeState.targets.length,
          logCount: safeState.logs.length,
        },
        importedWorkspaceName
      );
      setNewOwnerId(safeState.members[0]?.id ?? "me");
      setSelectedMemberId("all");
      setSearchQuery("");
      setPriorityFilter("all");
      setStatusFilter("all");
      setCategoryFilter("all");
      setArchiveFilter("active");
      setManualAmounts({});
      setScreenSettings(normalizeScreenSettings(parsed.screenSettings));
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
      [
      "Load demo workspace?",
      "",
      "This will replace the current local workspace on this device with sample local profiles, targets, and starter progress.",
      "",
      "Your cloud copy will NOT change unless you later click Save local data to cloud.",
      "",
      "Export a backup first if this workspace matters.",
      "",
      "Continue?"
    ].join("\n")
    );

    if (!shouldReset) return;

    const demoDate = todayISO();

    window.localStorage.removeItem(STORAGE_KEY);
    setMembers(initialMembers);
    setTargets(createDemoTargetsForDate(demoDate));
    setLogs([]);
    setActivityEvents([
      {
        id: createId("activity"),
        action: "demo_workspace_loaded",
        message: `Demo workspace loaded: "${DEMO_WORKSPACE_NAME}".`,
        createdAt: new Date().toISOString(),
        workspaceName: DEMO_WORKSPACE_NAME,
        metadata: {
          memberCount: initialMembers.length,
          targetCount: initialTargets.length,
          logCount: 0,
        },
      },
    ]);
    setWorkspaceName(DEMO_WORKSPACE_NAME);
    workspaceNameBeforeEditRef.current = DEMO_WORKSPACE_NAME;
    setSelectedMemberId("all");
    setSelectedDate(demoDate);
    setCalendarMonth(monthStartISO(demoDate));
    setSearchQuery("");
    setPriorityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setArchiveFilter("active");
    setNewOwnerId("me");
    setNewCategory("General");
    setScreenSettings(defaultScreenSettings);
    setCurrentAuthorityRole("owner");
    setIsCustomizeOpen(false);
    setManualAmounts({});
    cancelEditingTarget();
    cancelEditingMember();
    cancelEditingProgressLog();
  }

  const totalPending = visibleDashboard.reduce((sum, row) => sum + row.pending, 0);
  const totalAchieved = visibleDashboard.reduce((sum, row) => sum + row.achieved, 0);
  const totalRequired = visibleDashboard.reduce((sum, row) => sum + row.required, 0);
  const totalLogs = logs.length;
  const archivedCount = targets.filter((target) => target.isArchived).length;
  const activeTargetsCount = targets.filter((target) => !target.isArchived).length;

  const selectedMemberName =
    selectedMemberId === "all"
      ? "All profiles"
      : members.find((member) => member.id === selectedMemberId)?.name ??
        "Unknown";

  const activeFilterCount = [
    searchQuery.trim() ? "search" : "",
    selectedMemberId !== "all" ? "profile" : "",
    priorityFilter !== "all" ? "priority" : "",
    statusFilter !== "all" ? "status" : "",
    categoryFilter !== "all" ? "category" : "",
    archiveFilter !== "active" ? "archive" : "",
  ].filter(Boolean).length;

  const targetEmptyState = getTargetEmptyState({
    hasTargets: targets.length > 0,
    activeTargetsCount,
    archiveFilter,
    activeFilterCount,
  });

  const visibleScreenSections = screenSectionOptions.filter(
    (section) => screenSettings[section.key]
  ).length;
  const currentScreenPreset = screenPresetOptions.find((preset) =>
    screenSettingsEqual(screenSettings, preset.settings)
  );
  const currentScreenLabel = currentScreenPreset?.label ?? "Custom View";

  function applyScreenPreset(presetKey: ScreenPresetKey) {
    const preset = screenPresetOptions.find((item) => item.key === presetKey);
    if (!preset) return;

    setScreenSettings({ ...preset.settings });
  }

  function toggleScreenSection(sectionKey: ScreenSectionKey) {
    setScreenSettings((currentSettings) => ({
      ...currentSettings,
      [sectionKey]: !currentSettings[sectionKey],
    }));
  }

  function showAllScreenSections() {
    const fullPreset = screenPresetOptions.find((preset) => preset.key === "full");
    if (!fullPreset) return;

    setScreenSettings({ ...fullPreset.settings });
  }

  function resetScreenView() {
    setScreenSettings(defaultScreenSettings);
  }

  function startFreshWorkspace() {
    const shouldStartFresh = window.confirm(
      [
        "Start fresh on this device?",
        "",
        "This will remove local profiles, targets, and logs from this browser.",
        "Your cloud copy will NOT change unless you later click Save local data to cloud.",
        "",
        "Export a backup first if this workspace matters.",
        "",
        "Continue?"
      ].join("\n")
    );

    if (!shouldStartFresh) return;

    const freshMember = {
      id: "me",
      name: "Me",
      role: LOCAL_PROFILE_ROLE,
    };

    const freshDate = todayISO();

    setMembers([freshMember]);
    setTargets([]);
    setLogs([]);
    setActivityEvents([
      {
        id: createId("activity"),
        action: "fresh_workspace_started",
        message: `Fresh workspace started: "${DEFAULT_WORKSPACE_NAME}".`,
        createdAt: new Date().toISOString(),
        workspaceName: DEFAULT_WORKSPACE_NAME,
        metadata: {
          memberCount: 1,
          targetCount: 0,
          logCount: 0,
        },
      },
    ]);
    setWorkspaceName(DEFAULT_WORKSPACE_NAME);
    workspaceNameBeforeEditRef.current = DEFAULT_WORKSPACE_NAME;
    setSelectedMemberId("all");
    setActiveWorkerId(freshMember.id);
    setNewOwnerId(freshMember.id);
    setSelectedDate(freshDate);
    setCalendarMonth(monthStartISO(freshDate));
    setHasDismissedSampleBanner(true);
    setActiveAppView("dashboard");
    setScreenSettings(getAppViewSettings("dashboard"));
    setCloudSyncMessage(
      "Started fresh locally. Save to cloud only if you want to replace your cloud copy."
    );
  }

  function getAppViewSettings(view: AppView): ScreenSettings {
    if (view === "dashboard") {
      return {
        ...defaultScreenSettings,
        quickStart: true,
        dashboardInsights: true,
        localDataStatus: false,
        completionHistory: false,
        categoryOverview: false,
        managementControls: false,
        backupTools: false,
        searchFilters: false,
        loggingSummary: false,
        monthCalendar: false,
        selectedDayWork: false,
        workspaceOverview: false,
        addMember: false,
        addTarget: false,
      };
    }

    if (view === "targets") {
      return {
        ...defaultScreenSettings,
        quickStart: false,
        dashboardInsights: false,
        localDataStatus: false,
        completionHistory: false,
        categoryOverview: false,
        managementControls: false,
        backupTools: false,
        searchFilters: true,
        loggingSummary: false,
        monthCalendar: false,
        selectedDayWork: true,
        workspaceOverview: false,
        addMember: false,
        addTarget: true,
      };
    }

    if (view === "calendar") {
      return {
        ...defaultScreenSettings,
        quickStart: false,
        dashboardInsights: false,
        localDataStatus: false,
        completionHistory: false,
        categoryOverview: false,
        managementControls: false,
        backupTools: false,
        searchFilters: false,
        loggingSummary: true,
        monthCalendar: true,
        selectedDayWork: true,
        workspaceOverview: false,
        addMember: false,
        addTarget: false,
      };
    }

    if (view === "workspace") {
      return {
        ...defaultScreenSettings,
        quickStart: false,
        dashboardInsights: false,
        localDataStatus: false,
        completionHistory: false,
        categoryOverview: false,
        managementControls: false,
        backupTools: false,
        searchFilters: false,
        loggingSummary: false,
        monthCalendar: false,
        selectedDayWork: false,
        workspaceOverview: true,
        addMember: true,
        addTarget: false,
      };
    }

    if (view === "reports") {
      return {
        ...defaultScreenSettings,
        quickStart: false,
        dashboardInsights: true,
        localDataStatus: false,
        completionHistory: true,
        categoryOverview: true,
        managementControls: false,
        backupTools: true,
        searchFilters: false,
        loggingSummary: false,
        monthCalendar: false,
        selectedDayWork: false,
        workspaceOverview: false,
        addMember: false,
        addTarget: false,
      };
    }

    return {
      ...defaultScreenSettings,
      quickStart: false,
      dashboardInsights: false,
      localDataStatus: true,
      completionHistory: false,
      categoryOverview: false,
      managementControls: true,
      backupTools: false,
      searchFilters: false,
      loggingSummary: false,
      monthCalendar: false,
      selectedDayWork: false,
      workspaceOverview: false,
      addMember: false,
      addTarget: false,
    };
  }

  function openAppView(view: AppView) {
    setActiveAppView(view);
    setIsActionMenuOpen(false);
    setScreenSettings(getAppViewSettings(view));

    if (view !== "settings") {
      setIsCustomizeOpen(false);
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function openAction(
    action: "addTarget" | "addMember" | "logProgress" | "backup" | "customize"
  ) {
    if (action === "addTarget") {
      setActiveAppView("targets");
      setIsActionMenuOpen(false);
      setScreenSettings({
        ...getAppViewSettings("targets"),
        addTarget: true,
        selectedDayWork: true,
      });
      return;
    }

    if (action === "addMember") {
      setActiveAppView("workspace");
      setIsActionMenuOpen(false);
      setScreenSettings({
        ...getAppViewSettings("workspace"),
        addMember: true,
        workspaceOverview: true,
      });
      return;
    }

    if (action === "logProgress") {
      setActiveAppView("targets");
      setIsActionMenuOpen(false);
      setScreenSettings({
        ...getAppViewSettings("targets"),
        selectedDayWork: true,
      });
      return;
    }

    if (action === "backup") {
      setActiveAppView("reports");
      setIsActionMenuOpen(false);
      setScreenSettings({
        ...getAppViewSettings("reports"),
        backupTools: true,
      });
      return;
    }

    setActiveAppView("settings");
    setIsActionMenuOpen(false);
    setIsCustomizeOpen(true);
    setScreenSettings(getAppViewSettings("settings"));
  }

  function formatAuthErrorMessage(message: string) {
    const normalized = message.trim();
    const lower = normalized.toLowerCase();

    if (lower.includes("invalid login credentials")) {
      return "Email or password is incorrect. Check your details or create an account first.";
    }

    if (lower.includes("email not confirmed")) {
      return "Check your email and confirm the account before signing in.";
    }

    if (lower.includes("user already registered") || lower.includes("already registered")) {
      return "An account already exists for this email. Switch to Sign in.";
    }

    if (lower.includes("rate limit")) {
      return "Too many attempts. Wait a few minutes, then try again.";
    }

    return normalized || "Account action failed. Keep working locally and export a JSON backup.";
  }

  async function handleSignup() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthMessage(
        "Cloud accounts are not configured yet. You can keep using local mode and export JSON backups."
      );
      return;
    }

    if (supabaseConnectionStatus !== "connected") {
      setAuthMessage(
        "Cloud backend is not reachable. Continue in local-only mode and export JSON backups until backend access is restored."
      );
      return;
    }

    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();
    const displayName = authDisplayName.trim();

    if (!email || !email.includes("@")) {
      setAuthMessage("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthMessage("Creating account...");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email,
          },
        },
      });

      if (error) {
        setAuthMessage(formatAuthErrorMessage(error.message));
        return;
      }

      if (data.session?.user) {
        setCurrentUser(data.session.user);
        setAuthMessage(
          "Account created and signed in. Export a backup, then save local data to cloud only if this device has the version you want to keep."
        );
        setAuthPassword("");
        return;
      }

      setAuthMessage(
        "Account created. Check your email to confirm it, then return here and sign in. Your current workspace remains local on this device."
      );
      setAuthPassword("");
      setAuthMode("login");
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? formatAuthErrorMessage(error.message)
          : "Account creation failed. Keep working locally and export a JSON backup."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogin() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthMessage(
        "Cloud accounts are not configured yet. You can keep using local mode and export JSON backups."
      );
      return;
    }

    if (supabaseConnectionStatus !== "connected") {
      setAuthMessage(
        "Cloud backend is not reachable. Continue in local-only mode and export JSON backups until backend access is restored."
      );
      return;
    }

    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();

    if (!email || !email.includes("@")) {
      setAuthMessage("Enter a valid email address.");
      return;
    }

    if (!password) {
      setAuthMessage("Enter your password.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthMessage("Signing in...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthMessage(formatAuthErrorMessage(error.message));
        return;
      }

      setCurrentUser(data.user);
      setAuthMessage(
        "Signed in. Local data is still on this device until you manually save it to cloud or load a cloud copy."
      );
      setAuthPassword("");
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? formatAuthErrorMessage(error.message)
          : "Sign in failed. Keep working locally and export a JSON backup."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthMessage(
        "Cloud accounts are not configured yet. Local workspace data is still available on this device."
      );
      return;
    }

    setIsAuthSubmitting(true);
    setAuthMessage("Signing out...");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthMessage(formatAuthErrorMessage(error.message));
        return;
      }

      setCurrentUser(null);
      setAuthPassword("");
      setAuthMessage(
        "Signed out. Local workspace data is still available on this device. Export a backup before clearing browser data."
      );
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? formatAuthErrorMessage(error.message)
          : "Sign out failed. Local workspace data is still available on this device."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSaveLocalDataToCloud() {
    const supabase = getSupabaseClient();

    if (!currentUser || !supabase) {
      setCloudSyncMessage("Sign in before saving data to cloud.");
      return;
    }

    if (supabaseConnectionStatus !== "connected") {
      setCloudSyncMessage(
        "Cloud backend is not reachable. Keep working locally and export a JSON backup."
      );
      return;
    }

    const shouldSave = window.confirm(
      [
      "Save local data to cloud?",
      "",
      "This will overwrite the current cloud copy with the data on this device.",
      "",
      "Use this only when this device has the version you want to keep.",
      "",
      "Export a JSON backup first if this workspace matters.",
      "",
      "Continue?"
    ].join("\n")
    );

    if (!shouldSave) return;

    setIsCloudSyncing(true);
    setCloudSyncMessage("Saving local data to cloud...");

    try {
      const result = await saveLocalDataToCloud(supabase, currentUser, {
        members,
        targets,
        logs,
        activityEvents,
        workspaceName: normalizeWorkspaceName(workspaceName),
        screenSettings,
      });

      const savedWorkspaceName = normalizeWorkspaceName(result.workspace.name);

      setWorkspaceName(savedWorkspaceName);
      setCloudWorkspaceName(result.workspace.name);
      workspaceNameBeforeEditRef.current = savedWorkspaceName;
      setLastCloudSyncAt(new Date().toISOString());
      setCloudSyncMessage(
        `Saved "${result.workspace.name}" to cloud: ${result.memberCount} local profiles, ${result.targetCount} targets, ${result.logCount} logs, plus activity history.`
      );

      addActivityEvent(
        "cloud_saved",
        `Cloud saved: "${result.workspace.name}" with ${result.memberCount} local profiles, ${result.targetCount} targets, and ${result.logCount} progress logs.`,
        {
          memberCount: result.memberCount,
          targetCount: result.targetCount,
          logCount: result.logCount,
        },
        result.workspace.name
      );
    } catch (error) {
      setCloudSyncMessage(
        error instanceof Error ? error.message : "Cloud save failed."
      );
    } finally {
      setIsCloudSyncing(false);
    }
  }

  async function handleLoadCloudDataFromCloud() {
    const supabase = getSupabaseClient();

    if (!currentUser || !supabase) {
      setCloudSyncMessage("Sign in before loading cloud data.");
      return;
    }

    if (supabaseConnectionStatus !== "connected") {
      setCloudSyncMessage(
        "Cloud backend is not reachable. Keep working locally and export a JSON backup."
      );
      return;
    }

    const shouldLoad = window.confirm(
      [
        "Load cloud data into this device?",
        "",
        "This will replace this device's current local workspace with your cloud copy.",
        "Local profiles, targets, logs, claims, activity history, and screen settings on this device may change.",
        "Your cloud copy will NOT change from loading.",
        "",
        "Export a backup first if this device has data you may need.",
        "",
        "Continue?"
      ].join("\n")
    );

    if (!shouldLoad) {
      setCloudSyncMessage("Cloud load cancelled. This device was not changed.");
      return;
    }
setIsCloudSyncing(true);
    setCloudSyncMessage("Loading cloud data...");

    try {
      const result = await loadCloudDataFromCloud(supabase, currentUser);

      setMembers(result.members.length > 0 ? result.members : members);
      setTargets(result.targets);
      setLogs(result.logs);
      setActivityEvents(normalizeActivityEvents(result.activityEvents));

      if (result.screenSettings) {
        setScreenSettings(normalizeScreenSettings(result.screenSettings));
      }

      setSelectedMemberId("all");
      setNewOwnerId(result.members[0]?.id ?? "me");
      const loadedWorkspaceName = normalizeWorkspaceName(result.workspace.name);

      setWorkspaceName(loadedWorkspaceName);
      setCloudWorkspaceName(result.workspace.name);
      workspaceNameBeforeEditRef.current = loadedWorkspaceName;
      setLastCloudSyncAt(new Date().toISOString());
      setCloudSyncMessage(
        `Loaded "${result.workspace.name}" from cloud: ${result.members.length} local profiles, ${result.targets.length} targets, ${result.logs.length} logs, plus activity history.`
      );

      addActivityEvent(
        "cloud_loaded",
        `Cloud loaded: "${result.workspace.name}" with ${result.members.length} local profiles, ${result.targets.length} targets, and ${result.logs.length} progress logs.`,
        {
          memberCount: result.members.length,
          targetCount: result.targets.length,
          logCount: result.logs.length,
        },
        result.workspace.name
      );
    } catch (error) {
      setCloudSyncMessage(
        error instanceof Error ? error.message : "Cloud load failed."
      );
    } finally {
      setIsCloudSyncing(false);
    }
  }

  const authorityCapabilities = getAuthorityCapabilities(currentAuthorityRole);
  const currentAuthorityLabel =
    authorityRoleOptions.find((role) => role.value === currentAuthorityRole)
      ?.label ?? "Full access";

  if (!hasLoadedSavedData) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400 sm:text-sm sm:tracking-[0.3em]">
              Universal Targets Tracker
            </p>
            <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
              Loading your workspace
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Preparing the correct local date, workspace data, and browser
              storage before showing targets.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <datalist id="category-options">
          {categoryOptions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <header className="mb-6 flex flex-col gap-4 xl:mb-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400 sm:text-sm sm:tracking-[0.3em]">
              Universal Targets Tracker
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Workspace targets, backlog, and progress
            </h1>

            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              <span className="text-slate-400">Workspace:</span>
              <span className="truncate font-semibold text-white">{workspaceName || DEFAULT_WORKSPACE_NAME}</span>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Track daily, weekly, and monthly targets for individuals,
              families, teams, businesses, and classrooms. Missed work carries
              forward. Extra work gives future credit.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
            <FieldLabel label="Selected date">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => selectCalendarDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white"
              />
            </FieldLabel>

            <FieldLabel label="View profile">
              <select
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white"
              >
                <option value="all">All profiles</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
        </header>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-3 sm:mb-8 sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-sm sm:tracking-[0.25em]">
                Main navigation
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Choose what you want to do first. The app now shows focused
                sections instead of forcing every tool onto one screen.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap">
                {appViewOptions.map((view) => (
                  <button
                    key={view.key}
                    onClick={() => openAppView(view.key)}
                    className={
                      activeAppView === view.key
                        ? "rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950"
                        : "rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10"
                    }
                    title={view.description}
                  >
                    {view.label}
                  </button>
                ))}
              </nav>

              <div className="relative">
                <button
                  onClick={() => setIsActionMenuOpen((isOpen) => !isOpen)}
                  className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 lg:w-auto"
                >
                  + Add / Actions
                </button>

                {isActionMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
                    <button
                      onClick={() => openAction("addTarget")}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      Add target
                    </button>
                    <button
                      onClick={() => openAction("addMember")}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      Add local profile
                    </button>
                    <button
                      onClick={() => openAction("logProgress")}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      Log progress
                    </button>
                    <button
                      onClick={() => openAction("backup")}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      Backup / export
                    </button>
                    <button
                      onClick={() => openAction("customize")}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      Customize screen
                    </button>
                    <button
                      aria-label="Start fresh this device"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        startFreshWorkspace();
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-amber-200 hover:bg-amber-400/10"
                    >
                      Start fresh
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:p-5"
          style={{ display: activeAppView === "dashboard" || activeAppView === "targets" ? undefined : "none" }}
        >
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-sm sm:tracking-[0.25em]">
                Clean task list
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {activeAppView === "dashboard" ? "Today's work" : "Targets"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                A focused list view for daily use. Advanced editing, logs,
                archive, backup, and reports are still available from details,
                settings, and reports.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
              {visibleDashboard.length} visible
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Logging as local profile</p>
              <p className="mt-1 text-xs text-slate-500">
                Claims and quick tasks will use this local profile.
              </p>
            </div>

            <select
              value={activeWorkerId}
              onChange={(event) => setActiveWorkerId(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={quickTaskTitle}
              onChange={(event) => setQuickTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addQuickTaskFromList();
              }}
              placeholder="Add a task for the selected date..."
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500"
            />

            <button
              onClick={addQuickTaskFromList}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Add task
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
            {visibleDashboard.length > 0 ? (
              <div className="divide-y divide-white/10">
                {visibleDashboard.map((row) => (
                  <div
                    key={row.target.id}
                    className="grid gap-3 p-4 hover:bg-white/5 lg:grid-cols-[auto_1fr_auto] lg:items-center"
                  >
                    <button
                      onClick={() =>
                        logProgress(
                          row.target.id,
                          row.pending || row.target.targetAmount
                        )
                      }
                      disabled={row.target.isArchived}
                      className={
                        row.pending === 0
                          ? "h-7 w-7 rounded-full border border-emerald-400 bg-emerald-400/20 text-emerald-200"
                          : "h-7 w-7 rounded-full border border-slate-500 hover:border-cyan-300"
                      }
                      title="Mark done"
                    >
                      {row.pending === 0 ? "?" : ""}
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold">
                          {row.target.title}
                        </h3>

                        {row.target.isArchived && (
                          <span className="rounded-full border border-slate-400/30 bg-slate-500/20 px-2 py-0.5 text-xs text-slate-200">
                            Archived
                          </span>
                        )}

                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${priorityClass(
                            row.target.priority
                          )}`}
                        >
                          {priorityLabel(row.target.priority)}
                        </span>

                        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">
                          {row.target.frequency === "once"
                            ? "one-time"
                            : row.target.frequency}
                        </span>

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${statusClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {row.owner?.name ?? "Unknown"} -{" "}
                        {row.target.category || "General"} -{" "}
                        {row.target.frequency === "once" ? "Due" : "Starts"}{" "}
                        {row.target.startDate}
                      </p>

                      {row.target.claimedByMemberId ? (
                        <p className="mt-2 inline-flex rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                          Already working:{" "}
                          {getClaimedMemberName(row.target.claimedByMemberId)}
                        </p>
                      ) : (
                        <p className="mt-2 inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                          Available
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2 sm:flex sm:items-center sm:justify-end">
                      <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                        Need {formatQuantity(row.pending, row.target.unit)} / {formatQuantity(row.required, row.target.unit)}
                      </div>

                      <button
                        onClick={() => logProgress(row.target.id, 1)}
                        disabled={row.target.isArchived}
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        +1
                      </button>

                      {row.target.claimedByMemberId ? (
                        <button
                          onClick={() => releaseTargetClaim(row.target.id)}
                          className="rounded-xl border border-fuchsia-400/30 px-3 py-2 text-sm text-fuchsia-200 hover:bg-fuchsia-400/10"
                        >
                          Release
                        </button>
                      ) : (
                        <button
                          onClick={() => claimTarget(row.target.id)}
                          disabled={row.target.isArchived}
                          className="rounded-xl border border-emerald-400/30 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >{"I'm working"}</button>
                      )}

                      <button
                        onClick={() => {
                          setActiveAppView("targets");
                          startEditingTarget(row.target);
                          setScreenSettings((currentSettings) => ({
                            ...currentSettings,
                            searchFilters: true,
                            selectedDayWork: true,
                          }));
                        }}
                        className="rounded-xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-lg font-bold">{targetEmptyState.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {targetEmptyState.body}
                </p>
              </div>
            )}
          </div>
        </section>

        <section
          className="mb-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 sm:mb-8 sm:p-5"
          style={{ display: activeAppView === "workspace" ? undefined : "none" }}
        >
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300 sm:text-sm sm:tracking-[0.25em]">
                Pending approval
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {pendingApprovalLogs.length} item
                {pendingApprovalLogs.length === 1 ? "" : "s"} waiting
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Work submitted by local profiles for approval will appear here before it counts toward progress.
              </p>
            </div>

            <span
              className={
                authorityCapabilities.canApproveWork
                  ? "rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300"
                  : "rounded-full bg-slate-500/20 px-3 py-1 text-sm font-semibold text-slate-300"
              }
            >
              {authorityCapabilities.canApproveWork ? "Can approve" : "Cannot approve"}
            </span>
          </div>

          {pendingApprovalLogs.length > 0 ? (
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
              {pendingApprovalLogs.map(({ log, target, submittedBy }) => (
                <div
                  key={log.id}
                  className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold">{target?.title ?? "Unknown task"}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Submitted by {submittedBy?.name ?? "Unknown"} - {log.date} -{" "}
                      {formatQuantity(log.achievedAmount, target?.unit ?? "unit")}
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-200">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-400">
              No work is waiting for approval yet.
            </div>
          )}

          {rejectedApprovalLogs.length > 0 && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
              <p className="font-bold text-red-200">Recently rejected</p>

              <div className="mt-3 grid gap-3">
                {rejectedApprovalLogs.map(({ log, target, submittedBy }) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-3"
                  >
                    <p className="font-semibold">{target?.title ?? "Unknown task"}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Submitted by {submittedBy?.name ?? "Unknown"} - {log.date} -{" "}
                      {log.rejectionReason || "No rejection reason provided."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section
          className="mb-6 rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 sm:mb-8 sm:p-5"
          style={{ display: activeAppView === "workspace" ? undefined : "none" }}
        >
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300 sm:text-sm sm:tracking-[0.25em]">
                Workspace permissions
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Current permission preset: {currentAuthorityLabel}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Permission presets control who can manage local profiles, assign targets, approve work, submit progress, and edit settings.
              </p>
            </div>

            <select
              value={currentAuthorityRole}
              onChange={(event) =>
                setCurrentAuthorityRole(event.target.value as WorkspaceAuthorityRole)
              }
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
            >
              {authorityRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {authorityRoleOptions.map((role) => (
              <button
                key={role.value}
                onClick={() => setCurrentAuthorityRole(role.value)}
                className={
                  currentAuthorityRole === role.value
                    ? "rounded-2xl border border-fuchsia-300 bg-fuchsia-400/20 p-4 text-left"
                    : "rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-left hover:bg-white/10"
                }
              >
                <p className="font-bold">{role.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {role.description}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AuthorityBadge label="Manage profiles" active={authorityCapabilities.canManageMembers} />
            <AuthorityBadge label="Assign targets" active={authorityCapabilities.canAssignTargets} />
            <AuthorityBadge label="Approve work" active={authorityCapabilities.canApproveWork} />
            <AuthorityBadge label="Submit work" active={authorityCapabilities.canSubmitWork} />
            <AuthorityBadge label="Edit settings" active={authorityCapabilities.canEditSettings} />
          </div>

          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
            Current beta rule: local assignment profiles can be created by permission presets with profile-management access. Email invites, accepted workspace membership, and per-member permissions come next.
          </p>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300 sm:text-sm sm:tracking-[0.25em]">
              Workspace identity
            </p>
            <h2 className="mt-2 text-2xl font-bold">Name this workspace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This name appears in the header, backups, and manual cloud sync so you know which workspace you are saving or restoring.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <input
              value={workspaceName}
              onChange={(event) =>
                setWorkspaceName(event.target.value.slice(0, 80))
              }
              onFocus={() => {
                workspaceNameBeforeEditRef.current =
                  normalizeWorkspaceName(workspaceName);
              }}
              onBlur={commitWorkspaceNameChange}
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
              placeholder="Example: Sales Team, Family Goals, Class 8A"
            />

            <span className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              {workspaceName.length}/80 characters
            </span>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300 sm:text-sm sm:tracking-[0.25em]">
              Launch plan rules
            </p>
            <h2 className="mt-2 text-2xl font-bold">Free workspace limits</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Launch model: every user gets a personal workspace, can own up to
              {FREE_TEAM_WORKSPACE_LIMIT} team workspaces, and can allocate
              {FREE_OWNED_TEAM_SEAT_LIMIT} total teammate seats across owned
              team workspaces. Workspaces someone is invited into do not count
              against their owned-workspace quota.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusBox
              label="Plan"
              value={FREE_PLAN_NAME}
            />
            <StatusBox
              label="Personal workspace"
              value={`${FREE_PERSONAL_WORKSPACE_LIMIT} included`}
            />
            <StatusBox
              label="Owned team workspaces"
              value={`${FREE_TEAM_WORKSPACE_LIMIT} free`}
            />
            <StatusBox
              label="Owned teammate seats"
              value={`${FREE_OWNED_TEAM_SEAT_LIMIT} total`}
            />
          </div>

          <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm leading-6 text-slate-300">
            Pending invites {FREE_PLAN_PENDING_INVITES_COUNT ? "count" : "do not count"} toward owned seats. Current beta uses local assignment profiles. Real email invitations, accepted workspace membership, per-member permissions, and quota enforcement are the next backend step.
          </p>
        </section>

        <section
          className="mb-6 rounded-3xl border border-blue-400/20 bg-blue-400/10 p-4 sm:mb-8 sm:p-5"
          style={{ display: activeAppView === "settings" ? undefined : "none" }}
        >
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300 sm:text-sm sm:tracking-[0.25em]">
                Cloud data sync
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {currentUser ? "Manual cloud sync ready" : "Sign in to sync data"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {"Save this device's local profiles, targets, logs, activity history, and screen preferences "}
                to Supabase, or load your cloud copy onto this device. This first
                sync release is manual to prevent accidental overwrites.
              </p>
            </div>

            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-semibold text-blue-300">
              {cloudWorkspaceName || "Cloud workspace not loaded yet"}
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <button
              onClick={handleSaveLocalDataToCloud}
              disabled={!currentUser || isCloudSyncing}
              className="rounded-xl bg-blue-400 px-4 py-3 font-semibold text-slate-950 hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCloudSyncing ? "Working..." : "Save local data to cloud"}
            </button>

            <button
              onClick={handleLoadCloudDataFromCloud}
              disabled={!currentUser || isCloudSyncing}
              className="rounded-xl border border-blue-400/40 px-4 py-3 font-semibold text-blue-100 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCloudSyncing ? "Working..." : "Load cloud data"}
            </button>
          </div>

          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
            {cloudSyncMessage}
          </p>

          {lastCloudSyncAt && (
            <p className="mt-3 text-xs text-slate-500">
              Last cloud action: {formatSavedTime(lastCloudSyncAt)}
            </p>
          )}
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-sm sm:tracking-[0.25em]">
                Cloud backend status
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {supabaseConnectionStatus === "connected"
                  ? "Cloud backend connected"
                  : supabaseConnectionStatus === "checking"
                  ? "Checking backend"
                  : supabaseConnectionStatus === "missing" ||
                    supabaseConnectionStatus === "unreachable"
                  ? "Local mode active"
                  : "Backend connection issue"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {supabaseConnectionMessage}
              </p>
            </div>

            <span
              className={
                supabaseConnectionStatus === "connected"
                  ? "rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300"
                  : supabaseConnectionStatus === "checking"
                  ? "rounded-full bg-cyan-500/20 px-3 py-1 text-sm font-semibold text-cyan-300"
                  : supabaseConnectionStatus === "missing" ||
                    supabaseConnectionStatus === "unreachable"
                  ? "rounded-full bg-yellow-500/20 px-3 py-1 text-sm font-semibold text-yellow-300"
                  : "rounded-full bg-red-500/20 px-3 py-1 text-sm font-semibold text-red-300"
              }
            >
              {supabaseConnectionStatus}
            </span>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300 sm:text-sm sm:tracking-[0.25em]">
                Cloud account
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {currentUser ? "Signed in" : "Sign in or create account"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Create an account to manually save this browser workspace to cloud or load a cloud copy. Local data stays on this device until you choose a cloud action.
              </p>
            </div>

            <span
              className={
                currentUser
                  ? "rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300"
                  : "rounded-full bg-slate-500/20 px-3 py-1 text-sm font-semibold text-slate-300"
              }
            >
              {currentUser ? "signed in" : "local-only mode"}
            </span>
          </div>

          {currentUser ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-slate-400">Signed in as</p>
                  <p className="mt-1 break-all text-lg font-bold">
                    {currentUser.email}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Account is active. Manual cloud sync is available below.
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  disabled={isAuthSubmitting}
                  className="rounded-xl border border-red-400/30 px-4 py-3 font-semibold text-red-200 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAuthSubmitting ? "Working..." : "Sign out"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
              <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthMessage("");
                  }}
                  className={
                    authMode === "login"
                      ? "rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
                      : "rounded-xl border border-white/10 px-4 py-2 font-semibold hover:bg-white/10"
                  }
                >
                  Sign in
                </button>

                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthMessage("");
                  }}
                  className={
                    authMode === "signup"
                      ? "rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
                      : "rounded-xl border border-white/10 px-4 py-2 font-semibold hover:bg-white/10"
                  }
                >
                  Create account
                </button>
              </div>

              <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                {authMode === "signup"
                  ? "Create an account for manual cloud backup. This does not automatically upload local data."
                  : "Sign in to manually save this device to cloud or load your cloud copy."}
              </p>

              <div className="grid gap-3 lg:grid-cols-3">
                {authMode === "signup" && (
                  <input
                    value={authDisplayName}
                    onChange={(event) => setAuthDisplayName(event.target.value)}
                    placeholder="Display name"
                    autoComplete="name"
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  />
                )}

                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password - minimum 6 characters"
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <button
                  onClick={authMode === "signup" ? handleSignup : handleLogin}
                  disabled={isAuthSubmitting}
                  className="rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAuthSubmitting
                    ? "Working..."
                    : authMode === "signup"
                    ? "Create account"
                    : "Sign in"}
                </button>
              </div>

              {authMessage && (
                <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                  {authMessage}
                </p>
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Early beta: cloud sync is manual. Export a JSON backup before saving to cloud, loading from cloud, clearing browser data, or changing devices.
              </p>
            </div>
          )}
        </section>

        {!isOnline && (
          <section className="mb-6 rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-yellow-100 sm:mb-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">Offline mode</p>
                <p className="mt-1 text-sm leading-6 text-yellow-100/80">
                  You are offline. Changes stay on this device. Reconnect before
                  saving to cloud or loading a cloud copy.
                </p>
              </div>

              <span className="rounded-full bg-yellow-400/20 px-3 py-1 text-xs font-semibold">
                Local-only
              </span>
            </div>
          </section>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6" style={{ display: activeAppView === "dashboard" ? undefined : "none" }}>
          <StatCard label="Pending" value={totalPending} />
          <StatCard label="Achieved" value={totalAchieved} />
          <StatCard label="Required" value={totalRequired} />
          <StatCard label="Profiles" value={members.length} />
          <StatCard label="Logs" value={totalLogs} />
          <StatCard label="Archived" value={archivedCount} />
        </section>

        <section className="mb-6 rounded-3xl border border-cyan-400/20 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-sm sm:tracking-[0.25em]">
                Screen customization
              </p>
              <h2 className="mt-2 text-2xl font-bold">{currentScreenLabel}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Choose exactly what appears on your dashboard. This keeps the app
                simple for normal users while still keeping power tools available.
              </p>
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                {visibleScreenSections}/{screenSectionOptions.length} panels visible
              </div>

              <button
                onClick={() => setIsCustomizeOpen((isOpen) => !isOpen)}
                className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                {isCustomizeOpen ? "Close panel" : "Customize screen"}
              </button>
            </div>
          </div>

          {isCustomizeOpen && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-xl font-bold">View presets</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Start with a preset, then fine-tune individual panels. Your
                    screen preferences are saved in this browser.
                  </p>
                </div>

                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button
                    onClick={resetScreenView}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Reset simple view
                  </button>

                  <button
                    onClick={showAllScreenSections}
                    className="rounded-xl border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
                  >
                    Show everything
                  </button>
                </div>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {screenPresetOptions.map((preset) => {
                  const isActive = screenSettingsEqual(screenSettings, preset.settings);

                  return (
                    <button
                      key={preset.key}
                      onClick={() => applyScreenPreset(preset.key)}
                      className={
                        isActive
                          ? "rounded-2xl border border-cyan-400 bg-cyan-400/10 p-4 text-left transition hover:-translate-y-0.5"
                          : "rounded-2xl border border-white/10 bg-slate-900 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/10"
                      }
                    >
                      <p className="font-bold">{preset.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {screenSectionOptions.map((section) => (
                  <label
                    key={section.key}
                    className="flex cursor-pointer gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 hover:bg-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={screenSettings[section.key]}
                      onChange={() => toggleScreenSection(section.key)}
                      className="mt-1 h-4 w-4 accent-cyan-400"
                    />

                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{section.label}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          {section.group}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-400">
                        {section.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: screenSettings.quickStart && (activeAppView === "dashboard" || activeAppView === "settings") ? undefined : "none" }}>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-sm sm:tracking-[0.25em]">
                Beginner guide
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Start tracking in under 2 minutes
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Universal Targets Tracker helps you set recurring work targets,
                see what is due, catch up on missed work, and protect your data
                with backups. Current beta uses local profiles first. Real
                email invites and automatic sync are not live yet.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  onClick={resetDemoData}
                  className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-left hover:bg-sky-400/15"
                >
                  <span className="block text-sm font-semibold text-sky-100">
                    Try demo workspace
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-sky-200/80">
                    Best for first-time users. Loads sample profiles and targets.
                  </span>
                </button>

                <button
                  onClick={startFreshWorkspace}
                  className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-left hover:bg-amber-400/15"
                >
                  <span className="block text-sm font-semibold text-amber-100">
                    Start empty workspace
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-amber-200/80">
                    Best when you already know what you want to track.
                  </span>
                </button>

                <button
                  onClick={triggerImportBackup}
                  className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-left hover:bg-emerald-400/15"
                >
                  <span className="block text-sm font-semibold text-emerald-100">
                    Import backup
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-emerald-200/80">
                    Restore a JSON backup exported from this app.
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300 lg:max-w-sm">
              <p className="font-semibold text-white">Beta safety rule</p>
              <p className="mt-2">
                Browser data can be lost. Export a JSON backup before clearing
                browser data, changing devices, saving to cloud, or loading from
                cloud.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OnboardingStep
              number="1"
              title="Choose your start"
              body="Use the demo to learn quickly, start empty for real work, or import a backup if you already have one."
            />
            <OnboardingStep
              number="2"
              title="Add local profiles"
              body="Local profiles are beta assignment placeholders. They are not real invited users yet."
            />
            <OnboardingStep
              number="3"
              title="Create targets"
              body="Add daily, weekly, monthly, or one-time targets with category, priority, unit, and assigned profile."
            />
            <OnboardingStep
              number="4"
              title="Log progress"
              body="Pick the correct date, then use Tick done, +1, +3, or a custom amount. Logs update totals immediately."
            />
            <OnboardingStep
              number="5"
              title="Read backlog"
              body="Missed past work carries into today. Future days should show forecasted work, not infinite compounded debt."
            />
            <OnboardingStep
              number="6"
              title="Use calendar"
              body="Open Calendar to select any date, review the monthly grid, and see what work belongs to that day."
            />
            <OnboardingStep
              number="7"
              title="Back up data"
              body="Export a full JSON backup often. CSV exports are for reports; JSON backup is for restoring the workspace."
            />
            <OnboardingStep
              number="8"
              title="Optional cloud sync"
              body="Sign in only for manual cloud save/load. It is not automatic sync, and cloud actions can overwrite data."
            />
          </div>
        </section>
        <section className="mb-6 rounded-3xl border border-slate-400/20 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "reports" ? undefined : "none" }}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 sm:text-sm sm:tracking-[0.25em]">
              Activity history
            </p>
            <h2 className="mt-2 text-2xl font-bold">Safety ledger</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Recent destructive actions, imports, fresh starts, and manual cloud movement on this device.
            </p>
          </div>

          {activityEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm leading-6 text-slate-400">
              No activity history yet. Destructive actions and data movement will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {activityEvents.slice(0, 25).map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-white">
                      {formatActivityAction(event.action)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatSavedTime(event.createdAt)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {event.message}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Workspace: {event.workspaceName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>


        <section className="mb-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "dashboard" || activeAppView === "reports" ? undefined : "none" }}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300 sm:text-sm sm:tracking-[0.25em]">
              Dashboard insights
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Warnings and recommended focus
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Quick signals based on the selected date and active filters.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Most overdue category</p>

              {dashboardInsights.mostBehindCategory ? (
                <>
                  <p className="mt-2 text-xl font-bold">
                    {dashboardInsights.mostBehindCategory.category}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {dashboardInsights.mostBehindCategory.pending} pending -{" "}
                    {formatCount(dashboardInsights.mostBehindCategory.targetCount, "target")}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xl font-bold text-emerald-300">
                  No backlog
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Most overdue profile</p>

              {dashboardInsights.mostBehindMember ? (
                <>
                  <p className="mt-2 text-xl font-bold">
                    {dashboardInsights.mostBehindMember.member.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {dashboardInsights.mostBehindMember.pending} pending -{" "}
                    {formatCount(dashboardInsights.mostBehindMember.targetCount, "target")}
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
                    - {formatQuantity(
                      dashboardInsights.highestPriorityOverdueTarget.pending,
                      dashboardInsights.highestPriorityOverdueTarget.target.unit
                    )}{" "}
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
              <p className="text-sm text-slate-400">{"Today's focus list"}</p>

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
                        {formatQuantity(row.pending, row.target.unit)} pending -{" "}
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

        <section className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300 sm:text-sm sm:tracking-[0.25em]">
                Local data status
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Saved in this browser
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Your workspace data is stored locally in this browser. Export a JSON backup before clearing browser data, changing devices, or testing cloud sync.
              </p>
            </div>

            <StatusBox
              label="Last saved"
              value={
                lastSavedAt
                  ? formatSavedTime(lastSavedAt)
                  : hasLoadedSavedData
                  ? "Saved locally this session"
                  : "Loading local data..."
              }
            />
            <StatusBox label="Workspace" value={normalizeWorkspaceName(workspaceName)} />
            <StatusBox
              label="Saved records"
              value={`${formatCount(members.length, "profile")} - ${formatCount(targets.length, "target")}`}
            />
            <StatusBox label="Progress logs" value={formatCount(logs.length, "log")} />
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-purple-400/20 bg-purple-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "reports" ? undefined : "none" }}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-300 sm:text-sm sm:tracking-[0.25em]">
              Completion history
            </p>
            <h2 className="mt-2 text-2xl font-bold">Consistency and streaks</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Based on the selected date and current filters. A day counts as
              complete when its filtered required work has no pending amount.
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
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

        <section className="mb-6 rounded-3xl border border-violet-400/20 bg-violet-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "reports" ? undefined : "none" }}>
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300 sm:text-sm sm:tracking-[0.25em]">
                Category overview
              </p>
              <h2 className="mt-2 text-2xl font-bold">Work grouped by category</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Shows pending, achieved, required, and progress for the current
                date and active filters.
              </p>
            </div>

            <p className="text-sm text-slate-400">
              {categoryOverview.length} visible categories
            </p>
          </div>

          {categoryOverview.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categoryOverview.map((category) => (
                <div
                  key={category.category}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5"
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

                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm sm:gap-3">
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
            <EmptyStateCard
              title="No category data"
              body="Category totals appear after visible targets match the selected date and filters."
            />
          )}
        </section>

        <section className="mb-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:p-5" style={{ display: activeAppView === "settings" ? undefined : "none" }}>
          <button
            onClick={clearProgressLogs}
            className="rounded-xl border border-yellow-400/30 px-4 py-2 text-sm text-yellow-200 hover:bg-yellow-400/10"
          >
            Clear progress only
          </button>

          <button
            aria-label="Start fresh locally"
            onClick={startFreshWorkspace}
            className="rounded-xl border border-amber-400/30 px-4 py-2 text-sm text-amber-200 hover:bg-amber-400/10"
          >
            Start fresh locally
          </button>

          <button
            onClick={resetDemoData}
            className="rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-200 hover:bg-red-400/10"
          >
            Reload demo workspace
          </button>

          <p className="flex items-center text-sm leading-6 text-slate-400">
            Empty states now explain whether there is no data, archived data, or
            filters hiding results.
          </p>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "reports" ? undefined : "none" }}>
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Backup, export, and import</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Download your workspace data, including workspace name, local profiles,
              targets, logs, screen settings, and selected calendar state. Restore
              only from JSON backups created by this app.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "targets" ? undefined : "none" }}>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Search and filters</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search targets, categories, notes, units, or assigned profiles..."
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white md:col-span-2 xl:col-span-1"
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
              value={archiveFilter}
              onChange={(event) =>
                setArchiveFilter(event.target.value as ArchiveFilter)
              }
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              {archiveFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
                <section className="mb-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "calendar" ? undefined : "none" }}>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-sm sm:tracking-[0.25em]">
                Logging date
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                {getDateLabel(selectedDate)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
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

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:mb-8 sm:p-5" style={{ display: activeAppView === "calendar" ? undefined : "none" }}>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Month calendar</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Click any day to open that date. Profile filter: {selectedMemberName}
              </p>
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
              >
                Previous month
              </button>

              <div className="rounded-xl bg-slate-900 px-4 py-2 text-center font-semibold sm:min-w-48">
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

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[760px]">
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
                    className={`min-h-28 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${
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
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500 sm:hidden">
            Swipe sideways to see the full calendar.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5" style={{ display: activeAppView === "calendar" || activeAppView === "targets" ? undefined : "none" }}>
            <div className="mb-5">
              <h2 className="text-2xl font-bold">{"Selected day's work"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {selectedDate} - Showing {selectedMemberName}
              </p>
            </div>

            <div className="space-y-4">
              {visibleDashboard.map((row) => {
                const isEditing = editingTargetId === row.target.id;

                return (
                  <div
                    key={row.target.id}
                    className={`rounded-2xl border p-4 sm:p-5 ${
                      row.target.isArchived
                        ? "border-slate-500/30 bg-slate-900/60 opacity-80"
                        : "border-white/10 bg-slate-900"
                    }`}
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

                          <FieldLabel label="Assigned local profile">
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

                          <FieldLabel label="Edit target date">
                            <input
                              type="date"
                              value={editStartDate}
                              onChange={(event) =>
                                setEditStartDate(event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                              {editFrequency === "once"
                                ? "Due date for this one-time target."
                                : "Start date for this recurring target."}
                            </p>
                          </FieldLabel>

                          <FieldLabel label="Frequency">
                            <select
                              value={editFrequency}
                              onChange={(event) =>
                                setEditFrequency(event.target.value as Frequency)
                              }
                              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                            >
                              <option value="once">One-time</option>
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
                                setEditAmount(parseNumberInput(event.target.value))
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

                        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
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
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-xl font-semibold">
                                {row.target.title}
                              </h3>

                              {row.target.isArchived && (
                                <span className="rounded-full border border-slate-400/30 bg-slate-500/20 px-3 py-1 text-xs font-medium text-slate-200">
                                  Archived
                                </span>
                              )}

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
                                {row.target.frequency === "once" ? "one-time" : row.target.frequency}
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                                  row.status
                                )}`}
                              >
                                {row.status}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              Assigned to: {row.owner?.name ?? "Unknown"} - Target:{" "}
                              {formatQuantity(row.target.targetAmount, row.target.unit)} /{" "}
                              {row.target.frequency === "once" ? "one-time" : row.target.frequency}
                            </p>

                            {row.target.description && (
                              <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                                <span className="font-semibold text-cyan-300">
                                  Notes:
                                </span>{" "}
                                {row.target.description}
                              </p>
                            )}

                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              Required by selected date: {formatQuantity(row.required, row.target.unit)}. Achieved: {formatQuantity(row.achieved, row.target.unit)}.
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/5 p-4 text-left md:min-w-40 md:text-right">
                            <p className="text-sm text-slate-400">Need now</p>
                            <p className="text-3xl font-bold">
                              {formatQuantity(row.pending, row.target.unit)}
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
                          <div className="grid gap-2 sm:flex sm:flex-wrap">
                            {!row.target.isArchived && (
                              <>
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
                              </>
                            )}

                            <button
                              onClick={() => startEditingTarget(row.target)}
                              className="rounded-xl border border-cyan-400/30 px-4 py-2 text-cyan-200 hover:bg-cyan-400/10"
                            >
                              Edit target
                            </button>

                            <button
                              onClick={() => toggleTargetArchive(row.target.id)}
                              className="rounded-xl border border-slate-400/30 px-4 py-2 text-slate-200 hover:bg-slate-400/10"
                            >
                              {row.target.isArchived ? "Restore target" : "Archive target"}
                            </button>

                            <button
                              onClick={() => deleteTarget(row.target.id)}
                              className="rounded-xl border border-red-400/30 px-4 py-2 text-red-200 hover:bg-red-400/10"
                            >
                              Delete target
                            </button>
                          </div>

                          {!row.target.isArchived && (
                            <div className="grid gap-2 sm:flex">
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
                                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white sm:w-28"
                              />

                              <button
                                onClick={() => logManualProgress(row.target.id)}
                                className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-950 hover:bg-slate-200"
                              >
                                Log custom
                              </button>
                            </div>
                          )}
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
                                                parseNumberInput(
                                                  event.target.value
                                                )
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
                                            +{formatQuantity(log.achievedAmount, row.target.unit)}
                                          </span>
                                        </div>

                                        <div className="grid gap-2 sm:flex">
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
                <EmptyStateCard
                  title={targetEmptyState.title}
                  body={targetEmptyState.body}
                />
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5" style={{ display: activeAppView === "workspace" ? undefined : "none" }}>
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
                            Edit local profile
                          </h3>

                          <div className="space-y-3">
                            <FieldLabel label="Local profile name">
                              <input
                                value={editMemberName}
                                onChange={(event) =>
                                  setEditMemberName(event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
                              />
                            </FieldLabel>

                          </div>

                          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                            <button
                              onClick={saveEditedMember}
                              className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
                            >
                              Save profile
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
                                Local profile - {formatCount(row.targetCount, "target")}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                row.required === 0
                                  ? "bg-slate-500/20 text-slate-300"
                                  : statusClass(row.status)
                              }`}
                            >
                              {row.required === 0 ? "No targets" : `${row.progress}%`}
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${row.progress}%` }}
                            />
                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            Pending: {row.pending} - Achieved: {row.achieved} -
                            Required: {row.required}
                          </p>

                          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                            <button
                              onClick={() => startEditingMember(row.member)}
                              className="rounded-xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
                            >
                              Edit local profile
                            </button>

                            <button
                              onClick={() => deleteMember(row.member.id)}
                              className="rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-200 hover:bg-red-400/10"
                            >
                              Delete local profile
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5" style={{ display: activeAppView === "workspace" ? undefined : "none" }}>
              <h2 className="mb-4 text-2xl font-bold">Add local profile</h2>

              

              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
                <p className="font-semibold">Team invitations coming next</p>
                <p className="mt-2 text-amber-100/90">
                  For now, this creates a local assignment profile. Next, you will be able to invite people by email so registered users can join the workspace. Pending invites will count toward the {FREE_OWNED_TEAM_SEAT_LIMIT} free owned-team seats.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <span className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                    Current beta: local profile only
                  </span>
                  <span className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                    Future flow: {workspaceInviteStatusLabels.pending} to {workspaceMembershipStatusLabels.active}
                  </span>
                  <span className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                    Invite expiry: {DEFAULT_INVITE_EXPIRY_DAYS} days
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="Example: Ahmed or Sales Assistant"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />

                <button
                  onClick={addMember}
                  className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Add local profile
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5" style={{ display: activeAppView === "targets" ? undefined : "none" }}>
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
                      setNewAmount(parseNumberInput(event.target.value))
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

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    New target date
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(event) => setNewStartDate(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {newFrequency === "once"
                      ? "Due date for this one-time target."
                      : "Start date for this recurring target."}
                  </p>
                </div>

                <select
                  value={newFrequency}
                  onChange={(event) =>
                    setNewFrequency(event.target.value as Frequency)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="once">One-time</option>
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


function AuthorityBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={
        active
          ? "rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
          : "rounded-2xl border border-white/10 bg-slate-950/50 p-4"
      }
    >
      <p className="text-sm font-semibold">{label}</p>
      <p
        className={
          active
            ? "mt-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
            : "mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
        }
      >
        {active ? "Allowed" : "Blocked"}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold sm:text-4xl">{value}</p>
    </div>
  );
}

function StatusBox({
  label,
  value,
}: {
  label: string | number;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 break-words text-lg font-bold sm:text-xl">{value}</p>
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

function OnboardingStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 font-bold text-slate-950">
        {number}
      </div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function EmptyStateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center sm:p-8">
      <h3 className="text-xl font-bold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {body}
      </p>
    </div>
  );
}





