import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/db";
import { sessions } from "../db/schema";
import { eq, and } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    token: string;
  };
}

export const verifyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };

    // Check Single Device Active Session
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, decoded.userId), eq(sessions.token, token), eq(sessions.isActive, true)));

    if (!session) {
      return res.status(401).json({ error: "Session expired or logged in from another device" });
    }

    req.user = { userId: decoded.userId, email: decoded.email, token };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};