"use client";

import React from "react";
import { ChatListItem, User } from "@/lib/types";
import { MessageSquarePlus, UserCircle, Image as ImageIcon } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

interface ChatListProps {
  chats: ChatListItem[];
  currentUser: User;
  onSelectChat: (chat: ChatListItem) => void;
  onOpenAddContact: () => void;
  onOpenProfile: () => void;
}

// WhatsApp Style Short Timestamp
const formatChatTime = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, "p"); // 10:45 AM
    if (isYesterday(d)) return "Yesterday";
    return format(d, "dd/MM/yy");
  } catch {
    return "";
  }
};

export default function ChatList({
  chats,
  currentUser,
  onSelectChat,
  onOpenAddContact,
  onOpenProfile,
}: ChatListProps) {
  return (
    <div className="flex flex-col h-full bg-(--app-bg)">
      {/* Top Navbar */}
      <div className="px-4 py-3 border-b border-(--app-border) bg-(--app-surface) flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/katha.svg"
            alt="katha"
            className="w-8 h-8 object-contain drop-shadow-sm"
          />
          <span className="font-extrabold text-lg tracking-tight">katha</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenAddContact}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand/10 hover:text-brand transition"
            title="Add Contact"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand/10 hover:text-brand transition overflow-hidden flex items-center justify-center"
            title="Profile"
            aria-label="Open your profile"
          >
            {currentUser.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Chat List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-(--app-border)/40">
        {chats.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mb-4">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <p className="font-semibold text-sm mb-1 text-(--app-text)">No conversations yet</p>
            <p className="text-xs">Tap the button above to add contacts by email and start chatting!</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.conversationId}
              onClick={() => onSelectChat(chat)}
              className="px-4 py-3 flex items-center gap-3.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-base font-bold text-brand overflow-hidden shrink-0">
                {chat.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={chat.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  chat.displayName.charAt(0).toUpperCase()
                )}
              </div>

              {/* Chat Meta Container */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                {/* Row 1: Name (Left) + Timestamp (Right) */}
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm text-(--app-text) truncate flex-1">
                    {chat.displayName}
                  </h4>
                  {chat.lastMessageAt && (
                    <span
                      className={`text-[11px] shrink-0 font-medium ${
                        chat.unreadCount && chat.unreadCount > 0 ? "text-brand" : "text-slate-400"
                      }`}
                    >
                      {formatChatTime(chat.lastMessageAt)}
                    </span>
                  )}
                </div>

                {/* Row 2: Message Preview (Left) + Unread Badge (Right) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0">
                    {chat.lastMessageType === "IMAGE" ? (
                      <span className="flex items-center gap-1 text-brand">
                        <ImageIcon className="w-3.5 h-3.5" /> Photo
                      </span>
                    ) : (
                      <span className="truncate">{chat.lastMessage || "No messages yet"}</span>
                    )}
                  </div>

                  {/* WhatsApp Style Unread Counter Badge */}
                  {chat.unreadCount && chat.unreadCount > 0 ? (
                    <span className="min-w-4.5 h-4.5 px-1.5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm shadow-brand/30">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
