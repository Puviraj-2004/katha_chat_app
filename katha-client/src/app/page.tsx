"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, ChatListItem } from "@/lib/types";
import { api } from "@/lib/api";
import { getSocket, disconnectSocket } from "@/lib/socket";
import AuthModal from "@/components/AuthModal";
import ChatList from "@/components/ChatList";
import ChatRoom from "@/components/ChatRoom";
import ProfileModal from "@/components/ProfileModal";
import AddContactModal from "@/components/AddContactModal";
import Image from "next/image";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Lazy load tokens synchronously from client storage
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("katha_token");
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("katha_user");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatListItem | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Safe client hydration mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadChats = useCallback(() => {
    api
      .get("/contacts/list")
      .then((res) => {
        setChats(res.data.chats || []);
      })
      .catch((err) => {
        console.error("Failed to load chat list", err);
      });
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("katha_token");
    localStorage.removeItem("katha_user");
    disconnectSocket();
    setToken(null);
    setCurrentUser(null);
    setActiveChat(null);
    setShowProfile(false);
  }, []);

  // Socket Lifecycle & Initial Chat Fetch
  useEffect(() => {
    if (!currentUser?.id) return;

    const socket = getSocket(currentUser.id);

    const onForceLogout = () => {
      handleLogout();
      alert("You have been logged out because another device logged in.");
    };

    socket.on("force_logout", onForceLogout);

    let isSubscribed = true;
    api
      .get("/contacts/list")
      .then((res) => {
        if (isSubscribed) {
          setChats(res.data.chats || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load chats", err);
      });

    return () => {
      isSubscribed = false;
      socket.off("force_logout", onForceLogout);
    };
  }, [currentUser?.id, handleLogout]);

  // 1. Initial Match for Server & Client (Prevents Hydration Mismatch)
if (!mounted) {
    return (
      <main className="h-mobile-screen w-full max-w-md mx-auto flex items-center justify-center bg-(--app-bg)">
      <Image
        src="/katha.svg"
        alt="katha logo"
        width={32}
        height={32}
        loading="eager"
        className="w-8 h-8 object-contain drop-shadow-sm"
      />
      </main>
    );
  }

  // 2. Auth Gate
  if (!token || !currentUser) {
    return (
      <AuthModal
        onSuccess={(newToken, user) => {
          setToken(newToken);
          setCurrentUser(user);
        }}
      />
    );
  }

  // 3. Main App UI
  return (
    <main className="h-mobile-screen w-full max-w-md mx-auto relative overflow-hidden bg-(--app-bg) shadow-2xl">
      {activeChat ? (
        <ChatRoom
          chat={activeChat}
          currentUser={currentUser}
          onBack={() => {
            setActiveChat(null);
            loadChats();
          }}
        />
      ) : (
        <ChatList
          chats={chats}
          onSelectChat={(chat) => setActiveChat(chat)}
          onOpenAddContact={() => setShowAddContact(true)}
          onOpenProfile={() => setShowProfile(true)}
        />
      )}

      <AddContactModal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        onSuccess={loadChats}
      />

      <ProfileModal
        user={currentUser}
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        onLogout={handleLogout}
        onUpdate={(updated) => {
          setCurrentUser(updated);
          localStorage.setItem("katha_user", JSON.stringify(updated));
        }}
      />
    </main>
  );
}