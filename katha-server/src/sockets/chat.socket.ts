import { Server, Socket } from "socket.io";
import { db } from "../config/db";
import { messages, conversations, blockedUsers } from "../db/schema";
import { eq, and, or } from "drizzle-orm";

const onlineUsers = new Map<string, string>(); // userId -> socketId

export const setupSocketHandlers = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth?.userId;
    console.log(`🔌 User connected to socket: ${userId}`);

    if (userId) {
      onlineUsers.set(userId, socket.id);
      io.emit("user_presence", { userId, isOnline: true });
    }

    socket.on("check_presence", ({ targetUserId }) => {
      socket.emit("presence_status", {
        userId: targetUserId,
        isOnline: onlineUsers.has(targetUserId),
      });
    });

    socket.on("typing_start", ({ receiverId, conversationId }) => {
      const targetSocket = onlineUsers.get(receiverId);
      if (targetSocket) {
        io.to(targetSocket).emit("user_typing", { conversationId, isTyping: true });
      }
    });

    socket.on("typing_stop", ({ receiverId, conversationId }) => {
      const targetSocket = onlineUsers.get(receiverId);
      if (targetSocket) {
        io.to(targetSocket).emit("user_typing", { conversationId, isTyping: false });
      }
    });

    // Send Message with Auto-Fallback Sender ID
    socket.on("send_message", async (data, ack) => {
      const { conversationId, receiverId, content, type } = data;
      const senderId = data.senderId || userId;

      console.log(`📩 Incoming message from ${senderId} to ${receiverId} in ${conversationId}`);

      if (!conversationId || !senderId || !content) {
        console.error("❌ Missing required fields to save message", data);
        if (ack) ack({ error: "Missing conversationId, senderId, or content" });
        return;
      }

      try {
        // Check if blocked
        const [isBlocked] = await db
          .select()
          .from(blockedUsers)
          .where(
            or(
              and(eq(blockedUsers.blockerId, receiverId), eq(blockedUsers.blockedId, senderId)),
              and(eq(blockedUsers.blockerId, senderId), eq(blockedUsers.blockedId, receiverId))
            )
          );

        if (isBlocked) {
          if (ack) ack({ error: "Unable to send message" });
          return;
        }

        // 1. Insert into Neon DB
        const [newMsg] = await db
          .insert(messages)
          .values({
            conversationId,
            senderId,
            content,
            type: type || "TEXT",
            status: onlineUsers.has(receiverId) ? "DELIVERED" : "SENT",
          })
          .returning();

        console.log(`✅ Message saved to DB with ID: ${newMsg.id}`);

        // 2. Update conversation timestamp
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));

        // 3. Emit to receiver if online
        const targetSocket = onlineUsers.get(receiverId);
        if (targetSocket) {
          io.to(targetSocket).emit("new_message", newMsg);
          io.to(targetSocket).emit("chat_list_updated");
        }

        // Both participants need a fresh chat list so the latest preview,
        // timestamp, ordering, and unread count appear immediately.
        socket.emit("chat_list_updated");

        // 4. Acknowledgment to sender with real DB saved message
        if (ack) ack({ success: true, message: newMsg });
      } catch (err) {
        console.error("❌ DB Insert Failed:", err);
        if (ack) ack({ error: "Failed to save message in database" });
      }
    });

    socket.on("mark_read", async ({ conversationId, senderId }) => {
      try {
        await db
          .update(messages)
          .set({ status: "READ" })
          .where(and(eq(messages.conversationId, conversationId), eq(messages.senderId, senderId)));

        const senderSocket = onlineUsers.get(senderId);
        if (senderSocket) {
          io.to(senderSocket).emit("messages_read", { conversationId });
        }
      } catch (err) {
        console.error("Mark read error:", err);
      }
    });

    socket.on("delete_message", async ({ messageId, conversationId, receiverId }) => {
      try {
        await db
          .update(messages)
          .set({ isDeleted: true, content: "This message was deleted" })
          .where(and(eq(messages.id, messageId), eq(messages.senderId, userId)));

        const targetSocket = onlineUsers.get(receiverId);
        if (targetSocket) {
          io.to(targetSocket).emit("message_deleted", { messageId, conversationId });
        }
        socket.emit("message_deleted", { messageId, conversationId });
      } catch (err) {
        console.error("Delete message error:", err);
      }
    });

    socket.on("disconnect", () => {
      if (userId && onlineUsers.get(userId) === socket.id) {
        onlineUsers.delete(userId);
        io.emit("user_presence", { userId, isOnline: false });
        console.log(`🔌 User disconnected: ${userId}`);
      }
    });
  });
};
