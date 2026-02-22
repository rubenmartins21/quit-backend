import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  try {
    const payload = verifyToken(authHeader.slice(7));
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token invalido ou expirado" });
  }
}
