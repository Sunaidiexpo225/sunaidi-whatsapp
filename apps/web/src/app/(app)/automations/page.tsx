"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AutomationRow, type EventSummary } from "@/lib/api";
import { PageShell } from "@/components/page-shell";

const TRIGGERS = [
  { value: "welcome", label: "Welcome message" },
  { value: "out_of_office", label: "Out of office" },
  { value: "keyword", label: "Keyword reply" },
  { value: "assignment", label: "Auto-assignment" },
] as const;

function triggerLabel(v: string): string {
  return TRIGGERS.find((t) => t.value === v)?.label ?? v;
}

export default function AutomationsPage() {
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<string>("welcome");
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listAutomations().then(setRows).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    api.listEvents().then(setEvents).catch(() => {});
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api.createAutomation({ name, trigger, eventId: eventId || undefined });
      setShowForm(false);
      setName("");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setError(undefined);
    try {
      await api.toggleAutomation(id, enabled);
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  return (
    <PageShell
      title="Automations"
      actions={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "New automation"}
        </button>
      }
    >
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Name</span>
              <input
                className="w-full rounded border px-2 py-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Trigger</span>
              <select
                className="w-full rounded border px-2 py-1.5"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
              >
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Event (optional)</span>
              <select
                className="w-full rounded border px-2 py-1.5"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create automation"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Trigger</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium text-right">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-gray-400">
                  No automations yet.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-gray-500">{triggerLabel(a.trigger)}</td>
                <td className="px-4 py-2 text-gray-500">{a.eventName ?? "All events"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => toggle(a.id, !a.enabled)}
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      a.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {a.enabled ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
