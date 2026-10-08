"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import axios from "axios";
import { User } from "@/lib/types";
import { Loader2, ArrowRight, ShieldCheck, Mail, User as UserIcon } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

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

  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "174842688213-j1ps4jke8l6c19ku7ld1f5r7gr8f4jms.apps.googleusercontent.com";

  // Google Login Success Handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) return;
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/google", {
        credential: credentialResponse.credential,
        deviceName: navigator.userAgent.includes("Mobile") ? "Mobile PWA" : "Desktop Web",
      });

      const { token, user } = res.data;
      localStorage.setItem("katha_token", token);
      localStorage.setItem("katha_user", JSON.stringify(user));
      onSuccess(token, user);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Google sign in failed");
      } else {
        setError("Network error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
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
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/90 backdrop-blur-md">
        <div className="w-full max-w-sm p-6 rounded-3xl bg-(--app-surface) border border-(--app-border) shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/katha.svg"
              alt="katha"
              loading="eager"
              className="w-16 h-16 object-contain mb-3 drop-shadow-[0_4px_16px_rgba(0,132,255,0.3)]"
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
            <div className="space-y-4">
              {/* 1-Tap Google Login Button */}
              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google login was cancelled or failed")}
                  theme="filled_blue"
                  shape="pill"
                  size="large"
                  text="continue_with"
                  width="320"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-(--app-border)" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">or email otp</span>
                <div className="flex-1 h-px bg-(--app-border)" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue with OTP <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </div>
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
    </GoogleOAuthProvider>
  );
}