import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import { todayISO } from "./workOwnershipRules";
import type {
  BoardData,
  TargetActivity,
  TargetActivityAction,
  TargetNote,
  TargetPriority,
  TargetStatus,
  Team,
  TeamMember,
  TeamMemberStatus,
  TeamRole,
  WorkTarget,
} from "./workOwnershipTypes";

type RowRecord = Record<string, unknown>;
type RpcArgs = Record<string, string | number | boolean | null | undefined>;
type SupabaseLikeError = { message?: string; code?: string } | null;
type LegacyProgressLog = {
  id: string;
  teamId: string;
  targetId: string;
  progressDate: string;
  achievedAmount: number;
  createdAt: string;
  submittedById?: string;
};

export type CreateTargetInput = {
  teamId: string;
  title: string;
  description?: string;
  priority: TargetPriority;
  dueDate?: string;
};

export type TeamInviteInput = {
  teamId: string;
  email: string;
  role: TeamRole;
};

export type AuthMode = "login" | "signup" | "forgot";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string) {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254;
}

function assertValidEmailAddress(email: string) {
  const normalized = normalizeEmail(email);
  if (!isValidEmailAddress(normalized)) {
    throw new Error("Enter a valid email address.");
  }

  return normalized;
}

function requireSupabaseClient(): SupabaseClient {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return supabase;
}

function rows(value: unknown): RowRecord[] {
  return Array.isArray(value) ? value.filter(isRowRecord) : [];
}

function isRowRecord(value: unknown): value is RowRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(row: RowRecord, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readOptionalString(row: RowRecord, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(row: RowRecord, key: string, fallback = false) {
  return typeof row[key] === "boolean" ? row[key] : fallback;
}

function readNumber(row: RowRecord, key: string, fallback = 0) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeRole(value: unknown): TeamRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin" || normalized === "leader" || normalized === "manager") {
    return "admin";
  }
  return "member";
}

function normalizeMemberStatus(value: unknown): TeamMemberStatus {
  if (value === "inactive" || value === "removed") return value;
  return "active";
}

function normalizeTargetStatus(row: RowRecord): TargetStatus {
  const raw = row.status;
  if (
    raw === "available" ||
    raw === "claimed" ||
    raw === "blocked" ||
    raw === "completed" ||
    raw === "archived"
  ) {
    return raw;
  }

  if (readBoolean(row, "is_archived")) return "archived";
  if (readOptionalString(row, "claimed_by_member_id")) return "claimed";
  return "available";
}

function normalizePriority(value: unknown): TargetPriority {
  if (value === "low" || value === "high" || value === "urgent") return value;
  return "medium";
}

function normalizeAction(value: unknown): TargetActivityAction {
  const validActions: TargetActivityAction[] = [
    "target_created",
    "target_updated",
    "target_claimed",
    "target_released",
    "target_force_released",
    "target_blocked",
    "target_unblocked",
    "target_completed",
    "target_reopened",
    "target_archived",
    "note_added",
    "member_invited",
    "member_joined",
    "role_changed",
  ];

  return validActions.includes(value as TargetActivityAction)
    ? (value as TargetActivityAction)
    : "target_updated";
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!isRowRecord(value)) return undefined;
  return value;
}

function toTeam(row: RowRecord): Team {
  return {
    id: readString(row, "id"),
    name: readString(row, "name", "Untitled team"),
    ownerId: readString(row, "owner_id", readString(row, "ownerId")),
    inviteCode: readString(row, "invite_code", readString(row, "inviteCode")),
  };
}

function toMember(row: RowRecord): TeamMember {
  const name =
    readOptionalString(row, "display_name") ??
    readOptionalString(row, "email") ??
    "Unnamed member";

  return {
    id: readString(row, "id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    userId: readOptionalString(row, "user_id"),
    name,
    email: readOptionalString(row, "email"),
    role: normalizeRole(row.app_role ?? row.role),
    status: normalizeMemberStatus(row.status),
    joinedAt: readOptionalString(row, "joined_at"),
    createdAt: readOptionalString(row, "created_at"),
    updatedAt: readOptionalString(row, "updated_at"),
  };
}

function toTarget(row: RowRecord): WorkTarget {
  return {
    id: readString(row, "id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    title: readString(row, "title", "Untitled target"),
    description: readString(row, "description"),
    status: normalizeTargetStatus(row),
    priority: normalizePriority(row.priority),
    createdById: readOptionalString(row, "created_by_member_id"),
    claimedById: readOptionalString(row, "claimed_by_member_id"),
    claimedAt: readOptionalString(row, "claimed_at"),
    blockedReason: readOptionalString(row, "blocked_reason"),
    blockedAt: readOptionalString(row, "blocked_at"),
    completedById: readOptionalString(row, "completed_by_member_id"),
    completedAt: readOptionalString(row, "completed_at"),
    dueDate: readOptionalString(row, "due_date") ?? readOptionalString(row, "start_date"),
    archivedAt: readOptionalString(row, "archived_at"),
    createdAt: readOptionalString(row, "created_at"),
    updatedAt: readOptionalString(row, "updated_at") ?? readOptionalString(row, "created_at"),
  };
}

function toActivity(row: RowRecord): TargetActivity {
  return {
    id: readString(row, "id"),
    targetId: readString(row, "target_id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    actorId: readOptionalString(row, "actor_member_id"),
    action: normalizeAction(row.action),
    oldStatus: normalizeTargetStatus({ status: row.old_status }),
    newStatus: normalizeTargetStatus({ status: row.new_status }),
    note: readOptionalString(row, "note"),
    metadata: normalizeMetadata(row.metadata),
    createdAt: readString(row, "created_at", new Date().toISOString()),
  };
}

function toNote(row: RowRecord): TargetNote {
  return {
    id: readString(row, "id"),
    targetId: readString(row, "target_id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    userId: readOptionalString(row, "member_id"),
    body: readString(row, "body"),
    createdAt: readString(row, "created_at", new Date().toISOString()),
    updatedAt: readOptionalString(row, "updated_at"),
  };
}

function toProgressLog(row: RowRecord): LegacyProgressLog {
  return {
    id: readString(row, "id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    targetId: readString(row, "target_id"),
    progressDate: readString(row, "progress_date"),
    achievedAmount: readNumber(row, "achieved_amount", 1),
    createdAt: readString(row, "created_at", new Date().toISOString()),
    submittedById: readOptionalString(row, "submitted_by_member_id"),
  };
}

function isSchemaGap(error: SupabaseLikeError) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("column") ||
    message.includes("function") ||
    message.includes("relation") ||
    error?.code === "42703" ||
    error?.code === "42P01" ||
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST204"
  );
}

function isMissingAuthSession(error: SupabaseLikeError) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("auth session missing") ||
    message.includes("missing auth session") ||
    error?.code === "session_not_found"
  );
}

function isSchemaGapThrown(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("apply supabase/migrations") ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("column") ||
    message.includes("function") ||
    message.includes("relation")
  );
}

function migrationHint(message: string) {
  const lower = message.toLowerCase();
  const looksLikeSchemaGap =
    lower.includes("does not exist") ||
    lower.includes("could not find") ||
    lower.includes("column") ||
    lower.includes("function") ||
    lower.includes("relation");

  if (!looksLikeSchemaGap) return message;

  return `${message} Apply supabase/migrations/20260521_work_ownership_tracker.sql to this Supabase project.`;
}

function throwSupabaseError(error: SupabaseLikeError) {
  if (!error) return;
  throw new Error(migrationHint(error.message ?? "Supabase request failed."));
}

async function fetchMembers(supabase: SupabaseClient, teamId: string) {
  const modern = await supabase
    .from("workspace_members")
    .select(
      "id,workspace_id,user_id,email,display_name,role,app_role,status,joined_at,created_at,updated_at"
    )
    .eq("workspace_id", teamId)
    .neq("status", "removed")
    .order("created_at", { ascending: true });

  if (!modern.error) return rows(modern.data).map(toMember);
  if (!isSchemaGap(modern.error)) throwSupabaseError(modern.error);

  const legacy = await supabase
    .from("workspace_members")
    .select("id,workspace_id,user_id,display_name,role,app_role,created_at")
    .eq("workspace_id", teamId)
    .order("created_at", { ascending: true });

  throwSupabaseError(legacy.error);
  return rows(legacy.data).map(toMember);
}

async function fetchTargets(supabase: SupabaseClient, teamId: string) {
  const modern = await supabase
    .from("targets")
    .select(
      "id,workspace_id,title,description,status,priority,created_by_member_id,claimed_by_member_id,claimed_at,blocked_reason,blocked_at,completed_by_member_id,completed_at,due_date,archived_at,created_at,updated_at,is_archived"
    )
    .eq("workspace_id", teamId)
    .order("updated_at", { ascending: false });

  if (!modern.error) {
    return {
      targets: rows(modern.data).map(toTarget),
      supportsBlockers: true,
    };
  }
  if (!isSchemaGap(modern.error)) throwSupabaseError(modern.error);

  const legacy = await supabase
    .from("targets")
    .select(
      "id,workspace_id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived,claimed_by_member_id,claimed_at,created_at"
    )
    .eq("workspace_id", teamId)
    .order("created_at", { ascending: false });

  throwSupabaseError(legacy.error);
  return {
    targets: rows(legacy.data).map(toTarget),
    supportsBlockers: false,
  };
}

async function fetchActivities(supabase: SupabaseClient, teamId: string) {
  const result = await supabase
    .from("target_activity")
    .select(
      "id,workspace_id,target_id,actor_member_id,action,old_status,new_status,note,metadata,created_at"
    )
    .eq("workspace_id", teamId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!result.error) {
    return {
      activities: rows(result.data).map(toActivity),
      supportsActivityLog: true,
    };
  }
  if (isSchemaGap(result.error)) {
    return {
      activities: [],
      supportsActivityLog: false,
    };
  }
  throwSupabaseError(result.error);
  return {
    activities: [],
    supportsActivityLog: false,
  };
}

async function fetchNotes(supabase: SupabaseClient, teamId: string) {
  const result = await supabase
    .from("target_notes")
    .select("id,workspace_id,target_id,member_id,body,created_at,updated_at")
    .eq("workspace_id", teamId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!result.error) {
    return {
      notes: rows(result.data).map(toNote),
      supportsNotes: true,
    };
  }
  if (isSchemaGap(result.error)) {
    return {
      notes: [],
      supportsNotes: false,
    };
  }
  throwSupabaseError(result.error);
  return {
    notes: [],
    supportsNotes: false,
  };
}

async function fetchProgressLogs(supabase: SupabaseClient, teamId: string) {
  const modern = await supabase
    .from("progress_logs")
    .select(
      "id,workspace_id,target_id,progress_date,achieved_amount,created_at,submitted_by_member_id"
    )
    .eq("workspace_id", teamId)
    .order("created_at", { ascending: false })
    .limit(400);

  if (!modern.error) return rows(modern.data).map(toProgressLog);
  if (!isSchemaGap(modern.error)) throwSupabaseError(modern.error);

  const legacy = await supabase
    .from("progress_logs")
    .select("id,workspace_id,target_id,progress_date,achieved_amount,created_at")
    .eq("workspace_id", teamId)
    .order("created_at", { ascending: false })
    .limit(400);

  if (!legacy.error) return rows(legacy.data).map(toProgressLog);
  if (isSchemaGap(legacy.error)) return [];
  throwSupabaseError(legacy.error);
  return [];
}

function applyLegacyCompletionState(
  targets: WorkTarget[],
  logs: LegacyProgressLog[]
): WorkTarget[] {
  if (logs.length === 0) return targets;

  const latestCompletionByTarget = new Map<string, LegacyProgressLog>();
  for (const log of logs) {
    if (!log.targetId || log.achievedAmount <= 0) continue;
    const existing = latestCompletionByTarget.get(log.targetId);
    if (!existing || new Date(log.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestCompletionByTarget.set(log.targetId, log);
    }
  }

  return targets.map((target) => {
    const completion = latestCompletionByTarget.get(target.id);
    if (!completion || target.status === "archived") return target;

    return {
      ...target,
      status: "completed",
      completedAt: completion.createdAt,
      completedById: completion.submittedById ?? target.claimedById,
      updatedAt: completion.createdAt,
    };
  });
}

function synthesizeLegacyActivities(logs: LegacyProgressLog[]): TargetActivity[] {
  return logs
    .filter((log) => log.achievedAmount > 0)
    .map((log) => ({
      id: `progress-log-${log.id}`,
      targetId: log.targetId,
      teamId: log.teamId,
      actorId: log.submittedById,
      action: "target_completed",
      oldStatus: "claimed",
      newStatus: "completed",
      note: "Completion recorded in legacy progress logs.",
      metadata: { progressLogId: log.id },
      createdAt: log.createdAt,
    }));
}

async function getLegacyTargetById(
  supabase: SupabaseClient,
  targetId: string
): Promise<WorkTarget> {
  const modern = await supabase
    .from("targets")
    .select(
      "id,workspace_id,title,description,status,priority,created_by_member_id,claimed_by_member_id,claimed_at,blocked_reason,blocked_at,completed_by_member_id,completed_at,due_date,archived_at,created_at,updated_at,is_archived"
    )
    .eq("id", targetId)
    .single();

  if (!modern.error) return toTarget(modern.data as RowRecord);
  if (!isSchemaGap(modern.error)) throwSupabaseError(modern.error);

  const legacy = await supabase
    .from("targets")
    .select(
      "id,workspace_id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived,claimed_by_member_id,claimed_at,created_at"
    )
    .eq("id", targetId)
    .single();

  throwSupabaseError(legacy.error);
  return toTarget(legacy.data as RowRecord);
}

async function getCurrentMemberForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamMember | null> {
  const userResult = await supabase.auth.getUser();
  throwSupabaseError(userResult.error);
  const user = userResult.data.user;
  if (!user) return null;

  const members = await fetchMembers(supabase, teamId);
  return members.find((member) => member.userId === user.id) ?? null;
}

async function insertLegacyProgressLog(
  supabase: SupabaseClient,
  target: WorkTarget,
  member: TeamMember | null
) {
  const now = new Date();
  const createdAt = now.toISOString();
  const progressDate = todayISO(now);
  const modern = await supabase
    .from("progress_logs")
    .insert({
      workspace_id: target.teamId,
      target_id: target.id,
      progress_date: progressDate,
      achieved_amount: 1,
      created_at: createdAt,
      submitted_by_member_id: member?.id ?? null,
    })
    .select(
      "id,workspace_id,target_id,progress_date,achieved_amount,created_at,submitted_by_member_id"
    )
    .single();

  if (!modern.error) return toProgressLog(modern.data as RowRecord);
  if (!isSchemaGap(modern.error)) throwSupabaseError(modern.error);

  const legacy = await supabase
    .from("progress_logs")
    .insert({
      workspace_id: target.teamId,
      target_id: target.id,
      progress_date: progressDate,
      achieved_amount: 1,
      created_at: createdAt,
    })
    .select("id,workspace_id,target_id,progress_date,achieved_amount,created_at")
    .single();

  throwSupabaseError(legacy.error);
  return toProgressLog(legacy.data as RowRecord);
}

async function claimPendingEmailInvites(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("claim_workspace_invites_for_current_user");

  if (isSchemaGap(error)) return [];
  throwSupabaseError(error);
  return rows(data).map(toMember);
}

export function getClientForRealtime() {
  return getSupabaseClient();
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (isMissingAuthSession(error)) return null;
  throwSupabaseError(error);
  return data.user ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = requireSupabaseClient();
  const normalizedEmail = assertValidEmailAddress(email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  throwSupabaseError(error);
  return data.user ?? null;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string
) {
  const supabase = requireSupabaseClient();
  const normalizedEmail = assertValidEmailAddress(email);
  const normalizedDisplayName = displayName.trim() || normalizedEmail;
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/login?authVerified=true`;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: normalizedDisplayName,
      },
    },
  });

  throwSupabaseError(error);
  return data.user ?? null;
}

export async function sendPasswordReset(email: string) {
  const supabase = requireSupabaseClient();
  const normalizedEmail = assertValidEmailAddress(email);
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });
  throwSupabaseError(error);
}

export async function resendSignupConfirmation(email: string) {
  const supabase = requireSupabaseClient();
  const normalizedEmail = assertValidEmailAddress(email);
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/login?authVerified=true`;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  throwSupabaseError(error);
}

export async function signOut() {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signOut();
  throwSupabaseError(error);
}

export async function syncSignedInMemberInvites(): Promise<TeamMember[]> {
  const supabase = requireSupabaseClient();
  return claimPendingEmailInvites(supabase);
}

export async function listTeams(): Promise<Team[]> {
  const supabase = requireSupabaseClient();
  await claimPendingEmailInvites(supabase);
  const { data, error } = await supabase.rpc("get_accessible_workspaces");
  throwSupabaseError(error);
  return rows(data).map(toTeam).filter((team) => Boolean(team.id));
}

export async function createTeam(name: string): Promise<Team> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("create_team", {
    team_name: name.trim(),
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("Team creation returned no team.");
  return toTeam(row);
}

export async function joinTeamByInviteCode(inviteCode: string): Promise<Team> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("join_team_by_invite_code", {
    invite_code_input: inviteCode.trim(),
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("Join team returned no team.");
  return toTeam(row);
}

export async function inviteMemberByEmail(input: TeamInviteInput): Promise<TeamMember> {
  const supabase = requireSupabaseClient();
  const normalizedEmail = assertValidEmailAddress(input.email);
  const { data, error } = await supabase.rpc("add_workspace_member_by_email", {
    target_workspace_id: input.teamId,
    teammate_email: normalizedEmail,
    member_role: input.role,
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("Invite returned no member.");
  return toMember(row);
}

export async function loadBoardData(teamId: string): Promise<BoardData> {
  const supabase = requireSupabaseClient();

  const [members, targetResult, activityResult, noteResult, progressLogs] = await Promise.all([
    fetchMembers(supabase, teamId),
    fetchTargets(supabase, teamId),
    fetchActivities(supabase, teamId),
    fetchNotes(supabase, teamId),
    fetchProgressLogs(supabase, teamId),
  ]);
  const isWorkOwnershipSchema =
    targetResult.supportsBlockers &&
    activityResult.supportsActivityLog &&
    noteResult.supportsNotes;

  return {
    members,
    targets: applyLegacyCompletionState(targetResult.targets, progressLogs),
    activities:
      activityResult.activities.length > 0
        ? activityResult.activities
        : synthesizeLegacyActivities(progressLogs),
    notes: noteResult.notes,
    capabilities: {
      schemaMode: isWorkOwnershipSchema ? "workOwnership" : "legacy",
      supportsBlockers: targetResult.supportsBlockers,
      supportsNotes: noteResult.supportsNotes,
      supportsActivityLog: activityResult.supportsActivityLog,
    },
  };
}

async function runTargetRpc(name: string, args: RpcArgs): Promise<WorkTarget> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error(`${name} returned no target.`);
  return toTarget(row);
}

export async function createTarget(input: CreateTargetInput): Promise<WorkTarget> {
  try {
    return await runTargetRpc("create_target", {
      team_id: input.teamId,
      target_title: input.title.trim(),
      target_description: input.description?.trim() ?? "",
      target_priority: input.priority,
      target_due_date: input.dueDate || null,
    });
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;

    const supabase = requireSupabaseClient();
    const { data, error: insertError } = await supabase
      .from("targets")
      .insert({
        workspace_id: input.teamId,
        owner_member_id: null,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        category: "",
        priority: input.priority,
        frequency: "once",
        target_amount: 1,
        unit: "task",
        start_date: input.dueDate || todayISO(),
        is_archived: false,
        claimed_by_member_id: null,
        claimed_at: null,
      })
      .select(
        "id,workspace_id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived,claimed_by_member_id,claimed_at,created_at"
      )
      .single();

    throwSupabaseError(insertError);
    return toTarget(data as RowRecord);
  }
}

export async function claimTarget(targetId: string): Promise<WorkTarget> {
  return runTargetRpc("claim_target", { target_id: targetId });
}

export async function releaseTarget(
  targetId: string,
  reason: string
): Promise<WorkTarget> {
  try {
    return await runTargetRpc("release_target", {
      target_id: targetId,
      release_reason: reason.trim() || null,
    });
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;
    return runTargetRpc("release_target_claim", { target_id: targetId });
  }
}

export async function forceReleaseTarget(
  targetId: string,
  reason: string
): Promise<WorkTarget> {
  try {
    return await runTargetRpc("force_release_target", {
      target_id: targetId,
      release_reason: reason.trim(),
    });
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;
    return runTargetRpc("release_target_claim", { target_id: targetId });
  }
}

export async function blockTarget(
  targetId: string,
  reason: string
): Promise<WorkTarget> {
  try {
    return await runTargetRpc("block_target", {
      target_id: targetId,
      block_reason: reason.trim(),
    });
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;
    const supabase = requireSupabaseClient();
    const { data, error: updateError } = await supabase
      .from("targets")
      .update({
        status: "blocked",
        blocked_reason: reason.trim(),
        blocked_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .select(
        "id,workspace_id,title,description,status,priority,created_by_member_id,claimed_by_member_id,claimed_at,blocked_reason,blocked_at,completed_by_member_id,completed_at,due_date,archived_at,created_at,updated_at,is_archived"
      )
      .single();

    if (isSchemaGap(updateError)) {
      throw new Error(
        "Blocking needs the work ownership database migration because the current live targets table has no blocker columns."
      );
    }

    throwSupabaseError(updateError);
    return toTarget(data as RowRecord);
  }
}

export async function completeTarget(targetId: string): Promise<WorkTarget> {
  try {
    return await runTargetRpc("complete_target", { target_id: targetId });
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;

    const supabase = requireSupabaseClient();
    const target = await getLegacyTargetById(supabase, targetId);
    const member = await getCurrentMemberForTeam(supabase, target.teamId);
    const log = await insertLegacyProgressLog(supabase, target, member);

    return {
      ...target,
      status: "completed",
      completedAt: log.createdAt,
      completedById: member?.id ?? target.claimedById,
      updatedAt: log.createdAt,
    };
  }
}

export async function reopenTarget(targetId: string): Promise<WorkTarget> {
  return runTargetRpc("reopen_target", { target_id: targetId });
}

export async function archiveTarget(targetId: string): Promise<WorkTarget> {
  try {
    return await runTargetRpc("archive_target", { target_id: targetId });
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;

    const supabase = requireSupabaseClient();
    const { data, error: updateError } = await supabase
      .from("targets")
      .update({ is_archived: true })
      .eq("id", targetId)
      .select(
        "id,workspace_id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived,claimed_by_member_id,claimed_at,created_at"
      )
      .single();

    throwSupabaseError(updateError);
    return toTarget(data as RowRecord);
  }
}

export async function addTargetNote(targetId: string, body: string): Promise<TargetNote> {
  const supabase = requireSupabaseClient();
  try {
    const { data, error } = await supabase.rpc("add_target_note", {
      target_id: targetId,
      note_body: body.trim(),
    });
    throwSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!isRowRecord(row)) throw new Error("add_target_note returned no note.");
    return toNote(row);
  } catch (error) {
    if (!isSchemaGapThrown(error)) throw error;

    const target = await getLegacyTargetById(supabase, targetId);
    const member = await getCurrentMemberForTeam(supabase, target.teamId);
    const { data, error: insertError } = await supabase
      .from("target_notes")
      .insert({
        workspace_id: target.teamId,
        target_id: target.id,
        member_id: member?.id ?? null,
        body: body.trim(),
      })
      .select("id,workspace_id,target_id,member_id,body,created_at,updated_at")
      .single();

    if (isSchemaGap(insertError)) {
      throw new Error(
        "Notes need the work ownership database migration because the current live database has no target_notes table."
      );
    }

    throwSupabaseError(insertError);
    return toNote(data as RowRecord);
  }
}
