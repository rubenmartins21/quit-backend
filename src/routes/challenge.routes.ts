import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Challenge } from "../models/Challenge.js";
import { JwtPayload } from "../utils/jwt.js";

const router = Router();
type AuthRequest = Request & { user: JwtPayload };

// ─── Zod schemas ─────────────────────────────────────────────────────────────
const CreateChallengeSchema = z.object({
  durationDays: z
    .number({ invalid_type_error: "Duração deve ser um número" })
    .int()
    .min(7, "Mínimo de 7 dias"),
  reason: z
    .string()
    .min(10, "Escreve pelo menos 10 caracteres")
    .max(500, "Máximo de 500 caracteres")
    .trim(),
});

// ─── Helper: compute endsAt ──────────────────────────────────────────────────
function computeEndsAt(startedAt: Date, durationDays: number): Date {
  const d = new Date(startedAt);
  d.setDate(d.getDate() + durationDays);
  return d;
}

// ─── Helper: format challenge response ───────────────────────────────────────
function formatChallenge(c: InstanceType<typeof Challenge>) {
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - c.startedAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.min(elapsed, c.durationDays);
  const daysRemaining = Math.max(c.durationDays - daysElapsed, 0);

  return {
    id: c._id.toString(),
    durationDays: c.durationDays,
    reason: c.reason,
    status: c.status,
    startedAt: c.startedAt,
    endsAt: c.endsAt,
    cancelledAt: c.cancelledAt,
    completedAt: c.completedAt,
    createdAt: c.createdAt,
    progress: {
      daysElapsed,
      daysRemaining,
      percentage: Math.round((daysElapsed / c.durationDays) * 100),
    },
  };
}

// ─── POST /challenges — criar novo desafio ────────────────────────────────────
router.post(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sub: userId, deviceId } = (req as AuthRequest).user;

      // Verificar se já tem desafio ativo
      const existing = await Challenge.findOne({ userId, status: "active" });
      if (existing) {
        res.status(409).json({ error: "Já tens um desafio ativo. Cancela-o primeiro." });
        return;
      }

      const { durationDays, reason } = CreateChallengeSchema.parse(req.body);

      const startedAt = new Date();
      const challenge = await Challenge.create({
        userId,
        deviceId,
        durationDays,
        reason,
        status: "active",
        startedAt,
        endsAt: computeEndsAt(startedAt, durationDays),
      });

      res.status(201).json(formatChallenge(challenge));
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /challenges/active — desafio ativo atual ────────────────────────────
router.get(
  "/active",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sub: userId } = (req as AuthRequest).user;

      // Auto-complete: check if any active challenge has passed endsAt
      const now = new Date();
      await Challenge.updateMany(
        { userId, status: "active", endsAt: { $lte: now } },
        { $set: { status: "completed", completedAt: now } }
      );

      const challenge = await Challenge.findOne({ userId, status: "active" });

      if (!challenge) {
        res.status(200).json({ challenge: null });
        return;
      }

      res.status(200).json({ challenge: formatChallenge(challenge) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /challenges/:id/cancel — cancelar desafio ─────────────────────────
router.patch(
  "/:id/cancel",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sub: userId } = (req as AuthRequest).user;
      const { id } = req.params;

      const challenge = await Challenge.findOneAndUpdate(
        { _id: id, userId, status: "active" },
        { $set: { status: "cancelled", cancelledAt: new Date() } },
        { new: true }
      );

      if (!challenge) {
        res.status(404).json({ error: "Desafio não encontrado ou já terminado." });
        return;
      }

      res.status(200).json(formatChallenge(challenge));
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /challenges — histórico ─────────────────────────────────────────────
router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sub: userId } = (req as AuthRequest).user;

      const challenges = await Challenge.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20);

      res.status(200).json({ challenges: challenges.map(formatChallenge) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
