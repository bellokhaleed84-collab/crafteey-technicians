"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import PageHeader from "@/components/PageHeader";

type Msg = { id: string; senderRole: "client" | "company"; text: string; createdAt: Timestamp | null };
type ConvInfo = { clientName: string; requestTitle: string; unreadCompany: number };

function hhmm(ts: Timestamp | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(
    ts.toDate()
  );
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, getToken } = useAuth();
  const [conv, setConv] = useState<ConvInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !id) return;
    const offConv = onSnapshot(
      doc(db, "conversations", id),
      (snap) => {
        const x = snap.data();
        if (!x) return setLoadError("This chat wasn't found.");
        setConv({
          clientName: x.clientName ?? "Customer",
          requestTitle: x.requestTitle ?? "",
          unreadCompany: x.unreadCompany ?? 0,
        });
      },
      () => setLoadError("You can't open this chat.")
    );
    const offMsgs = onSnapshot(
      query(collection(db, "conversations", id, "messages"), orderBy("createdAt", "asc"), limit(300)),
      (snap) =>
        setMessages(
          snap.docs.map((d) => {
            const x = d.data();
            return { id: d.id, senderRole: x.senderRole, text: x.text ?? "", createdAt: x.createdAt ?? null };
          })
        ),
      () => setLoadError("Couldn't load the messages.")
    );
    return () => {
      offConv();
      offMsgs();
    };
  }, [user, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Clear the unread badge while this chat is open.
  useEffect(() => {
    if (!conv || conv.unreadCompany === 0) return;
    void apiFetch(getToken, "/api/chat/read", {
      method: "POST",
      body: JSON.stringify({ conversationId: id }),
    }).catch(() => {});
  }, [conv, id, getToken]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setBlocked(null);
    setSendError(null);
    try {
      const res = await apiFetch(getToken, "/api/chat/send", {
        method: "POST",
        body: JSON.stringify({ conversationId: id, text: t }),
      });
      if (res.ok) {
        setText("");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.blocked) setBlocked(data.error);
      else setSendError(data.error || "Couldn't send your message. Try again.");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send your message. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Chat" backHref="/dashboard/chats" />
        <p role="alert" className="m-5 rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
          {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <PageHeader title={conv?.clientName ?? "Chat"} subtitle={conv?.requestTitle} backHref="/dashboard/chats" />

      <div className="flex-1 space-y-2 px-5 py-4">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-sm text-ink-muted">No messages yet. Say hello.</p>
        )}
        {messages.map((m) => {
          const mine = m.senderRole === "company";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-surface text-ink shadow-card"
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/80" : "text-ink-faint"}`}>
                  {hhmm(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 space-y-2 border-t border-surface-border bg-surface p-3">
        {blocked && (
          <p role="alert" className="rounded-lg bg-status-warning-bg p-3 text-sm text-status-warning">
            {blocked}
          </p>
        )}
        {sendError && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {sendError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="max-h-32 min-h-12 flex-1 resize-none rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}