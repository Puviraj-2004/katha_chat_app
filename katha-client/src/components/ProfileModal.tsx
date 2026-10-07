"use client";

import React, { useState, useRef } from "react";
import { User } from "@/lib/types";
import { api } from "@/lib/api";
import { compressToWebP } from "@/lib/compress";
import { X, Camera, LogOut, Loader2 } from "lucide-react";

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onUpdate: (updated: User) => void;
}

export default function ProfileModal({ user, isOpen, onClose, onLogout, onUpdate }: ProfileModalProps) {
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const webpFile = await compressToWebP(file);
      const { data } = await api.post("/upload/presigned-url", { contentType: "image/webp" });

      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: webpFile,
      });

      setAvatarUrl(data.publicUrl);
    } catch (err) {
      console.error("Avatar upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post("/auth/onboard", { username, avatarUrl });
      onUpdate(res.data.user);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-(--app-surface) border border-(--app-border) shadow-2xl relative">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full hover:bg-white/10 transition">
          <X className="w-4 h-4 text-slate-400" />
        </button>

        <h3 className="font-bold text-lg mb-6">Profile</h3>

        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-brand/20 border-2 border-brand overflow-hidden flex items-center justify-center font-bold text-xl text-brand">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                username.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-brand text-white shadow-md hover:opacity-90 transition"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleAvatarSelect} accept="image/*" className="hidden" />
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Email (Read only)</label>
            <input
              type="text"
              readOnly
              value={user.email}
              className="w-full px-4 py-2 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-xl text-xs text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Display Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-xl text-sm focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Bio / Status</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-2 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-xl text-sm focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 font-semibold text-xs flex items-center gap-1.5 hover:bg-red-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Log out
          </button>
        </div>
      </div>
    </div>
  );
}