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

export default function Home() {
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Keep the app shell inside the visual viewport when a mobile keyboard opens.
  // Some Android browsers keep 100dvh at the pre-keyboard height.
  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewportHeight = () => {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
    };

    syncViewportHeight();
    viewport?.addEventListener("resize", syncViewportHeight);
    window.addEventListener("resize", syncViewportHeight);

    return () => {
      viewport?.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("resize", syncViewportHeight);
      document.documentElement.style.removeProperty("--app-viewport-height");
    };
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

  // 👈 MOBILE HARDWARE BACK GESTURE HANDLER (App auto-close prevent pannum)
  useEffect(() => {
    const handlePopState = () => {
      if (showAddContact) {
        setShowAddContact(false);
      } else if (showProfile) {
        setShowProfile(false);
      } else if (activeChat) {
        setActiveChat(null);
        loadChats();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeChat, showAddContact, showProfile, loadChats]);

  // Open Chat with Virtual History Entry
  const handleSelectChat = (chat: ChatListItem) => {
    setActiveChat(chat);
    window.history.pushState({ view: "chat" }, "");
  };

  const handleOpenAddContact = () => {
    setShowAddContact(true);
    window.history.pushState({ view: "modal" }, "");
  };

  const handleOpenProfile = () => {
    setShowProfile(true);
    window.history.pushState({ view: "modal" }, "");
  };

  // Socket Lifecycle
  useEffect(() => {
    if (!currentUser?.id) return;

    const socket = getSocket(currentUser.id);

    const onForceLogout = () => {
      handleLogout();
      alert("You have been logged out because another device logged in.");
    };

    const onChatListUpdated = () => {
      loadChats();
    };

    socket.on("force_logout", onForceLogout);
    socket.on("chat_list_updated", onChatListUpdated);

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
      socket.off("chat_list_updated", onChatListUpdated);
    };
  }, [currentUser?.id, handleLogout, loadChats]);

  if (!mounted) {
    return (
      <main className="h-mobile-screen w-full max-w-md mx-auto flex items-center justify-center bg-(--app-bg)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/katha.svg"
          alt="katha"
          className="w-16 h-16 object-contain animate-pulse drop-shadow-[0_0_20px_rgba(0,132,255,0.4)]"
        />
      </main>
    );
  }

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

  return (
    <main className="h-mobile-screen w-full max-w-md mx-auto relative overflow-hidden bg-(--app-bg) shadow-2xl">
      {activeChat ? (
        <ChatRoom
          chat={activeChat}
          currentUser={currentUser}
          onBack={() => {
            window.history.back(); // Pops state cleanly
          }}
        />
      ) : (
        <ChatList
          chats={chats}
          currentUser={currentUser}
          onSelectChat={handleSelectChat}
          onOpenAddContact={handleOpenAddContact}
          onOpenProfile={handleOpenProfile}
        />
      )}

      <AddContactModal
        isOpen={showAddContact}
        onClose={() => {
          if (window.history.state?.view === "modal") window.history.back();
          else setShowAddContact(false);
        }}
        onSuccess={(newChat) => {
          setShowAddContact(false);
          loadChats();
          if (newChat) {
            handleSelectChat(newChat); 
          }
        }}
      />

      <ProfileModal
        user={currentUser}
        isOpen={showProfile}
        onClose={() => {
          if (window.history.state?.view === "modal") window.history.back();
          else setShowProfile(false);
        }}
        onLogout={handleLogout}
        onUpdate={(updated) => {
          setCurrentUser(updated);
          localStorage.setItem("katha_user", JSON.stringify(updated));
        }}
      />
    </main>
  );
}
