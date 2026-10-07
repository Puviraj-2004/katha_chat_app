import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: `"katha" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Your Katha Login OTP: ${otp}`,
    html: `
      <div style="font-family: sans-serif; background: #080D1A; color: #FFFFFF; padding: 30px; border-radius: 12px; max-width: 450px; margin: auto;">
        <h1 style="color: #0084FF; margin-bottom: 8px;">katha</h1>
        <p style="color: #8EA0C0; font-size: 14px;">Instant, ultra-fast messaging.</p>
        <hr style="border: 0.5px solid #1B2A4A; margin: 20px 0;" />
        <p style="font-size: 16px;">Your One-Time Password (OTP) for login is:</p>
        <div style="background: #10192D; border: 1px solid #0084FF; padding: 15px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #00D2FF; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #8EA0C0; font-size: 12px;">Valid for 5 minutes only. Do not share this OTP with anyone.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

export const sendInviteEmail = async (toEmail: string, inviterName: string) => {
  const mailOptions = {
    from: `"katha" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `${inviterName} invited you to Katha!`,
    html: `
      <div style="font-family: sans-serif; background: #080D1A; color: #FFFFFF; padding: 30px; border-radius: 12px; max-width: 450px; margin: auto;">
        <h1 style="color: #0084FF;">katha</h1>
        <p style="font-size: 16px;"><strong>${inviterName}</strong> wants to connect with you on Katha!</p>
        <p style="color: #8EA0C0; font-size: 14px;">Join now for lightning-fast real-time messaging.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};