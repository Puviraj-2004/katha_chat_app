import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { neon } from "@neondatabase/serverless";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 1. Direct-aa Neon DB-la OTP Insert panrom
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO otps (email, otp, expires_at)
      VALUES (${cleanEmail}, ${generatedOtp}, ${expiresAt})
    `;

    // 2. Gmail SMTP vazhiya OTP anuprom (Vercel-la SMTP block aagaathu!)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"katha" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: `Your Katha Login OTP: ${generatedOtp}`,
      html: `
        <div style="font-family: sans-serif; background: #080D1A; color: #FFFFFF; padding: 30px; border-radius: 16px; max-width: 420px; margin: auto;">
          <h1 style="color: #0084FF; margin-bottom: 4px; font-size: 26px;">katha</h1>
          <p style="color: #8EA0C0; font-size: 13px; margin-top: 0;">Instant, ultra-fast messaging</p>
          <hr style="border: 0.5px solid #1B2A4A; margin: 20px 0;" />
          <p style="font-size: 15px;">Your login verification code is:</p>
          <div style="background: #10192D; border: 1px solid #0084FF; padding: 14px; border-radius: 12px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #00D2FF; margin: 20px 0;">
            ${generatedOtp}
          </div>
          <p style="color: #8EA0C0; font-size: 11px;">Valid for 10 minutes only. Do not share this code.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Vercel OTP Error:", error);
    return NextResponse.json({ error: "Failed to send OTP email" }, { status: 500 });
  }
}