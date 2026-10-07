import { Router } from "express";
import { db } from "../config/db";
import { users, otps, sessions } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../services/mail.service";
import { verifyAuth, AuthRequest } from "../middlewares/auth";

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