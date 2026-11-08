"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type ConversationSummary,
  type EventSummary,
  type MessageView,
} from "@/lib/api";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InboxPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    api.listEvents().then(setEvents).catch((e) => setError(String(e)));
  }, []);

  const loadConversations = useCallback(() => {
    api
      .listConversations(eventId)
      .then(setConversations)
      .catch((e) => setError(String(e)));
  }, [eventId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    api.getMessages(activeId).then(setMessages).catch((e) => setError(String(e)));
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b bg-brand px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">Sunaidi WhatsApp</h1>
        <select
          className="rounded bg-brand-dark px-2 py-1 text-sm"
          value={eventId ?? ""}
          onChange={(e) => {
            setEventId(e.target.value || undefined);
            setActiveId(undefined);
          }}
        >
          <option value="">All events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Conversation list */}
        <aside className="w-80 overflow-y-auto border-r bg-white">
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
          )}
          <ul>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full flex-col border-b px-4 py-3 text-left hover:bg-gray-50 ${
                    c.id === activeId ? "bg-gray-100" : ""
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-medium">
                      {c.contact.name ?? c.contact.waId}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="truncate text-sm text-gray-500">
                    {c.lastMessage?.text ?? `[${c.lastMessage?.type ?? "no messages"}]`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Message thread */}
        <main className="flex min-w-0 flex-1 flex-col bg-gray-50">
          {active ? (
            <>
              <div className="border-b bg-white px-4 py-3">
                <p className="font-medium">
                  {active.contact.name ?? active.contact.waId}
                </p>
                <p className="text-xs text-gray-500">{active.contact.waId}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        m.direction === "OUTBOUND"
                          ? "bg-brand text-white"
                          : "bg-white text-gray-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">
                        {m.text ?? `[${m.type}]`}
                      </p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          m.direction === "OUTBOUND" ? "text-white/70" : "text-gray-400"
                        }`}
                      >
                        {formatTime(m.createdAt)}
                        {m.direction === "OUTBOUND" ? ` · ${m.status.toLowerCase()}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t bg-white p-3 text-center text-sm text-gray-400">
                Replying from the inbox ships in the next update.
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400">
              Select a conversation
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
