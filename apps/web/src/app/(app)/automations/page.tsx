"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  api,
  type AutomationDetail,
  type AutomationRow,
  type EventSummary,
} from "@/lib/api";
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

function firstActionText(actions: unknown[]): string {
  const a = actions.find(
    (x): x is { type: string; text?: string } =>
      !!x && typeof x === "object" && (x as { type?: string }).type === "send_text",
  );
  return (a?.text as string) ?? "";
}

/** Inline editor for one automation's conditions + actions. */
function RuleEditor({
  automation,
  onSaved,
  onError,
}: {
  automation: AutomationRow;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [reply, setReply] = useState("");
  const [keywords, setKeywords] = useState("");
  const [startHour, setStartHour] = useState("18:00");
  const [endHour, setEndHour] = useState("09:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getAutomation(automation.id)
      .then((d) => {
        setDetail(d);
        setReply(firstActionText(d.actions));
        const c = d.conditions as { keywords?: string[]; startHour?: string; endHour?: string };
        if (Array.isArray(c.keywords)) setKeywords(c.keywords.join(", "));
        if (c.startHour) setStartHour(c.startHour);
        if (c.endHour) setEndHour(c.endHour);
      })
      .catch(onError);
  }, [automation.id, onError]);

  async function save() {
    if (!detail) return;
    setBusy(true);
    try {
      const conditions: Record<string, unknown> = {};
      if (detail.trigger === "keyword") {
        conditions.keywords = keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
      }
      if (detail.trigger === "out_of_office") {
        conditions.startHour = startHour;
        conditions.endHour = endHour;
      }
      const actions =
        detail.trigger === "assignment" ? detail.actions : [{ type: "send_text", text: reply }];
      await api.updateAutomationConfig(automation.id, { conditions, actions });
      onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <div className="bg-gray-50 px-4 py-3 text-xs text-gray-400">Loading…</div>
    );
  }

  return (
    <div className="space-y-3 bg-gray-50 px-4 py-3">
      {detail.trigger === "keyword" && (
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">
            Trigger keywords <span className="text-gray-400">(comma separated)</span>
          </span>
          <input
            className="w-full rounded border px-2 py-1.5"
            placeholder="price, cost, how much"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </label>
      )}

      {detail.trigger === "out_of_office" && (
        <div className="flex items-center gap-3 text-sm">
          <label>
            <span className="mb-1 block text-gray-600">After</span>
            <input
              type="time"
              className="rounded border px-2 py-1.5"
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
            />
          </label>
          <label>
            <span className="mb-1 block text-gray-600">Until</span>
            <input
              type="time"
              className="rounded border px-2 py-1.5"
              value={endHour}
              onChange={(e) => setEndHour(e.target.value)}
            />
          </label>
        </div>
      )}

      {detail.trigger === "assignment" ? (
        <p className="text-sm text-gray-500">
          New conversations matching this rule are auto-assigned round-robin to the event&apos;s
          agents.
        </p>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Auto-reply message</span>
          <textarea
            className="w-full rounded border px-2 py-1.5"
            rows={3}
            placeholder="Thanks for your message! We'll reply during working hours."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
        </label>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save rule"}
      </button>
    </div>
  );
}

export default function AutomationsPage() {
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | undefined>(undefined);

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

  const fail = useCallback((e: unknown) => {
    setError(String(e instanceof Error ? e.message : e));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const created = await api.createAutomation({ name, trigger, eventId: eventId || undefined });
      setShowForm(false);
      setName("");
      load();
      setExpanded(created.id);
    } catch (err) {
      fail(err);
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
      fail(err);
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
              <th className="px-4 py-2 font-medium">Rule</th>
              <th className="px-4 py-2 font-medium text-right">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-gray-400">
                  No automations yet.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <Fragment key={a.id}>
                <tr className="border-t">
                  <td className="px-4 py-2 font-medium">{a.name}</td>
                  <td className="px-4 py-2 text-gray-500">{triggerLabel(a.trigger)}</td>
                  <td className="px-4 py-2 text-gray-500">{a.eventName ?? "All events"}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setExpanded((v) => (v === a.id ? undefined : a.id))}
                      className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      {expanded === a.id ? "Close" : "Edit rule"}
                    </button>
                  </td>
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
                {expanded === a.id && (
                  <tr className="border-t">
                    <td colSpan={5} className="p-0">
                      <RuleEditor
                        automation={a}
                        onSaved={() => {
                          setExpanded(undefined);
                          load();
                        }}
                        onError={fail}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
