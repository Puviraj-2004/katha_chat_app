"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import axios from "axios";
import { X, UserPlus, Loader2 } from "lucide-react";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (newChat?: any) => void; 
}

export default function AddContactModal({ isOpen, onClose, onSuccess }: AddContactModalProps) {
  const [email, setEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await api.post("/contacts/add", { email, customName });
      if (res.data.success) {
        setStatusMessage({ type: "success", text: "Contact saved! Opening chat..." });

        const newChat = {
          conversationId: res.data.conversationId,
          partnerId: res.data.targetUser.id,
          displayName: customName.trim(),
          email: res.data.targetUser.email,
          username: res.data.targetUser.username,
          avatarUrl: res.data.targetUser.avatarUrl,
          lastMessage: "",
          isSaved: true,
          unreadCount: 0,
        };

        setTimeout(() => {
          onSuccess(newChat); 
          setEmail("");
          setCustomName("");
          setStatusMessage(null);
        }, 600);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404 && err.response?.data?.invited) {
          setStatusMessage({
            type: "info",
            text: "User is not on Katha. Invitation email has been sent!",
          });
        } else {
          setStatusMessage({
            type: "error",
            text: err.response?.data?.error || "Failed to add contact",
          });
        }
      } else {
        setStatusMessage({ type: "error", text: "An unexpected error occurred" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-(--app-surface) border border-(--app-border) shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">New Contact</h3>
            <p className="text-xs text-slate-400">Save via email like WhatsApp</p>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 mb-4 text-xs font-medium rounded-xl border ${
              statusMessage.type === "success"
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : statusMessage.type === "info"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Email</label>
            <input
              type="email"
              required
              placeholder="friend@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-xl text-sm focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Custom Name (Alias)</label>
            <input
              type="text"
              required
              placeholder="e.g. Arun Office"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-xl text-sm focus:outline-none focus:border-brand"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Contact"}
          </button>
        </form>
      </div>
    </div>
  );
}