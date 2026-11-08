"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type ConsentFilter,
  type ContactRow,
  type TagRef,
  type TagRow,
} from "@/lib/api";
import { PageShell } from "@/components/page-shell";

function ConsentPill({ consent }: { consent: string }) {
  const color =
    consent === "Opted-in"
      ? "bg-green-100 text-green-700"
      : consent === "Opted-out"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{consent}</span>;
}

// Deterministic chip colour so a given tag always looks the same.
const CHIP_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-indigo-100 text-indigo-700",
];
function chipColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length]!;
}

function TagChip({
  tag,
  onRemove,
}: {
  tag: TagRef;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${chipColor(tag.name)}`}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="font-bold opacity-60 hover:opacity-100"
          aria-label={`Remove ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

function AddTagMenu({
  tags,
  assigned,
  onAssign,
  onCreate,
}: {
  tags: TagRow[];
  assigned: Set<string>;
  onAssign: (tagId: string) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const available = tags.filter((t) => !assigned.has(t.id));

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-dashed px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
      >
        + tag
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-48 rounded-lg border bg-white p-2 shadow-lg">
          <div className="max-h-40 overflow-auto">
            {available.length === 0 && (
              <p className="px-1 py-1 text-xs text-gray-400">No other tags</p>
            )}
            {available.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onAssign(t.id);
                  setOpen(false);
                }}
                className="block w-full rounded px-1.5 py-1 text-left text-xs hover:bg-gray-50"
              >
                {t.name}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim();
              if (n) {
                onCreate(n);
                setNewName("");
                setOpen(false);
              }
            }}
            className="mt-2 flex gap-1 border-t pt-2"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New tag…"
              className="w-full rounded border px-1.5 py-1 text-xs focus:border-brand focus:outline-none"
            />
            <button type="submit" className="rounded bg-brand px-2 text-xs font-medium text-white">
              Add
            </button>
          </form>
        </div>
      )}
    </span>
  );
}

export default function ContactsPage() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [search, setSearch] = useState("");
  const [tagId, setTagId] = useState("");
  const [consent, setConsent] = useState<"" | ConsentFilter>("");
  const [error, setError] = useState<string | undefined>(undefined);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | undefined>(undefined);

  const loadTags = useCallback(() => {
    api.listTags().then(setTags).catch(() => {});
  }, []);

  const load = useCallback(() => {
    api
      .listContacts({
        search: search || undefined,
        tagId: tagId || undefined,
        consent: consent || undefined,
      })
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, [search, tagId, consent]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function assignTag(contactId: string, id: string) {
    setError(undefined);
    try {
      await api.addContactTag(contactId, id);
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function createAndAssign(contactId: string, name: string) {
    setError(undefined);
    try {
      const tag = await api.createTag({ name });
      await api.addContactTag(contactId, tag.id);
      loadTags();
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function removeTag(contactId: string, id: string) {
    setError(undefined);
    try {
      await api.removeContactTag(contactId, id);
      loadTags();
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    const contacts = importText
      .split(/[\n\r]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [to, ...rest] = line.split(/[,\t]/);
        return { to: to!.trim(), name: rest.join(" ").trim() || undefined };
      });
    if (contacts.length === 0) {
      setError("Paste at least one phone number");
      return;
    }
    setImporting(true);
    setImportResult(undefined);
    setError(undefined);
    try {
      const r = await api.importContacts({ contacts });
      setImportResult(`${r.created} added, ${r.updated} updated, ${r.skipped} skipped.`);
      setImportText("");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <PageShell
      title="Contacts"
      actions={
        <button
          onClick={() => setShowImport((v) => !v)}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          {showImport ? "Close" : "Import"}
        </button>
      }
    >
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {showImport && (
        <form onSubmit={runImport} className="mb-6 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">
            Paste one phone number per line (E.164, e.g. <code>966500000001</code>). Add a name
            after a comma: <code>966500000001, Dana</code>.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className="w-full rounded border px-3 py-2 font-mono text-xs focus:border-brand focus:outline-none"
            placeholder={"966500000001, Dana Al-Harbi\n966500000002"}
          />
          {importResult && <p className="text-sm text-green-700">{importResult}</p>}
          <button
            type="submit"
            disabled={importing}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {importing ? "Importing…" : "Import contacts"}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          placeholder="Search name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded border px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
        <select
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.contactCount})
            </option>
          ))}
        </select>
        <select
          value={consent}
          onChange={(e) => setConsent(e.target.value as "" | ConsentFilter)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Any consent</option>
          <option value="OPTED_IN">Opted-in</option>
          <option value="PENDING">Pending</option>
          <option value="OPTED_OUT">Opted-out</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Consent</th>
              <th className="px-4 py-2 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-gray-400">
                  No contacts found.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const assigned = new Set(c.tags.map((t) => t.id));
              return (
                <tr key={c.id} className="border-t align-top">
                  <td className="px-4 py-2 font-medium">
                    {c.name ?? c.visitor?.name ?? "—"}
                    {c.visitor && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        VDMS
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{c.waId}</td>
                  <td className="px-4 py-2 text-gray-500">{c.visitor?.company || "—"}</td>
                  <td className="px-4 py-2">
                    {c.visitor ? <ConsentPill consent={c.visitor.consent} /> : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {c.tags.map((t) => (
                        <TagChip key={t.id} tag={t} onRemove={() => removeTag(c.id, t.id)} />
                      ))}
                      <AddTagMenu
                        tags={tags}
                        assigned={assigned}
                        onAssign={(id) => assignTag(c.id, id)}
                        onCreate={(name) => createAndAssign(c.id, name)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
