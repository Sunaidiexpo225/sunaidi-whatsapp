"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type CampaignRow, type EventSummary } from "@/lib/api";
import { PageShell } from "@/components/page-shell";

function StatusPill({ status }: { status: string }) {
  const color =
    status === "COMPLETED"
      ? "bg-green-100 text-green-700"
      : status === "SENDING"
        ? "bg-blue-100 text-blue-700"
        : status === "CANCELLED"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}

export default function CampaignsPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("en");
  const [recipients, setRecipients] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listCampaigns().then(setRows).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    api.listEvents().then(setEvents).catch(() => {});
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const list = recipients
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((to) => ({ to }));
    if (!eventId || !name || !templateName || list.length === 0) {
      setError("Event, name, template and at least one recipient are required");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api.createCampaign({
        eventId,
        name,
        templateName,
        templateLanguage: language,
        recipients: list,
      });
      setShowForm(false);
      setName("");
      setTemplateName("");
      setRecipients("");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function start(id: string) {
    setError(undefined);
    try {
      await api.startCampaign(id);
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  return (
    <PageShell
      title="Campaigns"
      actions={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Close" : "New campaign"}
        </button>
      }
    >
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Event</span>
              <select
                className="w-full rounded border px-2 py-1.5"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">Select event…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Campaign name</span>
              <input
                className="w-full rounded border px-2 py-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Template name (approved in Meta)</span>
              <input
                className="w-full rounded border px-2 py-1.5"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
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
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Recipients (one phone per line, E.164)</span>
            <textarea
              className="h-24 w-full rounded border px-2 py-1.5 font-mono text-xs"
              placeholder="966500000001&#10;966500000002"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </label>
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
              <th className="px-4 py-2 font-medium">Campaign</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Template</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Recipients</th>
              <th className="px-4 py-2 font-medium text-right">Sent / Failed</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-gray-400">
                  No campaigns yet.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-gray-500">{c.eventName}</td>
                <td className="px-4 py-2 text-gray-500">
                  {c.templateName} · {c.templateLanguage}
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={c.status} />
                </td>
                <td className="px-4 py-2 text-right">{c.recipients.total}</td>
                <td className="px-4 py-2 text-right">
                  {c.recipients.sent} / {c.recipients.failed}
                </td>
                <td className="px-4 py-2 text-right">
                  {c.status === "DRAFT" && (
                    <button
                      onClick={() => start(c.id)}
                      className="rounded bg-brand px-3 py-1 text-xs font-medium text-white"
                    >
                      Start
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
