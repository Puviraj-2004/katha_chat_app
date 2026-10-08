import { Router } from "express";
import { db } from "../config/db";
import { users, contacts, blockedUsers, conversations, messages } from "../db/schema";
import { eq, and, or, desc, ne } from "drizzle-orm";
import { verifyAuth, AuthRequest } from "../middlewares/auth";
import { sendInviteEmail } from "../services/mail.service";

const router = Router();

// 1. Get Chat List (Ghost Chat Filtered + Unread Count)
router.get("/list", verifyAuth, async (req: AuthRequest, res) => {
  const myId = req.user!.userId;

  const convos = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.user1Id, myId), eq(conversations.user2Id, myId)))
    .orderBy(desc(conversations.lastMessageAt));

  const chatList = (
    await Promise.all(
      convos.map(async (c) => {
        // Fetch latest message
        const [lastMsg] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, c.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        // GHOST CHAT FIX: Message ethuvume anupalana chat list-la kaata koodadhu!
        if (!lastMsg) return null;

        // Fetch Unread Messages Count
        const unreadList = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, c.id),
              ne(messages.senderId, myId),
              ne(messages.status, "READ")
            )
          );

        const partnerId = c.user1Id === myId ? c.user2Id : c.user1Id;
        const [partner] = await db.select().from(users).where(eq(users.id, partnerId));

        const [savedContact] = await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.userId, myId), eq(contacts.contactUserId, partnerId)));

        return {
          conversationId: c.id,
          partnerId,
          displayName: savedContact ? savedContact.customName : partner?.email,
          email: partner?.email,
          username: partner?.username || "",
          avatarUrl: partner?.avatarUrl,
          lastMessage: lastMsg.isDeleted ? "🚫 This message was deleted" : lastMsg.content,
          lastMessageType: lastMsg.type,
          lastMessageAt: lastMsg.createdAt || c.lastMessageAt,
          isSaved: !!savedContact,
          unreadCount: unreadList.length,
        };
      })
    )
  ).filter(Boolean);

  return res.json({ chats: chatList });
});

// 2. Add Contact or Send Invite Email
router.post("/add", verifyAuth, async (req: AuthRequest, res) => {
  const { email, customName } = req.body;
  const myId = req.user!.userId;

  if (!email || !customName) {
    return res.status(400).json({ error: "Email and custom name are required" });
  }

  const [targetUser] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));

  if (!targetUser) {
    const [me] = await db.select().from(users).where(eq(users.id, myId));
    await sendInviteEmail(email, me?.username || me?.email || "A friend");
    return res.status(404).json({
      invited: true,
      message: "This email is not registered on Katha. An invite has been sent!",
    });
  }

  if (targetUser.id === myId) {
    return res.status(400).json({ error: "You cannot add yourself" });
  }

  // Save alias in contacts table
  await db
    .insert(contacts)
    .values({ userId: myId, contactUserId: targetUser.id, customName: customName.trim() })
    .onConflictDoUpdate({
      target: [contacts.userId, contacts.contactUserId],
      set: { customName: customName.trim() },
    });

  // Ensure Conversation exists
  let [convo] = await db
    .select()
    .from(conversations)
    .where(
      or(
        and(eq(conversations.user1Id, myId), eq(conversations.user2Id, targetUser.id)),
        and(eq(conversations.user1Id, targetUser.id), eq(conversations.user2Id, myId))
      )
    );

  if (!convo) {
    [convo] = await db
      .insert(conversations)
      .values({ user1Id: myId, user2Id: targetUser.id })
      .returning();
  }

  return res.json({ success: true, conversationId: convo.id, targetUser });
});

// 3. Block User
router.post("/block", verifyAuth, async (req: AuthRequest, res) => {
  const { targetUserId } = req.body;
  const myId = req.user!.userId;

  await db.insert(blockedUsers).values({ blockerId: myId, blockedId: targetUserId });
  return res.json({ success: true, message: "User blocked" });
});

// 4. Get Conversation Messages History & Auto Mark as READ
router.get("/messages/:conversationId", verifyAuth, async (req: AuthRequest, res) => {
  const conversationId = req.params.conversationId as string;
  const myId = req.user!.userId;

  if (!conversationId) {
    return res.status(400).json({ error: "Conversation ID is required" });
  }

  // 1. Fetch message history
  const msgList = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // 2. 👈 AUTO MARK AS READ in Database for all partner's messages
  await db
    .update(messages)
    .set({ status: "READ" })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, myId),
        ne(messages.status, "READ")
      )
    );

  return res.json({ messages: msgList });
});

export default router;