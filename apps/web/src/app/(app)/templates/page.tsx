"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type EventSummary, type TemplateRow } from "@/lib/api";
import { PageShell } from "@/components/page-shell";

function StatusPill({ status }: { status: string }) {
  const color =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "REJECTED" || status === "DISABLED"
        ? "bg-red-100 text-red-700"
        : status === "PENDING"
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-600";
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;

export default function TemplatesPage() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("UTILITY");
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listTemplates().then(setRows).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    api.listEvents().then(setEvents).catch(() => {});
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !language) {
      setError("Name and language are required");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api.createTemplate({
        name,
        language,
        category,
        eventId: eventId || undefined,
        components: [],
      });
      setShowForm(false);
      setName("");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Templates"
      actions={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "New template"}
        </button>
      }
    >
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">
            Creates a draft record. Submitting the template to Meta for approval is a later step.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Template name</span>
              <input
                className="w-full rounded border px-2 py-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Language</span>
              <input
                className="w-full rounded border px-2 py-1.5"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Category</span>
              <select
                className="w-full rounded border px-2 py-1.5"
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
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
                <option value="">Shared across events</option>
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
            {busy ? "Creating…" : "Create draft"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Language</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-gray-400">
                  No templates yet.
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 text-gray-500">{t.language}</td>
                <td className="px-4 py-2 text-gray-500">{t.category}</td>
                <td className="px-4 py-2 text-gray-500">{t.eventName ?? "Shared"}</td>
                <td className="px-4 py-2">
                  <StatusPill status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
