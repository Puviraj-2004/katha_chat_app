"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import axios from "axios";
import { User } from "@/lib/types";
import { Loader2, ArrowRight, ShieldCheck, Mail, User as UserIcon } from "lucide-react";
import Image from "next/image"

interface AuthModalProps {
  onSuccess: (token: string, user: User) => void;
}

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<"EMAIL" | "OTP" | "ONBOARD">("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      // 👈 Render backend illama Vercel Next.js direct API-ku call pogum
      await axios.post("/api/send-otp", { email });
      setStep("OTP");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Failed to send OTP");
      } else {
        setError("Network error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-otp", {
        email,
        otp,
        deviceName: navigator.userAgent.includes("Mobile") ? "Mobile PWA" : "Desktop Web",
      });
      const { token, user, isNewUser } = res.data;
      localStorage.setItem("katha_token", token);
      localStorage.setItem("katha_user", JSON.stringify(user));

      if (isNewUser) {
        setStep("ONBOARD");
      } else {
        onSuccess(token, user);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Invalid OTP");
      } else {
        setError("Verification failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/onboard", { username });
      const updatedUser = res.data.user;
      localStorage.setItem("katha_user", JSON.stringify(updatedUser));
      const token = localStorage.getItem("katha_token")!;
      onSuccess(token, updatedUser);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Failed to complete profile");
      } else {
        setError("Error creating profile");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/90 backdrop-blur-md">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-(--app-surface) border border-(--app-border) shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/katha.svg"
            alt="katha logo"
            width={32}
            height={32}
            loading="eager"
            className="w-8 h-8 object-contain drop-shadow-sm"
          />
          <h2 className="text-xl font-bold tracking-tight">katha</h2>
          <p className="text-xs text-slate-400 mt-1">Instant, ultra-fast messaging</p>
        </div>

        {error && (
          <div className="p-3 mb-4 text-xs font-medium text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
            {error}
          </div>
        )}

        {step === "EMAIL" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-2xl text-sm focus:outline-none focus:border-brand transition"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-linear-to-r from-brand to-brand-accent text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {step === "OTP" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Enter 6-digit Code</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-2xl text-base tracking-widest font-mono text-center focus:outline-none focus:border-brand transition"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-brand text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Code"}
            </button>
            <button
              type="button"
              onClick={() => setStep("EMAIL")}
              className="w-full text-xs text-slate-400 hover:text-white transition text-center"
            >
              Change email
            </button>
          </form>
        )}

        {step === "ONBOARD" && (
          <form onSubmit={handleOnboard} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Choose Your Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/10 dark:bg-white/5 border border-(--app-border) rounded-2xl text-sm focus:outline-none focus:border-brand transition"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-brand text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Chatting"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}