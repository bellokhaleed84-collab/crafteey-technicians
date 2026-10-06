"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readError } from "@/lib/apiClient";
import PageHeader from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";

type Conv = {
  id: string;
  clientName: string;
  requestTitle: string;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  unreadCompany: number;
};

function timeLabel(ts: Timestamp | null): string {
  if (!ts) return "";
  const d = ts.toDate();
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(d)
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(d);
}

export default function ChatsPage() {
  const { user, getToken } = useAuth();
  const [chats, setChats] = useState<Conv[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devUid, setDevUid] = useState("");
  const [devMsg, setDevMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "conversations"),
      where("participantUids", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setChats(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              clientName: x.clientName ?? "Customer",
              requestTitle: x.requestTitle ?? "",
              lastMessage: x.lastMessage ?? "",
              lastMessageAt: x.lastMessageAt ?? null,
              unreadCompany: x.unreadCompany ?? 0,
            };
          })
        );
        setError(null);
      },
      (err) => {
        console.error("chats listen error", err);
        setError("Couldn't load your chats. Check your connection and try again.");
      }
    );
  }, [user]);

  async function createTestChat() {
    setDevMsg(null);
    try {
      const res = await apiFetch(getToken, "/api/chat/dev-seed", {
        method: "POST",
        body: JSON.stringify({ clientUid: devUid.trim(), clientName: "Test client" }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't create the test chat."));
      setDevUid("");
      setDevMsg("Test chat created.");
    } catch (err) {
      setDevMsg(err instanceof Error ? err.message : "Couldn't create the test chat.");
    }
  }

  return (
    <div>
      <PageHeader title="Chats" subtitle="Your conversations with customers" />

      <div className="space-y-3 px-5 pt-4 pb-6">
        {error && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
          </p>
        )}

        {!chats && !error && (
          <div aria-busy="true" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {chats && chats.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-8 text-center">
            <p className="font-semibold text-ink">No chats yet</p>
            <p className="mt-1 text-sm text-ink-muted">When a customer requests your company, the chat opens here.</p>
          </div>
        )}

        {chats?.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/chats/${c.id}`}
            className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card"
          >
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-base font-bold text-brand-dark"
            >
              {c.clientName.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{c.clientName}</p>
              <p className="truncate text-xs text-ink-muted">{c.requestTitle}</p>
              <p className="truncate text-sm text-ink-muted">{c.lastMessage || "No messages yet"}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] text-ink-faint">{timeLabel(c.lastMessageAt)}</span>
              {c.unreadCompany > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                  {c.unreadCompany}
                </span>
              )}
            </div>
          </Link>
        ))}

        {process.env.NODE_ENV !== "production" && (
          <div className="space-y-2 rounded-2xl border border-dashed border-surface-border p-4">
            <p className="text-xs font-semibold text-ink-muted">Dev only: create a test chat</p>
            <input
              className="w-full min-h-12 rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-brand"
              placeholder="Firebase uid of a test client"
              value={devUid}
              onChange={(e) => setDevUid(e.target.value)}
            />
            <button
              onClick={createTestChat}
              disabled={!devUid.trim()}
              className="min-h-12 w-full rounded-xl border border-surface-border font-semibold text-ink disabled:opacity-60"
            >
              Create test chat
            </button>
            {devMsg && <p className="text-xs text-ink-muted">{devMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}