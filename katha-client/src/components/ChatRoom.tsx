"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChatListItem, Message, User } from "@/lib/types";
import { api } from "@/lib/api";
import { compressToWebP } from "@/lib/compress";
import { getSocket } from "@/lib/socket";
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Trash2,
  Loader2,
  UserPlus,
  ShieldAlert,
  Ban,
} from "lucide-react";

interface ChatRoomProps {
  chat: ChatListItem;
  currentUser: User;
  onBack: () => void;
}

export default function ChatRoom({ chat, currentUser, onBack }: ChatRoomProps) {
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  // Keyboard-aware viewport height (fixes input/header lifting on mobile)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Unknown Contact & Block States
  const [currentDisplayName, setCurrentDisplayName] = useState(chat.displayName);
  const [isSaved, setIsSaved] = useState(chat.isSaved ?? chat.displayName !== chat.email);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [customNameInput, setCustomNameInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior });
  };

  // Track the visible viewport (shrinks when the keyboard opens)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setViewportHeight(vv.height);
      // Stop the browser from pushing the whole page up
      window.scrollTo(0, 0);
      requestAnimationFrame(() => scrollToBottom("auto"));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messagesList]);

  // Load message history from DB
  useEffect(() => {
    api
      .get(`/contacts/messages/${chat.conversationId}`)
      .then((res) => {
        if (res.data.messages) {
          setMessagesList(res.data.messages);
        }
      })
      .catch((err) => console.error("Failed to load message history", err));
  }, [chat.conversationId]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket(currentUser.id);

    socket.emit("check_presence", { targetUserId: chat.partnerId });

    socket.on("presence_status", ({ userId, isOnline }) => {
      if (userId === chat.partnerId) setPartnerOnline(isOnline);
    });

    socket.on("user_presence", ({ userId, isOnline }) => {
      if (userId === chat.partnerId) setPartnerOnline(isOnline);
    });

    socket.on("user_typing", ({ conversationId, isTyping }) => {
      if (conversationId === chat.conversationId) setIsTyping(isTyping);
    });

    socket.on("new_message", (newMsg: Message) => {
      if (newMsg.conversationId === chat.conversationId) {
        setMessagesList((prev) => [...prev, newMsg]);
        socket.emit("mark_read", {
          conversationId: chat.conversationId,
          senderId: chat.partnerId,
        });
      }
    });

    socket.on("messages_read", ({ conversationId }) => {
      if (conversationId === chat.conversationId) {
        setMessagesList((prev) =>
          prev.map((m) => (m.senderId === currentUser.id ? { ...m, status: "READ" } : m))
        );
      }
    });

    socket.on("message_deleted", ({ messageId, conversationId }) => {
      if (conversationId === chat.conversationId) {
        setMessagesList((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, content: "This message was deleted" } : m
          )
        );
      }
    });

    return () => {
      socket.off("presence_status");
      socket.off("user_presence");
      socket.off("user_typing");
      socket.off("new_message");
      socket.off("messages_read");
      socket.off("message_deleted");
    };
  }, [chat.conversationId, chat.partnerId, currentUser.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const socket = getSocket(currentUser.id);

    socket.emit("typing_start", {
      receiverId: chat.partnerId,
      conversationId: chat.conversationId,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", {
        receiverId: chat.partnerId,
        conversationId: chat.conversationId,
      });
    }, 1500);
  };

  const handleSendMessage = (content: string, type: "TEXT" | "IMAGE" = "TEXT") => {
    if (!content.trim() || isBlocked) return;
    const socket = getSocket(currentUser.id);

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversationId: chat.conversationId,
      senderId: currentUser.id,
      content,
      type,
      isDeleted: false,
      status: "SENT",
      createdAt: new Date().toISOString(),
    };

    setMessagesList((prev) => [...prev, optimisticMessage]);

    if (type === "TEXT") {
      setInputText("");
      inputRef.current?.focus(); // keep keyboard open after sending
    }

    socket.emit(
      "send_message",
      {
        conversationId: chat.conversationId,
        receiverId: chat.partnerId,
        senderId: currentUser.id,
        content,
        type,
      },
      (res: { success?: boolean; message?: Message; error?: string }) => {
        if (res?.success && res.message) {
          setMessagesList((prev) => prev.map((m) => (m.id === tempId ? res.message! : m)));
        }
      }
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isBlocked) return;

    setUploadingImage(true);
    try {
      const webpFile = await compressToWebP(file);
      const { data } = await api.post("/upload/presigned-url", { contentType: "image/webp" });

      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: webpFile,
      });

      handleSendMessage(data.publicUrl, "IMAGE");
    } catch (err) {
      console.error("Upload error", err);
    } finally {
      setUploadingImage(false);
      // allow picking the same file again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    const socket = getSocket(currentUser.id);
    socket.emit("delete_message", {
      messageId,
      conversationId: chat.conversationId,
      receiverId: chat.partnerId,
    });
  };

  // WhatsApp Action: Save Unknown Contact
  const handleSaveContact = async () => {
    if (!customNameInput.trim()) return;
    setActionLoading(true);
    try {
      await api.post("/contacts/add", {
        email: chat.email,
        customName: customNameInput,
      });
      setIsSaved(true);
      setShowAddPrompt(false);
      setCurrentDisplayName(customNameInput);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async () => {
    setActionLoading(true);
    try {
      await api.post("/contacts/block", { targetUserId: chat.partnerId });
      setIsBlocked(true);
      setShowBlockModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}
      className="flex min-h-0 flex-col overflow-hidden bg-(--app-bg)"
    >
      {/* Fixed WhatsApp-style chat header */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-(--app-border) bg-(--app-surface) shadow-sm">
        <div className="flex min-h-16 items-center justify-between gap-2 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={onBack}
              className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-black/5 hover:text-(--app-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Back to chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-sm font-bold text-brand">
              {chat.avatarUrl && failedAvatarUrl !== chat.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={chat.avatarUrl}
                  alt={`${currentDisplayName}'s profile photo`}
                  className="w-full h-full object-cover"
                  onError={() => setFailedAvatarUrl(chat.avatarUrl!)}
                />
              ) : (
                currentDisplayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h4 className="truncate font-bold text-sm leading-tight">{currentDisplayName}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    partnerOnline ? "bg-brand-accent animate-pulse" : "bg-slate-500"
                  }`}
                />
                <span className="text-[10px] text-slate-400">
                  {isTyping ? "typing..." : partnerOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Header action remains visible while the messages scroll. */}
          {!isBlocked && (
            <button
              onClick={() => setShowBlockModal(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-slate-300"
              aria-label={`Block ${currentDisplayName}`}
              title="Block user"
            >
              <Ban className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* WhatsApp Style Unknown Sender Alert Banner */}
      {!isSaved && !isBlocked && (
        <div className="shrink-0 p-3 bg-brand/5 border-b border-(--app-border) flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-brand" />
            <span>This sender is not in your contacts ({chat.email}).</span>
          </div>

          {showAddPrompt ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                placeholder="Enter contact name..."
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-(--app-surface) border border-(--app-border) rounded-xl focus:outline-none focus:border-brand"
              />
              <button
                onClick={handleSaveContact}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-brand text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </button>
              <button
                onClick={() => setShowAddPrompt(false)}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                onClick={() => setShowBlockModal(true)}
                disabled={actionLoading}
                className="px-3 py-1 text-xs text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 font-medium transition"
              >
                Block
              </button>
              <button
                onClick={() => {
                  setCustomNameInput(chat.username || "");
                  setShowAddPrompt(true);
                }}
                className="px-3 py-1 text-xs text-white bg-brand rounded-lg hover:opacity-90 font-medium flex items-center gap-1 transition"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add to Contacts
              </button>
            </div>
          )}
        </div>
      )}

      {/* Blocked Notification Banner */}
      {isBlocked && (
        <div className="shrink-0 p-2.5 bg-red-500/10 border-b border-red-500/20 text-center text-xs text-red-400 font-medium">
          You have blocked this contact. You cannot send or receive messages.
        </div>
      )}

      {/* Messages Feed */}
      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
      >
        {messagesList.map((m, idx) => {
          const isMe = m.senderId === currentUser.id;

          // WhatsApp Style: Check if this is the FIRST unread incoming message
          const isFirstUnread =
            !isMe &&
            m.status !== "READ" &&
            (idx === 0 ||
              messagesList[idx - 1].status === "READ" ||
              messagesList[idx - 1].senderId === currentUser.id);

          return (
            <React.Fragment key={m.id}>
              {/* WhatsApp Style Unread Messages Divider */}
              {isFirstUnread && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-3.5 py-1 rounded-full bg-(--app-surface) border border-brand/40 text-brand text-[11px] font-bold tracking-wider uppercase shadow-xs">
                    Unread Messages
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-xs relative ${
                    isMe
                      ? "bg-brand text-white rounded-tr-xs"
                      : "bg-(--app-bubble-in) text-(--app-text) rounded-tl-xs"
                  }`}
                >
                  {m.isDeleted ? (
                    <p className="italic text-xs opacity-75">🚫 This message was deleted</p>
                  ) : m.type === "IMAGE" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.content}
                      alt="shared"
                      className="rounded-xl max-h-64 w-full object-cover my-1"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{m.content}</p>
                  )}

                  {/* Timestamp & WhatsApp Ticks Alignment */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75">
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMe && !m.isDeleted && (
                      <span className="inline-flex items-center ml-0.5">
                        {m.status === "READ" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-brand-accent" />
                        ) : m.status === "DELIVERED" ? (
                          <CheckCheck className="w-3.5 h-3.5 opacity-70" />
                        ) : (
                          <Check className="w-3.5 h-3.5 opacity-70" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Delete Button */}
                  {isMe && !m.isDeleted && (
                    <button
                      onClick={() => setMessageToDelete(m.id)}
                      className="absolute -left-7 top-2 p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Input Bottom Bar (Disabled if Blocked) */}
      <div className="shrink-0 p-3 border-t border-(--app-border) bg-(--app-surface)">
        {isBlocked ? (
          <div className="text-center py-2 text-xs text-slate-400">Unblock to send messages</div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:text-brand transition"
            >
              {uploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              enterKeyHint="send"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
              onFocus={() => {
                window.scrollTo(0, 0);
                setTimeout(() => {
                  window.scrollTo(0, 0);
                  scrollToBottom("auto");
                }, 120);
              }}
              className="flex-1 px-4 py-2.5 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-2xl text-sm focus:outline-none focus:border-brand"
            />

            <button
              type="submit"
              onMouseDown={(e) => e.preventDefault()} // keeps keyboard open on tap
              disabled={!inputText.trim()}
              className="p-2.5 rounded-2xl bg-brand text-white hover:opacity-90 active:scale-95 transition disabled:opacity-40"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>

      {/* Block Confirmation Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs p-5 rounded-3xl bg-(--app-surface) border border-(--app-border) shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
              <Ban className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base mb-1">Block {currentDisplayName}?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Blocked contacts will no longer be able to send you messages or view your online status.
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setShowBlockModal(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl border border-(--app-border) text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs p-5 rounded-3xl bg-(--app-surface) border border-(--app-border) shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base mb-1">Delete message?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              This message will be deleted for everyone in this chat.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  handleDeleteMessage(messageToDelete);
                  setMessageToDelete(null);
                }}
                className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition active:scale-95"
              >
                Delete for everyone
              </button>
              <button
                onClick={() => setMessageToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-(--app-border) text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
