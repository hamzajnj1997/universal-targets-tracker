"use client";

import { useEffect, useMemo, useState } from "react";

type Frequency = "daily" | "weekly" | "monthly";

type Member = {
  id: string;
  name: string;
  role: string;
};

type Target = {
  id: string;
  title: string;
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
};

const STORAGE_KEY = "universal-targets-tracker-demo-v4";

const initialMembers: Member[] = [
  { id: "me", name: "Me", role: "Owner" },
  { id: "family", name: "Family Member", role: "Member" },
  { id: "team", name: "Team Member", role: "Member" },
  { id: "student", name: "Student", role: "Student" },
];

const initialTargets: Target[] = [
  {
    id: "video",
    title: "Make video",
    ownerId: "me",
    frequency: "daily",
    targetAmount: 1,
    unit: "video",
    startDate: todayISO(),
  },
  {
    id: "ideas",
    title: "Plan content ideas",
    ownerId: "me",
    frequency: "weekly",
    targetAmount: 7,
    unit: "ideas",
    startDate: todayISO(),
  },
  {
    id: "calls",
    title: "Sales calls",
    ownerId: "team",
    frequency: "daily",
    targetAmount: 10,
    unit: "calls",
    startDate: todayISO(),
  },
  {
    id: "reading",
    title: "Read pages",
    ownerId: "student",
    frequency: "daily",
    targetAmount: 5,
    unit: "pages",
    startDate: todayISO(),
  },
];

function formatDateISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function todayISO() {
  return formatDateISO(new Date());
}

function toDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00`);
}

function daysBetween(startDate: string, endDate: string) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  return Math.floor((end.getTime() - start.getTime()) / 86400000);
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

function periodsDue(target: Target, dateISO: string) {
  if (dateISO < target.startDate) return 0;

  if (target.frequency === "daily") {
    return daysBetween(target.startDate, dateISO) + 1;
  }

  if (target.frequency === "weekly") {
    return Math.floor(daysBetween(target.startDate, dateISO) / 7) + 1;
  }

  if (target.frequency === "monthly") {
    return monthsBetween(target.startDate, dateISO) + 1;
  }

  return 0;
}

function addDays(dateISO: string, days: number) {
  const date = toDate(dateISO);
  date.setDate(date.getDate() + days);

  return formatDateISO(date);
}

function getStatus(pending: number, progress: number) {
  if (pending === 0) return "On Track";
  if (progress >= 80) return "Close";

  return "Behind";
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedMemberId, setSelectedMemberId] = useState("all");

  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [hasLoadedSavedData, setHasLoadedSavedData] = useState(false);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Member");

  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("tasks");
  const [newFrequency, setNewFrequency] = useState<Frequency>("daily");
  const [newOwnerId, setNewOwnerId] = useState("me");

  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    const savedData = window.localStorage.getItem(STORAGE_KEY);

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData) as SavedAppState;

        if (Array.isArray(parsedData.members)) {
          setMembers(parsedData.members);
        }

        if (Array.isArray(parsedData.targets)) {
          setTargets(parsedData.targets);
        }

        if (Array.isArray(parsedData.logs)) {
          setLogs(parsedData.logs);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHasLoadedSavedData(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedData) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        members,
        targets,
        logs,
      })
    );
  }, [members, targets, logs, hasLoadedSavedData]);

  const dashboard = useMemo(() => {
    return targets.map((target) => {
      const owner = members.find((member) => member.id === target.ownerId);

      const required = periodsDue(target, selectedDate) * target.targetAmount;

      const achieved = logs
        .filter((log) => log.targetId === target.id && log.date <= selectedDate)
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
        .sort((a, b) => {
          const aTime = a.createdAt || a.date;
          const bTime = b.createdAt || b.date;

          return bTime.localeCompare(aTime);
        })
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
    });
  }, [targets, logs, selectedDate, members]);

  const visibleDashboard = useMemo(() => {
    if (selectedMemberId === "all") return dashboard;

    return dashboard.filter((row) => row.target.ownerId === selectedMemberId);
  }, [dashboard, selectedMemberId]);

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

  function addTarget() {
    if (!newTitle.trim()) return;

    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id: crypto.randomUUID(),
        title: newTitle,
        ownerId: newOwnerId,
        frequency: newFrequency,
        targetAmount: newAmount,
        unit: newUnit,
        startDate: selectedDate,
      },
    ]);

    setNewTitle("");
    setNewAmount(1);
    setNewUnit("tasks");
    setNewFrequency("daily");
  }

  function addMember() {
    if (!newMemberName.trim()) return;

    const newMemberId = crypto.randomUUID();

    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: newMemberId,
        name: newMemberName,
        role: newMemberRole,
      },
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

    if (selectedMemberId === memberId) {
      setSelectedMemberId("all");
    }

    if (newOwnerId === memberId) {
      const nextMember = members.find((item) => item.id !== memberId);
      setNewOwnerId(nextMember?.id ?? "me");
    }
  }

  function clearProgressLogs() {
    const shouldClear = window.confirm(
      "Clear all progress logs? Targets and members will stay, but achieved values will reset to zero."
    );

    if (!shouldClear) return;

    setLogs([]);
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
    setNewOwnerId("me");
    setManualAmounts({});
  }

  const totalPending = visibleDashboard.reduce(
    (sum, row) => sum + row.pending,
    0
  );

  const totalAchieved = visibleDashboard.reduce(
    (sum, row) => sum + row.achieved,
    0
  );

  const totalRequired = visibleDashboard.reduce(
    (sum, row) => sum + row.required,
    0
  );

  const nextSevenDays = Array.from({ length: 7 }, (_, index) =>
    addDays(selectedDate, index)
  );

  const totalLogs = logs.length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Universal Targets Tracker
            </p>

            <h1 className="mt-3 text-4xl font-bold">
              Workspace targets, backlog, and progress
            </h1>

            <p className="mt-3 max-w-3xl text-slate-300">
              Track daily, weekly, and monthly targets for individuals, families,
              teams, businesses, and classrooms. Missed work carries forward.
              Extra work gives future credit.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-slate-400">Selected date</p>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white"
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-slate-400">View member</p>

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
            </div>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Pending</p>
            <p className="mt-2 text-4xl font-bold">{totalPending}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Achieved</p>
            <p className="mt-2 text-4xl font-bold">{totalAchieved}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Required</p>
            <p className="mt-2 text-4xl font-bold">{totalRequired}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Members</p>
            <p className="mt-2 text-4xl font-bold">{members.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Logs</p>
            <p className="mt-2 text-4xl font-bold">{totalLogs}</p>
          </div>
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
            Use custom logging when the actual achieved value is not +1 or +3.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Today&apos;s work</h2>
              <p className="mt-1 text-sm text-slate-400">
                Showing{" "}
                {selectedMemberId === "all"
                  ? "all members"
                  : members.find((member) => member.id === selectedMemberId)
                      ?.name}
              </p>
            </div>

            <div className="space-y-4">
              {visibleDashboard.map((row) => (
                <div
                  key={row.target.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold">
                          {row.target.title}
                        </h3>

                        <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300">
                          {row.target.frequency}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            row.status === "Behind"
                              ? "bg-red-500/20 text-red-300"
                              : row.status === "Close"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
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
                        placeholder={`Amount`}
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
                        {row.recentLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2 text-sm"
                          >
                            <span className="text-slate-300">{log.date}</span>
                            <span className="font-semibold text-cyan-300">
                              +{log.achievedAmount} {row.target.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No progress logged yet.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {visibleDashboard.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                  No targets found for this member yet.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-2xl font-bold">Workspace overview</h2>

              <div className="space-y-3">
                {memberOverview.map((row) => (
                  <div
                    key={row.member.id}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{row.member.name}</p>
                        <p className="text-sm text-slate-400">
                          {row.member.role} · {row.targetCount} targets
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          row.status === "Behind"
                            ? "bg-red-500/20 text-red-300"
                            : row.status === "Close"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
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

                    <button
                      onClick={() => deleteMember(row.member.id)}
                      className="mt-3 rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-200 hover:bg-red-400/10"
                    >
                      Delete member
                    </button>
                  </div>
                ))}
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
                  <option value="Owner">Owner</option>
                  <option value="Admin">Admin</option>
                  <option value="Parent">Parent</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Manager">Manager</option>
                  <option value="Member">Member</option>
                  <option value="Student">Student</option>
                  <option value="Child">Child</option>
                  <option value="Viewer">Viewer</option>
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

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-2xl font-bold">7-day forecast</h2>

              <div className="space-y-3">
                {nextSevenDays.map((day) => {
                  const rowsForForecast =
                    selectedMemberId === "all"
                      ? targets
                      : targets.filter(
                          (target) => target.ownerId === selectedMemberId
                        );

                  const pendingForDay = rowsForForecast.reduce(
                    (sum, target) => {
                      const required =
                        periodsDue(target, day) * target.targetAmount;

                      const achieved = logs
                        .filter(
                          (log) => log.targetId === target.id && log.date <= day
                        )
                        .reduce((total, log) => total + log.achievedAmount, 0);

                      return sum + Math.max(0, required - achieved);
                    },
                    0
                  );

                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3"
                    >
                      <span className="text-sm text-slate-300">{day}</span>
                      <span className="font-bold">{pendingForDay} pending</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}