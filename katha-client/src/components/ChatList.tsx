"use client";

import React from "react";
import { ChatListItem } from "@/lib/types";
import Image from "next/image";
import { MessageSquarePlus, UserCircle, Image as ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ChatListProps {
  chats: ChatListItem[];
  onSelectChat: (chat: ChatListItem) => void;
  onOpenAddContact: () => void;
  onOpenProfile: () => void;
}

export default function ChatList({
  chats,
  onSelectChat,
  onOpenAddContact,
  onOpenProfile,
}: ChatListProps) {
  return (
    <div className="flex flex-col h-full bg-(--app-bg)">
      <div className="px-4 py-3 border-b border-(--app-border) bg-(--app-surface) flex items-center justify-between">
        <div className="flex items-center gap-2.5">
        <Image
          src="/katha.svg"
          alt="katha logo"
          width={32}
          height={32}
          className="w-8 h-8 object-contain drop-shadow-sm"
        />
          <span className="font-extrabold text-lg tracking-tight">katha</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddContact}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand/10 hover:text-brand transition"
            title="Add Contact"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand/10 hover:text-brand transition"
            title="Profile"
          >
            <UserCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-(--app-border)/50">
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
              className="px-4 py-3.5 flex items-center gap-3.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-base font-bold text-brand overflow-hidden shrink-0">
                {chat.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={chat.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  chat.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-sm truncate">{chat.displayName}</h4>
                  {chat.lastMessageAt && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 truncate">
                  {chat.lastMessageType === "IMAGE" ? (
                    <span className="flex items-center gap-1 text-brand">
                      <ImageIcon className="w-3.5 h-3.5" /> Photo
                    </span>
                  ) : (
                    <span>{chat.lastMessage || "No messages yet"}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}