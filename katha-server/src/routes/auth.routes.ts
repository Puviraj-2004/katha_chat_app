import { Router } from "express";
import { db } from "../config/db";
import { users, otps, sessions } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../services/mail.service";
import { verifyAuth, AuthRequest } from "../middlewares/auth";

import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID || "174842688213-j1ps4jke8l6c19ku7ld1f5r7gr8f4jms.apps.googleusercontent.com"
);

const router = Router();

// 1. Send OTP
router.post("/send-otp", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

  try {
    // Save OTP in Database
    await db.insert(otps).values({ email, otp: generatedOtp, expiresAt });
    console.log(`🔑 OTP generated for ${email}: ${generatedOtp}`);

    // Send Mail
    await sendOtpEmail(email, generatedOtp);
    return res.json({ success: true, message: "OTP sent to your email" });
  } catch (err) {
    console.error("❌ Failed to process OTP:", err);
    return res.status(500).json({ error: "Failed to generate or send OTP" });
  }
});

// 2. Verify OTP & Persistent Login
router.post("/verify-otp", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const otp = req.body.otp?.toString().trim();
  const deviceName = req.body.deviceName;

  console.log(`🔍 Verifying OTP for: [${email}] with code: [${otp}]`);

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  try {
    const [record] = await db
      .select()
      .from(otps)
      .where(eq(otps.email, email))
      .orderBy(desc(otps.createdAt))
      .limit(1);

    console.log("📋 DB Record found:", record);

    if (!record) {
      return res.status(400).json({ error: "No OTP request found for this email. Please request a new one." });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ error: "Incorrect OTP code. Please check your email." });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ error: "OTP has expired. Please request a new OTP." });
    }

    // Find or Create User
    let [user] = await db.select().from(users).where(eq(users.email, email));
    let isNewUser = false;

    if (!user) {
      [user] = await db.insert(users).values({ email }).returning();
      isNewUser = true;
    }

    // Deactivate previous sessions for single-device policy
    await db.update(sessions).set({ isActive: false }).where(eq(sessions.userId, user.id));

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "default_katha_jwt_secret",
      { expiresIn: "365d" }
    );

    await db.insert(sessions).values({
      userId: user.id,
      token,
      deviceName: deviceName || "PWA Device",
      isActive: true,
    });

    console.log(`✅ User authenticated successfully: ${email}`);

    return res.json({
      success: true,
      token,
      user,
      isNewUser: isNewUser || !user.username,
    });
  } catch (err) {
    console.error("❌ Verify OTP database error:", err);
    return res.status(500).json({ error: "Internal server error during verification" });
  }
});

// Google One-Tap / OAuth Login Route
router.post("/google", async (req, res) => {
  const { credential, deviceName } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Google credential token is required" });
  }

  try {
    // 1. Verify Google Token with Google Servers
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || "174842688213-j1ps4jke8l6c19ku7ld1f5r7gr8f4jms.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token payload" });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];
    const picture = payload.picture || null;

    // 2. Find or Create User
    let [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      // New User: Auto-set Name and Profile Avatar from Google!
      [user] = await db
        .insert(users)
        .values({
          email,
          username: name,
          avatarUrl: picture,
        })
        .returning();
    } else if (!user.avatarUrl && picture) {
      // Existing User without avatar -> Auto update with Google Picture
      [user] = await db
        .update(users)
        .set({ avatarUrl: picture })
        .where(eq(users.id, user.id))
        .returning();
    }

    // 3. Deactivate previous sessions (Single Device Enforcement)
    await db.update(sessions).set({ isActive: false }).where(eq(sessions.userId, user.id));

    // 4. Generate Long-lived JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "default_katha_jwt_secret",
      { expiresIn: "365d" }
    );

    await db.insert(sessions).values({
      userId: user.id,
      token,
      deviceName: deviceName || "Google Login Device",
      isActive: true,
    });

    console.log(`⚡ User logged in via Google: ${email}`);

    return res.json({
      success: true,
      token,
      user,
      isNewUser: false, // Profile already complete with Google data
    });
  } catch (err) {
    console.error("❌ Google login verification failed:", err);
    return res.status(401).json({ error: "Google token verification failed" });
  }
});

// 3. Complete Onboarding Profile
router.post("/onboard", verifyAuth, async (req: AuthRequest, res) => {
  const username = req.body.username?.trim();
  const avatarUrl = req.body.avatarUrl;

  if (!username) return res.status(400).json({ error: "Username is required" });

  try {
    const [updated] = await db
      .update(users)
      .set({ username, avatarUrl: avatarUrl || null })
      .where(eq(users.id, req.user!.userId))
      .returning();

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error("❌ Onboard error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;