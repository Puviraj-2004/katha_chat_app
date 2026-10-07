import { Router } from "express";
import { db } from "../config/db";
import { users, contacts, blockedUsers, conversations, messages } from "../db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { verifyAuth, AuthRequest } from "../middlewares/auth";
import { sendInviteEmail } from "../services/mail.service";

const router = Router();

// 1. Get Chat List (Contacts + Active Direct Chats)
router.get("/list", verifyAuth, async (req: AuthRequest, res) => {
  const myId = req.user!.userId;

  // Fetch all conversations where user is participant
  const convos = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.user1Id, myId), eq(conversations.user2Id, myId)))
    .orderBy(desc(conversations.lastMessageAt));

  const chatList = await Promise.all(
    convos.map(async (c) => {
      const partnerId = c.user1Id === myId ? c.user2Id : c.user1Id;
      const [partner] = await db.select().from(users).where(eq(users.id, partnerId));

      // Check if partner is saved in custom contacts
      const [savedContact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.userId, myId), eq(contacts.contactUserId, partnerId)));

      // Fetch latest message
      const [lastMsg] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, c.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        conversationId: c.id,
        partnerId,
        displayName: savedContact ? savedContact.customName : partner?.email,
        email: partner?.email,
        username: partner?.username || "",
        avatarUrl: partner?.avatarUrl,
        lastMessage: lastMsg?.isDeleted ? "🚫 This message was deleted" : lastMsg?.content,
        lastMessageType: lastMsg?.type,
        lastMessageAt: lastMsg?.createdAt || c.lastMessageAt,
        isSaved: !!savedContact, 
      };
    })
  );

  return res.json({ chats: chatList });
});

// 2. Add Contact or Send Invite Email
router.post("/add", verifyAuth, async (req: AuthRequest, res) => {
  const { email, customName } = req.body;
  const myId = req.user!.userId;

  if (!email || !customName) {
    return res.status(400).json({ error: "Email and custom name are required" });
  }

  const [targetUser] = await db.select().from(users).where(eq(users.email, email));

  // If user does not exist -> Send Invite
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

  // Save or Update custom contact alias
  await db
    .insert(contacts)
    .values({ userId: myId, contactUserId: targetUser.id, customName })
    .onConflictDoUpdate({
      target: [contacts.userId, contacts.contactUserId],
      set: { customName },
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

  // TypeScript Strict Guard
  if (!convo) {
    return res.status(500).json({ error: "Failed to initialize conversation" });
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

// Get conversation messages history
router.get("/messages/:conversationId", verifyAuth, async (req: AuthRequest, res) => {
  const conversationId = req.params.conversationId as string; // 👈 Just add "as string"

  if (!conversationId) {
    return res.status(400).json({ error: "Conversation ID is required" });
  }

  const msgList = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  return res.json({ messages: msgList });
});

export default router;