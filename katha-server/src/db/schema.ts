import { pgTable, uuid, varchar, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// 1. Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }), // Set during onboarding
  avatarUrl: text("avatar_url"),
  bio: text("bio").default("Hey there! I am using Katha"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. OTP Table (Email Verification)
export const otps = pgTable("otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  otp: varchar("otp", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Single Device Sessions Table
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull(),
  deviceName: varchar("device_name", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastActive: timestamp("last_active").defaultNow().notNull(),
});

// 4. Contacts Table (WhatsApp Style)
export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contactUserId: uuid("contact_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  customName: varchar("custom_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userContactIdx: uniqueIndex("user_contact_unique_idx").on(table.userId, table.contactUserId),
}));

// 5. Blocked Users Table
export const blockedUsers = pgTable("blocked_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  blockerId: uuid("blocker_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  blockedId: uuid("blocked_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Direct Conversations Table (1-to-1)
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  user1Id: uuid("user1_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  user2Id: uuid("user2_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 7. Messages Table
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 20 }).default("TEXT").notNull(), // 'TEXT' or 'IMAGE'
  content: text("content").notNull(), // Message string or R2 image URL
  isDeleted: boolean("is_deleted").default(false).notNull(), // "This message was deleted"
  status: varchar("status", { length: 20 }).default("SENT").notNull(), // 'SENT', 'DELIVERED', 'READ'
  isEncrypted: boolean("is_encrypted").default(false).notNull(), // Future-proofing
  createdAt: timestamp("created_at").defaultNow().notNull(),
});