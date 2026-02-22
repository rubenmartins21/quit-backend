import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById((req as any).user.sub).select("-__v");
    if (!user) { res.status(404).json({ error: "Utilizador nao encontrado" }); return; }
    res.status(200).json({ id: user._id.toString(), email: user.email, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
  } catch (err) { next(err); }
});

export default router;
