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
type HeaderType = "NONE" | "TEXT";
interface ButtonDraft {
  type: "QUICK_REPLY" | "URL";
  text: string;
  url: string;
}

// Build the Meta "components" array from the structured builder fields.
function buildComponents(
  headerType: HeaderType,
  headerText: string,
  body: string,
  footer: string,
  buttons: ButtonDraft[],
): unknown[] {
  const components: unknown[] = [];
  if (headerType === "TEXT" && headerText.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
  }
  components.push({ type: "BODY", text: body.trim() });
  if (footer.trim()) components.push({ type: "FOOTER", text: footer.trim() });
  const valid = buttons.filter((b) => b.text.trim() && (b.type === "QUICK_REPLY" || b.url.trim()));
  if (valid.length) {
    components.push({
      type: "BUTTONS",
      buttons: valid.map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text.trim(), url: b.url.trim() }
          : { type: "QUICK_REPLY", text: b.text.trim() },
      ),
    });
  }
  return components;
}

export default function TemplatesPage() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState<string | undefined>(undefined);

  // Builder state
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("UTILITY");
  const [eventId, setEventId] = useState("");
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("Hello {{1}}, …");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);

  const load = useCallback(() => {
    api.listTemplates().then(setRows).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    api.listEvents().then(setEvents).catch(() => {});
  }, [load]);

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((b) => [...b, { type: "QUICK_REPLY", text: "", url: "" }]);
  }
  function setButton(i: number, patch: Partial<ButtonDraft>) {
    setButtons((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeButton(i: number) {
    setButtons((b) => b.filter((_, j) => j !== i));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !language.trim() || !body.trim()) {
      setError("Name, language and body are required");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api.createTemplate({
        name: name.trim(),
        language: language.trim(),
        category,
        eventId: eventId || undefined,
        components: buildComponents(headerType, headerText, body, footer, buttons),
      });
      setShowForm(false);
      setName("");
      setHeaderText("");
      setFooter("");
      setButtons([]);
      setNotice("Draft saved. Review it, then Submit to Meta for approval.");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(id: string) {
    setSubmitting(id);
    setError(undefined);
    setNotice(undefined);
    try {
      const r = await api.submitTemplate(id);
      setNotice(`Submitted to Meta — now ${r.status}.`);
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(undefined);
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
      {notice && (
        <div className="mb-4 rounded bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div>
      )}

      {showForm && (
        <form onSubmit={create} className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Template name</span>
                <input
                  className="w-full rounded border px-2 py-1.5"
                  placeholder="event_invite"
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
                <span className="mb-1 block text-gray-600">Event</span>
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

            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Header</span>
                <select
                  className="w-full rounded border px-2 py-1.5"
                  value={headerType}
                  onChange={(e) => setHeaderType(e.target.value as HeaderType)}
                >
                  <option value="NONE">None</option>
                  <option value="TEXT">Text</option>
                </select>
              </label>
              {headerType === "TEXT" && (
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">Header text</span>
                  <input
                    className="w-full rounded border px-2 py-1.5"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                </label>
              )}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">
                Body <span className="text-gray-400">(use {"{{1}}"}, {"{{2}}"} for variables)</span>
              </span>
              <textarea
                className="w-full rounded border px-2 py-1.5"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Footer (optional)</span>
              <input
                className="w-full rounded border px-2 py-1.5"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
              />
            </label>

            <div className="text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-gray-600">Buttons (optional, max 3)</span>
                <button
                  type="button"
                  onClick={addButton}
                  disabled={buttons.length >= 3}
                  className="rounded border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  + button
                </button>
              </div>
              <div className="space-y-2">
                {buttons.map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={b.type}
                      onChange={(e) => setButton(i, { type: e.target.value as ButtonDraft["type"] })}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      <option value="QUICK_REPLY">Quick reply</option>
                      <option value="URL">URL</option>
                    </select>
                    <input
                      placeholder="Button text"
                      value={b.text}
                      onChange={(e) => setButton(i, { text: e.target.value })}
                      className="w-32 rounded border px-2 py-1 text-xs"
                    />
                    {b.type === "URL" && (
                      <input
                        placeholder="https://…"
                        value={b.url}
                        onChange={(e) => setButton(i, { url: e.target.value })}
                        className="w-48 rounded border px-2 py-1 text-xs"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeButton(i)}
                      className="text-xs text-red-600"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
          </div>

          {/* Live preview */}
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Preview</p>
            <div className="rounded-lg border bg-[#e5ddd5] p-4">
              <div className="ml-auto max-w-[260px] rounded-lg bg-white px-3 py-2 text-sm shadow">
                {headerType === "TEXT" && headerText.trim() && (
                  <p className="mb-1 font-semibold">{headerText}</p>
                )}
                <p className="whitespace-pre-wrap">{body || "Body text…"}</p>
                {footer.trim() && <p className="mt-1 text-xs text-gray-400">{footer}</p>}
              </div>
              {buttons.filter((b) => b.text.trim()).length > 0 && (
                <div className="mt-1 space-y-1">
                  {buttons
                    .filter((b) => b.text.trim())
                    .map((b, i) => (
                      <div
                        key={i}
                        className="max-w-[260px] rounded-lg bg-white py-1.5 text-center text-sm text-brand shadow"
                      >
                        {b.text}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
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
              <th className="px-4 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-gray-400">
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
                <td className="px-4 py-2 text-right">
                  {(t.status === "DRAFT" || t.status === "REJECTED") && (
                    <button
                      onClick={() => submit(t.id)}
                      disabled={submitting === t.id}
                      className="rounded border px-3 py-1 text-xs font-medium text-brand hover:bg-brand/5 disabled:opacity-40"
                    >
                      {submitting === t.id ? "Submitting…" : "Submit to Meta"}
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
