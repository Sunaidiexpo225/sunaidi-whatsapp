"use client";

import { useEffect, useState } from "react";
import { api, type DashboardSummary } from "@/lib/api";
import { AppHeader } from "@/components/app-header";

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}

        {data && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Conversations</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total" value={data.conversations.total} />
                <Stat label="Open" value={data.conversations.open} />
                <Stat label="Pending" value={data.conversations.pending} />
                <Stat label="Resolved" value={data.conversations.resolved} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Messages (last 7 days)</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Sent out" value={data.messages7d.outbound} />
                <Stat
                  label="Delivered"
                  value={data.messages7d.delivered}
                  sub={pct(data.messages7d.delivered, data.messages7d.outbound) + " of sent"}
                />
                <Stat
                  label="Read"
                  value={data.messages7d.read}
                  sub={pct(data.messages7d.read, data.messages7d.outbound) + " of sent"}
                />
                <Stat label="Failed" value={data.messages7d.failed} />
                <Stat label="Received" value={data.messages7d.inbound} />
                <Stat label="Contacts" value={data.contacts} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Campaigns</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Total" value={data.campaigns.total} />
                <Stat label="Sending" value={data.campaigns.sending} />
                <Stat label="Completed" value={data.campaigns.completed} />
                <Stat label="Recipients sent" value={data.campaigns.recipientsSent} />
                <Stat label="Failed" value={data.campaigns.recipientsFailed} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Events</h2>
              <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 font-medium">Number</th>
                      <th className="px-4 py-2 font-medium text-right">Open chats</th>
                      <th className="px-4 py-2 font-medium text-right">Sent (7d)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.length === 0 && (
                      <tr>
                        <td className="px-4 py-3 text-gray-400" colSpan={4}>
                          No WhatsApp numbers connected yet.
                        </td>
                      </tr>
                    )}
                    {data.events.map((e) => (
                      <tr key={e.phoneNumberId} className="border-t">
                        <td className="px-4 py-2 font-medium">{e.name}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {e.displayName ? `${e.displayName} · ` : ""}
                          {e.phone}
                        </td>
                        <td className="px-4 py-2 text-right">{e.openConversations}</td>
                        <td className="px-4 py-2 text-right">{e.sent7d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
