"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type CannedReplyRow,
  type UserRole,
  type UserRow,
} from "@/lib/api";
import { PageShell } from "@/components/page-shell";

const ROLES: UserRole[] = ["ADMIN", "SUPERVISOR", "AGENT"];

function RolePill({ role }: { role: UserRole }) {
  const color =
    role === "ADMIN"
      ? "bg-purple-100 text-purple-700"
      : role === "SUPERVISOR"
        ? "bg-blue-100 text-blue-700"
        : "bg-gray-100 text-gray-600";
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{role.toLowerCase()}</span>;
}

export default function TeamPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [replies, setReplies] = useState<CannedReplyRow[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  // Invite form
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("AGENT");
  const [invBusy, setInvBusy] = useState(false);

  // Canned reply form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [crBusy, setCrBusy] = useState(false);

  const loadUsers = useCallback(() => {
    api.listUsers().then(setUsers).catch((e) => setError(String(e)));
  }, []);
  const loadReplies = useCallback(() => {
    api.listCannedReplies().then(setReplies).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    loadUsers();
    loadReplies();
  }, [loadUsers, loadReplies]);

  function fail(e: unknown) {
    setError(String(e instanceof Error ? e.message : e));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInvBusy(true);
    setError(undefined);
    try {
      await api.createUser({ email: email.trim(), name: name.trim() || undefined, role });
      setEmail("");
      setName("");
      setRole("AGENT");
      loadUsers();
    } catch (err) {
      fail(err);
    } finally {
      setInvBusy(false);
    }
  }

  async function changeRole(id: string, newRole: UserRole) {
    setError(undefined);
    try {
      await api.updateUser(id, { role: newRole });
      loadUsers();
    } catch (err) {
      fail(err);
    }
  }

  async function addReply(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setCrBusy(true);
    setError(undefined);
    try {
      await api.createCannedReply({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      loadReplies();
    } catch (err) {
      fail(err);
    } finally {
      setCrBusy(false);
    }
  }

  async function removeReply(id: string) {
    setError(undefined);
    try {
      await api.deleteCannedReply(id);
      loadReplies();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <PageShell title="Team">
      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Agents / roles */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Agents &amp; roles
          </h2>

          <form
            onSubmit={invite}
            className="mb-4 space-y-3 rounded-lg border bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border px-2 py-1.5 text-sm"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="rounded border px-2 py-1.5 text-sm"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                className="rounded border px-2 py-1.5 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.toLowerCase()}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={invBusy}
                className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {invBusy ? "Adding…" : "Add agent"}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Invited agents are pre-provisioned; they gain access once per-user sign-in is
              connected.
            </p>
          </form>

          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-gray-400">
                      No agents yet.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{u.name ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Canned replies */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Canned replies
          </h2>

          <form
            onSubmit={addReply}
            className="mb-4 space-y-3 rounded-lg border bg-white p-4 shadow-sm"
          >
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Title (e.g. Opening hours)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded border px-2 py-1.5 text-sm"
              rows={3}
              placeholder="Reply text agents can insert…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="submit"
              disabled={crBusy}
              className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {crBusy ? "Saving…" : "Add canned reply"}
            </button>
          </form>

          <div className="space-y-2">
            {replies.length === 0 && (
              <p className="rounded-lg border bg-white px-4 py-3 text-sm text-gray-400 shadow-sm">
                No canned replies yet.
              </p>
            )}
            {replies.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between rounded-lg border bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-gray-500">{r.body}</p>
                </div>
                <button
                  onClick={() => removeReply(r.id)}
                  className="ml-3 shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
