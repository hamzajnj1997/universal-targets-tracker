import type { SupabaseClient, User } from "@supabase/supabase-js";

export type CloudFrequency = "once" | "daily" | "weekly" | "monthly";
export type CloudPriority = "low" | "medium" | "high" | "urgent";
export type CloudProgressLogStatus = "pending" | "approved" | "rejected";

export type CloudMember = {
  id: string;
  name: string;
  role: string;
};

export type CloudTarget = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: CloudPriority;
  ownerId: string;
  frequency: CloudFrequency;
  targetAmount: number;
  unit: string;
  startDate: string;
  isArchived: boolean;
  claimedByMemberId?: string;
  claimedAt?: string;
};

export type CloudProgressLog = {
  id: string;
  targetId: string;
  date: string;
  achievedAmount: number;
  createdAt: string;
  status?: CloudProgressLogStatus;
  submittedByMemberId?: string;
  approvedByMemberId?: string;
  approvedAt?: string;
  rejectionReason?: string;
};

export type CloudActivityEvent = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  workspaceName: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type CloudSyncPayload = {
  workspaceName?: string;
  members: CloudMember[];
  targets: CloudTarget[];
  logs: CloudProgressLog[];
  activityEvents?: CloudActivityEvent[];
  screenSettings: Record<string, boolean>;
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
};

export type CloudWorkspaceSummary = {
  id: string;
  name: string;
  ownerId: string;
};

type WorkspaceMemberRow = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  role: string | null;
  app_role: string | null;
};

type PendingWorkspaceMemberInsert = {
  originalId: string;
  row: {
    workspace_id: string;
    user_id: string | null;
    display_name: string;
    role: string;
    app_role: string;
  };
};

function normalizePriority(value: unknown): CloudPriority {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }

  return "medium";
}

function normalizeFrequency(value: unknown): CloudFrequency {
  if (value === "once" || value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }

  return "daily";
}

function normalizeWorkspaceName(value: unknown, fallback = "My Team") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  if (!trimmed) return fallback;

  return trimmed.slice(0, 80);
}

function getUserDisplayName(user: User) {
  return typeof user.user_metadata?.display_name === "string" &&
    user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim()
    : user.email ?? "Me";
}

function toCloudWorkspaceSummary(workspace: WorkspaceRow): CloudWorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    ownerId: workspace.owner_id,
  };
}

function normalizeCloudActivityMetadata(
  value: unknown
): CloudActivityEvent["metadata"] {
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

function normalizeCloudActivityEvents(value: unknown): CloudActivityEvent[] {
  if (!Array.isArray(value)) return [];

  const events: CloudActivityEvent[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const rawEvent = item as Partial<CloudActivityEvent>;
    const createdAt = new Date(String(rawEvent.createdAt));

    if (
      typeof rawEvent.id !== "string" ||
      typeof rawEvent.action !== "string" ||
      typeof rawEvent.message !== "string" ||
      Number.isNaN(createdAt.getTime())
    ) {
      continue;
    }

    const event: CloudActivityEvent = {
      id: rawEvent.id,
      action: rawEvent.action.slice(0, 80),
      message: rawEvent.message.slice(0, 240),
      createdAt: createdAt.toISOString(),
      workspaceName: normalizeWorkspaceName(rawEvent.workspaceName),
    };

    const metadata = normalizeCloudActivityMetadata(rawEvent.metadata);

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
    .slice(0, 100);
}

function inferAppRoleFromDisplayRole(role: string, index: number) {
  const normalizedRole = role.trim().toLowerCase();

  if (index === 0 || normalizedRole === "owner") return "owner";
  if (normalizedRole === "admin" || normalizedRole === "manager") return "admin";
  if (normalizedRole === "team leader" || normalizedRole === "leader") return "leader";
  if (normalizedRole === "parent" || normalizedRole === "teacher" || normalizedRole === "coach") {
    return "parent";
  }
  if (normalizedRole === "viewer") return "viewer";

  return "member";
}

export async function listOwnedCloudWorkspaces(
  supabase: SupabaseClient,
  user: User
): Promise<CloudWorkspaceSummary[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,owner_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as WorkspaceRow[]).map(toCloudWorkspaceSummary);
}

export async function listAccessibleCloudWorkspaces(
  supabase: SupabaseClient,
  user: User
): Promise<CloudWorkspaceSummary[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,owner_id")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const workspaces = ((data ?? []) as WorkspaceRow[]).map(toCloudWorkspaceSummary);

  if (workspaces.length > 0) return workspaces;

  const createdWorkspace = await createCloudWorkspace(supabase, user, "My Team");
  return [createdWorkspace];
}

export async function createCloudWorkspace(
  supabase: SupabaseClient,
  user: User,
  workspaceName = "My Team"
): Promise<CloudWorkspaceSummary> {
  const safeWorkspaceName = normalizeWorkspaceName(workspaceName);
  const displayName = getUserDisplayName(user);

  const { data: createdWorkspace, error: createError } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: safeWorkspaceName,
    })
    .select("id,name,owner_id")
    .single();

  if (createError) throw createError;

  const workspace = createdWorkspace as WorkspaceRow;

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    display_name: displayName,
    role: "Owner",
    app_role: "owner",
  });

  if (memberError) throw memberError;

  return toCloudWorkspaceSummary(workspace);
}

export async function ensureUserWorkspace(
  supabase: SupabaseClient,
  user: User,
  workspaceId?: string | null
): Promise<WorkspaceRow> {
  const safeWorkspaceId = typeof workspaceId === "string" ? workspaceId.trim() : "";

  if (safeWorkspaceId) {
    const { data: selectedWorkspace, error: selectedError } = await supabase
      .from("workspaces")
      .select("id,name,owner_id")
      .eq("id", safeWorkspaceId)
      .maybeSingle();

    if (selectedError) throw selectedError;

    if (!selectedWorkspace) {
      throw new Error("Selected workspace was not found for this account.");
    }

    return selectedWorkspace as WorkspaceRow;
  }

  const accessibleWorkspaces = await listAccessibleCloudWorkspaces(supabase, user);
  const existingWorkspace = accessibleWorkspaces[0];

  if (existingWorkspace) {
    return {
      id: existingWorkspace.id,
      name: existingWorkspace.name,
      owner_id: existingWorkspace.ownerId,
    };
  }

  const createdWorkspace = await createCloudWorkspace(supabase, user, "My Team");

  return {
    id: createdWorkspace.id,
    name: createdWorkspace.name,
    owner_id: createdWorkspace.ownerId,
  };
}

export async function saveLocalDataToCloud(
  supabase: SupabaseClient,
  user: User,
  payload: CloudSyncPayload,
  options: { workspaceId?: string | null } = {}
) {
  let workspace = await ensureUserWorkspace(supabase, user, options.workspaceId);

  const requestedWorkspaceName = normalizeWorkspaceName(payload.workspaceName, workspace.name);

  if (requestedWorkspaceName !== workspace.name) {
    const { data: updatedWorkspace, error: workspaceNameError } = await supabase
      .from("workspaces")
      .update({ name: requestedWorkspaceName })
      .eq("id", workspace.id)
      .select("id,name,owner_id")
      .single();

    if (workspaceNameError) throw workspaceNameError;

    workspace = updatedWorkspace as WorkspaceRow;
  }

  const safeMembers =
    payload.members.length > 0
      ? payload.members
      : [{ id: "me", name: user.email ?? "Me", role: "Owner" }];

  const { data: existingMemberRows, error: existingMembersError } =
    await supabase
      .from("workspace_members")
      .select("id,user_id,display_name,role,app_role")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

  if (existingMembersError) throw existingMembersError;

  const existingMembers = (existingMemberRows ?? []) as WorkspaceMemberRow[];
  const existingMemberById = new Map(
    existingMembers.map((member) => [member.id, member])
  );
  const registeredMemberRows = existingMembers.filter((member) =>
    Boolean(member.user_id)
  );
  const ownerMemberRow =
    registeredMemberRows.find((member) => member.user_id === user.id) ?? null;

  await supabase.from("progress_logs").delete().eq("workspace_id", workspace.id);
  await supabase.from("targets").delete().eq("workspace_id", workspace.id);

  const { error: placeholderDeleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .is("user_id", null);

  if (placeholderDeleteError) throw placeholderDeleteError;

  const memberIdMap = new Map<string, string>();
  const pendingMemberRows: PendingWorkspaceMemberInsert[] = [];

  safeMembers.forEach((member, index) => {
    const existingMember = existingMemberById.get(member.id);

    if (existingMember?.user_id) {
      memberIdMap.set(member.id, existingMember.id);
      return;
    }

    if (index === 0 && ownerMemberRow?.id) {
      memberIdMap.set(member.id, ownerMemberRow.id);
      return;
    }

    pendingMemberRows.push({
      originalId: member.id,
      row: {
        workspace_id: workspace.id,
        user_id: index === 0 && !ownerMemberRow ? user.id : null,
        display_name: member.name || "Unnamed member",
        role: member.role || (index === 0 ? "Owner" : "Member"),
        app_role: inferAppRoleFromDisplayRole(member.role, index),
      },
    });
  });

  let insertedMembers: WorkspaceMemberRow[] = [];

  if (pendingMemberRows.length > 0) {
    const { data: insertedMemberRows, error: membersError } = await supabase
      .from("workspace_members")
      .insert(pendingMemberRows.map((member) => member.row))
      .select("id,user_id,display_name,role,app_role");

    if (membersError) throw membersError;

    insertedMembers = (insertedMemberRows ?? []) as WorkspaceMemberRow[];
  }

  pendingMemberRows.forEach((pendingMember, index) => {
    const inserted = insertedMembers[index];

    if (inserted?.id) {
      memberIdMap.set(pendingMember.originalId, inserted.id);
    }
  });

  const fallbackMemberId =
    ownerMemberRow?.id ??
    registeredMemberRows[0]?.id ??
    insertedMembers[0]?.id ??
    null;

  const targetRows = payload.targets.map((target) => ({
    workspace_id: workspace.id,
    owner_member_id: memberIdMap.get(target.ownerId) ?? fallbackMemberId,
    title: target.title || "Untitled target",
    description: target.description || "",
    category: target.category || "General",
    priority: normalizePriority(target.priority),
    frequency: normalizeFrequency(target.frequency),
    target_amount: target.targetAmount || 1,
    unit: target.unit || "tasks",
    start_date: target.startDate,
    is_archived: Boolean(target.isArchived),
    claimed_by_member_id: target.claimedByMemberId
      ? memberIdMap.get(target.claimedByMemberId) ?? null
      : null,
    claimed_at: target.claimedAt ?? null,
  }));

  const { data: insertedTargets, error: targetsError } = targetRows.length
    ? await supabase.from("targets").insert(targetRows).select("id")
    : { data: [], error: null };

  if (targetsError) throw targetsError;

  const targetIdMap = new Map<string, string>();

  payload.targets.forEach((target, index) => {
    const inserted = insertedTargets?.[index];
    if (inserted?.id) {
      targetIdMap.set(target.id, inserted.id);
    }
  });

  const logRows = payload.logs
    .filter((log) => targetIdMap.has(log.targetId))
    .map((log) => ({
      workspace_id: workspace.id,
      target_id: targetIdMap.get(log.targetId),
      progress_date: log.date,
      achieved_amount: log.achievedAmount || 1,
      created_at: log.createdAt,
    }));

  if (logRows.length > 0) {
    const { error: logsError } = await supabase.from("progress_logs").insert(logRows);
    if (logsError) throw logsError;
  }

  const cloudSettings = {
    ...payload.screenSettings,
    activityEvents: normalizeCloudActivityEvents(payload.activityEvents),
  };

  const { error: preferencesError } = await supabase
    .from("screen_preferences")
    .upsert(
      {
        user_id: user.id,
        workspace_id: workspace.id,
        settings: cloudSettings,
      },
      { onConflict: "user_id,workspace_id" }
    );

  if (preferencesError) throw preferencesError;

  return {
    workspace,
    memberCount: safeMembers.length,
    targetCount: payload.targets.length,
    logCount: payload.logs.length,
  };
}

export async function loadCloudDataFromCloud(
  supabase: SupabaseClient,
  user: User,
  options: { workspaceId?: string | null } = {}
) {
  const workspace = await ensureUserWorkspace(supabase, user, options.workspaceId);

  const { data: memberRows, error: membersError } = await supabase
    .from("workspace_members")
    .select("id,display_name,role")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (membersError) throw membersError;

  const members: CloudMember[] =
    memberRows?.map((member) => ({
      id: member.id,
      name: member.display_name || "Unnamed member",
      role: member.role || "Member",
    })) ?? [];

  const fallbackMemberId = members[0]?.id ?? "me";

  const { data: targetRows, error: targetsError } = await supabase
    .from("targets")
    .select("id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived,claimed_by_member_id,claimed_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (targetsError) throw targetsError;

  const targets: CloudTarget[] =
    targetRows?.map((target) => ({
      id: target.id,
      title: target.title || "Untitled target",
      description: target.description || "",
      category: target.category || "General",
      priority: normalizePriority(target.priority),
      ownerId: target.owner_member_id ?? fallbackMemberId,
      frequency: normalizeFrequency(target.frequency),
      targetAmount: Number(target.target_amount) || 1,
      unit: target.unit || "tasks",
      startDate: target.start_date,
      isArchived: Boolean(target.is_archived),
      claimedByMemberId: target.claimed_by_member_id ?? undefined,
      claimedAt: target.claimed_at ?? undefined,
    })) ?? [];

  const { data: logRows, error: logsError } = await supabase
    .from("progress_logs")
    .select("id,target_id,progress_date,achieved_amount,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (logsError) throw logsError;

  const logs: CloudProgressLog[] =
    logRows?.map((log) => ({
      id: log.id,
      targetId: log.target_id,
      date: log.progress_date,
      achievedAmount: Number(log.achieved_amount) || 1,
      createdAt: log.created_at,
    })) ?? [];

  const { data: preferences, error: preferencesError } = await supabase
    .from("screen_preferences")
    .select("settings")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (preferencesError) throw preferencesError;

  return {
    workspace,
    members,
    targets,
    logs,
    screenSettings: preferences?.settings ?? null,
    activityEvents: normalizeCloudActivityEvents(
      preferences?.settings && typeof preferences.settings === "object"
        ? (preferences.settings as Record<string, unknown>).activityEvents
        : undefined
    ),
  };
}


type DirectCloudTargetRow = {
  id: string;
  owner_member_id: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  priority: string | null;
  frequency: string | null;
  target_amount: number | null;
  unit: string | null;
  start_date: string | null;
  is_archived: boolean | null;
  claimed_by_member_id: string | null;
  claimed_at: string | null;
};

type DirectCloudProgressLogRow = {
  id: string;
  target_id: string;
  progress_date: string;
  achieved_amount: number | null;
  created_at: string;
};

type DirectCloudMemberRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  app_role: string | null;
};

function normalizeDirectAppRole(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  if (normalizedRole.includes("owner")) return "owner";
  if (normalizedRole.includes("admin")) return "admin";
  if (normalizedRole.includes("leader")) return "leader";
  if (normalizedRole.includes("parent")) return "parent";
  if (normalizedRole.includes("viewer")) return "viewer";

  return "member";
}

function toDirectCloudTarget(row: DirectCloudTargetRow, fallbackOwnerId = "me"): CloudTarget {
  return {
    id: row.id,
    title: row.title || "Untitled target",
    description: row.description || "",
    category: row.category || "General",
    priority: normalizePriority(row.priority),
    ownerId: row.owner_member_id ?? fallbackOwnerId,
    frequency: normalizeFrequency(row.frequency),
    targetAmount: Number(row.target_amount) || 1,
    unit: row.unit || "tasks",
    startDate: row.start_date || new Date().toISOString().slice(0, 10),
    isArchived: Boolean(row.is_archived),
    claimedByMemberId: row.claimed_by_member_id ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
  };
}

function toDirectCloudProgressLog(row: DirectCloudProgressLogRow): CloudProgressLog {
  return {
    id: row.id,
    targetId: row.target_id,
    date: row.progress_date,
    achievedAmount: Number(row.achieved_amount) || 1,
    createdAt: row.created_at,
  };
}

function toDirectCloudMember(row: DirectCloudMemberRow): CloudMember {
  return {
    id: row.id,
    name: row.display_name || "Unnamed member",
    role: row.role || "Member",
  };
}

const DIRECT_TARGET_SELECT =
  "id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived,claimed_by_member_id,claimed_at";

const DIRECT_PROGRESS_LOG_SELECT =
  "id,target_id,progress_date,achieved_amount,created_at";

const DIRECT_MEMBER_SELECT = "id,display_name,role,app_role";

export async function createCloudTarget(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  target: Omit<CloudTarget, "id">
): Promise<CloudTarget> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("targets")
    .insert({
      workspace_id: workspace.id,
      owner_member_id: target.ownerId || null,
      title: target.title || "Untitled target",
      description: target.description || "",
      category: target.category || "General",
      priority: normalizePriority(target.priority),
      frequency: normalizeFrequency(target.frequency),
      target_amount: target.targetAmount || 1,
      unit: target.unit || "tasks",
      start_date: target.startDate,
      is_archived: Boolean(target.isArchived),
      claimed_by_member_id: target.claimedByMemberId ?? null,
      claimed_at: target.claimedAt ?? null,
    })
    .select(DIRECT_TARGET_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudTarget(data as DirectCloudTargetRow, target.ownerId);
}

export async function updateCloudTarget(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  target: CloudTarget
): Promise<CloudTarget> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("targets")
    .update({
      owner_member_id: target.ownerId || null,
      title: target.title || "Untitled target",
      description: target.description || "",
      category: target.category || "General",
      priority: normalizePriority(target.priority),
      frequency: normalizeFrequency(target.frequency),
      target_amount: target.targetAmount || 1,
      unit: target.unit || "tasks",
      start_date: target.startDate,
      is_archived: Boolean(target.isArchived),
      claimed_by_member_id: target.claimedByMemberId ?? null,
      claimed_at: target.claimedAt ?? null,
    })
    .eq("id", target.id)
    .eq("workspace_id", workspace.id)
    .select(DIRECT_TARGET_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudTarget(data as DirectCloudTargetRow, target.ownerId);
}

export async function archiveCloudTarget(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  targetId: string,
  isArchived: boolean
): Promise<CloudTarget> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("targets")
    .update({ is_archived: isArchived })
    .eq("id", targetId)
    .eq("workspace_id", workspace.id)
    .select(DIRECT_TARGET_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudTarget(data as DirectCloudTargetRow);
}

export async function updateCloudTargetClaim(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  targetId: string,
  claimedByMemberId?: string
): Promise<CloudTarget> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("targets")
    .update({
      claimed_by_member_id: claimedByMemberId ?? null,
      claimed_at: claimedByMemberId ? new Date().toISOString() : null,
    })
    .eq("id", targetId)
    .eq("workspace_id", workspace.id)
    .select(DIRECT_TARGET_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudTarget(data as DirectCloudTargetRow);
}

export async function deleteCloudTarget(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  targetId: string
): Promise<void> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { error: logsError } = await supabase
    .from("progress_logs")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("target_id", targetId);

  if (logsError) throw logsError;

  const { error: targetError } = await supabase
    .from("targets")
    .delete()
    .eq("id", targetId)
    .eq("workspace_id", workspace.id);

  if (targetError) throw targetError;
}

export async function createCloudProgressLog(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  log: Omit<CloudProgressLog, "id">
): Promise<CloudProgressLog> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("progress_logs")
    .insert({
      workspace_id: workspace.id,
      target_id: log.targetId,
      progress_date: log.date,
      achieved_amount: log.achievedAmount || 1,
      created_at: log.createdAt || new Date().toISOString(),
    })
    .select(DIRECT_PROGRESS_LOG_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudProgressLog(data as DirectCloudProgressLogRow);
}

export async function updateCloudProgressLog(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  log: Pick<CloudProgressLog, "id" | "date" | "achievedAmount">
): Promise<CloudProgressLog> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("progress_logs")
    .update({
      progress_date: log.date,
      achieved_amount: log.achievedAmount || 1,
    })
    .eq("id", log.id)
    .eq("workspace_id", workspace.id)
    .select(DIRECT_PROGRESS_LOG_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudProgressLog(data as DirectCloudProgressLogRow);
}

export async function deleteCloudProgressLog(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  logId: string
): Promise<void> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { error } = await supabase
    .from("progress_logs")
    .delete()
    .eq("id", logId)
    .eq("workspace_id", workspace.id);

  if (error) throw error;
}

export async function createCloudMember(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  member: Omit<CloudMember, "id">
): Promise<CloudMember> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: null,
      display_name: member.name || "Unnamed member",
      role: member.role || "Member",
      app_role: normalizeDirectAppRole(member.role),
    })
    .select(DIRECT_MEMBER_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudMember(data as DirectCloudMemberRow);
}

export async function updateCloudMember(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  member: CloudMember
): Promise<CloudMember> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data, error } = await supabase
    .from("workspace_members")
    .update({
      display_name: member.name || "Unnamed member",
      role: member.role || "Member",
      app_role: normalizeDirectAppRole(member.role),
    })
    .eq("id", member.id)
    .eq("workspace_id", workspace.id)
    .select(DIRECT_MEMBER_SELECT)
    .single();

  if (error) throw error;

  return toDirectCloudMember(data as DirectCloudMemberRow);
}

export async function deleteCloudMember(
  supabase: SupabaseClient,
  user: User,
  workspaceId: string | null | undefined,
  memberId: string
): Promise<void> {
  const workspace = await ensureUserWorkspace(supabase, user, workspaceId);

  const { data: targetRows, error: targetFetchError } = await supabase
    .from("targets")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("owner_member_id", memberId);

  if (targetFetchError) throw targetFetchError;

  const targetIds = ((targetRows ?? []) as { id: string }[]).map(
    (target) => target.id
  );

  if (targetIds.length > 0) {
    const { error: logsError } = await supabase
      .from("progress_logs")
      .delete()
      .eq("workspace_id", workspace.id)
      .in("target_id", targetIds);

    if (logsError) throw logsError;
  }

  const { error: targetsError } = await supabase
    .from("targets")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("owner_member_id", memberId);

  if (targetsError) throw targetsError;

  const { error: memberError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", workspace.id)
    .is("user_id", null);

  if (memberError) throw memberError;
}
