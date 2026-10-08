export interface User {
  id: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface ChatListItem {
  conversationId: string;
  partnerId: string;
  displayName: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageType?: "TEXT" | "IMAGE";
  lastMessageAt?: string;
  isSaved?: boolean; 
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "TEXT" | "IMAGE";
  isDeleted: boolean;
  status: "SENT" | "DELIVERED" | "READ";
  createdAt: string;
}