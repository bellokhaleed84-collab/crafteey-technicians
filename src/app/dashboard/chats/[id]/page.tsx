"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { apiFetch, readError } from "@/lib/apiClient";
import PageHeader from "@/components/PageHeader";
import QuoteCard, { type CompanyQuote } from "@/components/QuoteCard";

type Msg = {
  id: string;
  senderRole: "client" | "company" | "system";
  type: string;
  quoteId: string | null;
  text: string;
  createdAt: Timestamp | null;
};
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
  const [quotes, setQuotes] = useState<CompanyQuote[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
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
            return {
              id: d.id,
              senderRole: x.senderRole,
              type: x.type ?? "text",
              quoteId: x.quoteId ?? null,
              text: x.text ?? "",
              createdAt: x.createdAt ?? null,
            };
          })
        ),
      () => setLoadError("Couldn't load the messages.")
    );
    return () => {
      offConv();
      offMsgs();
    };
  }, [user, id]);

  const loadQuotes = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(getToken, `/api/quotes?conversationId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setQuotes(Array.isArray(data.quotes) ? data.quotes : []);
    } catch {
      /* keep what we have */
    }
  }, [id, getToken]);

  // Quote status lives in the database, so reload on new messages and every 20 seconds.
  useEffect(() => {
    if (!user) return;
    void loadQuotes();
  }, [user, loadQuotes, messages.length]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => void loadQuotes(), 20000);
    return () => clearInterval(t);
  }, [user, loadQuotes]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, quotes.length]);

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

  async function cancelQuote(quoteId: string) {
    if (!window.confirm("Cancel this quotation? The customer won't be able to pay it.")) return;
    setBusy(true);
    setSendError(null);
    try {
      const res = await apiFetch(getToken, `/api/quotes/${quoteId}/cancel`, { method: "POST" });
      if (!res.ok) setSendError(await readError(res, "Couldn't cancel the quotation."));
      await loadQuotes();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't cancel the quotation.");
    } finally {
      setBusy(false);
    }
  }

  const hasPaidMain = quotes.some((q) => q.kind === "main" && q.status === "paid");
  const quoteById = new Map(quotes.map((q) => [q.id, q]));

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
          if (m.type === "system") {
            return (
              <div key={m.id} className="flex justify-center">
                <p className="rounded-full bg-black/5 px-3 py-1 text-center text-xs text-ink-muted">{m.text}</p>
              </div>
            );
          }
          const mine = m.senderRole === "company";
          if (m.type === "quote") {
            const q = m.quoteId ? quoteById.get(m.quoteId) : undefined;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                {q ? (
                  <QuoteCard quote={q} busy={busy} onCancel={cancelQuote} />
                ) : (
                  <p className="rounded-xl bg-surface px-4 py-2 text-sm text-ink-muted shadow-card">{m.text}</p>
                )}
              </div>
            );
          }
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
        <div className="flex gap-2">
          <Link
            href={`/dashboard/chats/${id}/quote`}
            className="rounded-lg border border-brand px-3 py-2 text-xs font-semibold text-brand"
          >
            Send quotation
          </Link>
          {hasPaidMain && (
            <Link
              href={`/dashboard/chats/${id}/quote?additional=1`}
              className="rounded-lg border border-surface-border px-3 py-2 text-xs font-semibold text-ink-muted"
            >
              Additional quote
            </Link>
          )}
        </div>
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