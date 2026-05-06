"use client";

import { useEffect, useMemo, useState } from "react";

type Frequency = "daily" | "weekly" | "monthly";

type Target = {
  id: string;
  title: string;
  owner: string;
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
};

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

const initialTargets: Target[] = [
  {
    id: "video",
    title: "Make video",
    owner: "Me",
    frequency: "daily",
    targetAmount: 1,
    unit: "video",
    startDate: todayISO(),
  },
  {
    id: "ideas",
    title: "Plan content ideas",
    owner: "Me",
    frequency: "weekly",
    targetAmount: 7,
    unit: "ideas",
    startDate: todayISO(),
  },
  {
    id: "calls",
    title: "Sales calls",
    owner: "Team Member",
    frequency: "daily",
    targetAmount: 10,
    unit: "calls",
    startDate: todayISO(),
  },
];
const STORAGE_KEY = "universal-targets-tracker-demo-v1";

type SavedAppState = {
  targets: Target[];
  logs: ProgressLog[];
};

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [logs, setLogs] = useState<ProgressLog[]>([]);

  const [hasLoadedSavedData, setHasLoadedSavedData] = useState(false);

useEffect(() => {
  const savedData = window.localStorage.getItem(STORAGE_KEY);

  if (savedData) {
    try {
      const parsedData = JSON.parse(savedData) as SavedAppState;

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
      targets,
      logs,
    })
  );
}, [targets, logs, hasLoadedSavedData]);

  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("tasks");
  const [newFrequency, setNewFrequency] = useState<Frequency>("daily");

  const dashboard = useMemo(() => {
    return targets.map((target) => {
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

      let status = "On Track";

      if (pending > 0 && progress < 80) {
        status = "Behind";
      }

      if (pending > 0 && progress >= 80) {
        status = "Close";
      }

      return {
        target,
        required,
        achieved,
        pending,
        surplus,
        progress,
        status,
      };
    });
  }, [targets, logs, selectedDate]);

  function logProgress(targetId: string, amount: number) {
    if (amount <= 0) return;

    setLogs((currentLogs) => [
      ...currentLogs,
      {
        id: crypto.randomUUID(),
        targetId,
        date: selectedDate,
        achievedAmount: amount,
      },
    ]);
  }

  function addTarget() {
    if (!newTitle.trim()) return;

    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id: crypto.randomUUID(),
        title: newTitle,
        owner: "Me",
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

  const totalPending = dashboard.reduce((sum, row) => sum + row.pending, 0);
  const totalAchieved = dashboard.reduce((sum, row) => sum + row.achieved, 0);
  const totalRequired = dashboard.reduce((sum, row) => sum + row.required, 0);

  const nextSevenDays = Array.from({ length: 7 }, (_, index) =>
    addDays(selectedDate, index)
  );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Universal Targets Tracker
            </p>

            <h1 className="mt-3 text-4xl font-bold">
              Today&apos;s targets, backlog, and progress
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Track daily, weekly, and monthly targets. Missed work carries
              forward. Extra work gives future credit.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-sm text-slate-400">Selected date</p>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white"
            />
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Pending today</p>
            <p className="mt-2 text-4xl font-bold">{totalPending}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Achieved so far</p>
            <p className="mt-2 text-4xl font-bold">{totalAchieved}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Required by date</p>
            <p className="mt-2 text-4xl font-bold">{totalRequired}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-2xl font-bold">Today&apos;s work</h2>

            <div className="space-y-4">
              {dashboard.map((row) => (
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
                        Owner: {row.target.owner} · Target:{" "}
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

                  <div className="mt-4 flex flex-wrap gap-2">
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
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
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

                <button
                  onClick={addTarget}
                  className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Add target
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-2xl font-bold">7-day forecast</h2>

              <div className="space-y-3">
                {nextSevenDays.map((day) => {
                  const pendingForDay = targets.reduce((sum, target) => {
                    const required =
                      periodsDue(target, day) * target.targetAmount;

                    const achieved = logs
                      .filter(
                        (log) => log.targetId === target.id && log.date <= day
                      )
                      .reduce((total, log) => total + log.achievedAmount, 0);

                    return sum + Math.max(0, required - achieved);
                  }, 0);

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