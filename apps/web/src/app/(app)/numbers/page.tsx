"use client";

import { useEffect, useState } from "react";
import { api, type NumberRow } from "@/lib/api";
import { PageShell } from "@/components/page-shell";

function QualityPill({ rating }: { rating: string }) {
  const color =
    rating === "GREEN"
      ? "bg-green-100 text-green-700"
      : rating === "YELLOW"
        ? "bg-amber-100 text-amber-700"
        : rating === "RED"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-500";
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{rating}</span>;
}

export default function NumbersPage() {
  const [rows, setRows] = useState<NumberRow[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    api.listNumbers().then(setRows).catch((e) => setError(String(e)));
  }, []);

  return (
    <PageShell title="WhatsApp numbers">
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <p className="mb-4 text-sm text-gray-500">
        One number per event. Connect a number by adding its Meta phone-number id and access
        token (done during setup).
      </p>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Quality</th>
              <th className="px-4 py-2 font-medium text-right">Messaging limit</th>
              <th className="px-4 py-2 font-medium">API</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-gray-400">
                  No numbers connected yet.
                </td>
              </tr>
            )}
            {rows.map((n) => (
              <tr key={n.id} className="border-t">
                <td className="px-4 py-2 font-medium">{n.eventName}</td>
                <td className="px-4 py-2 text-gray-600">
                  {n.displayName ? `${n.displayName} · ` : ""}
                  {n.displayPhone}
                </td>
                <td className="px-4 py-2">
                  <QualityPill rating={n.qualityRating} />
                </td>
                <td className="px-4 py-2 text-right">{n.messagingLimit ?? "—"}</td>
                <td className="px-4 py-2 text-gray-400">{n.graphApiVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
