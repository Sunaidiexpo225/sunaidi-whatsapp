"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ContactRow } from "@/lib/api";
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

export default function ContactsPage() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback((term: string) => {
    api.listContacts(term || undefined).then(setRows).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <PageShell
      title="Contacts"
      actions={
        <input
          placeholder="Search name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded border px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
      }
    >
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Country</th>
              <th className="px-4 py-2 font-medium">Consent</th>
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
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
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
                <td className="px-4 py-2 text-gray-500">{c.visitor?.country || "—"}</td>
                <td className="px-4 py-2">
                  {c.visitor ? <ConsentPill consent={c.visitor.consent} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
