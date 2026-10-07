import { Router } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../config/r2";
import { verifyAuth } from "../middlewares/auth";
import crypto from "crypto";

const router = Router();

router.post("/presigned-url", verifyAuth, async (req, res) => {
  try {
    const { contentType } = req.body; // e.g. "image/webp"
    const fileKey = `uploads/${crypto.randomUUID()}.webp`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: contentType || "image/webp",
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 minutes
    const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileKey}`;

    return res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create upload URL" });
  }
});

export default router;