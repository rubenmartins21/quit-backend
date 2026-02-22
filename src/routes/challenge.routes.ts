import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Challenge } from "../models/Challenge.js";
import { JwtPayload } from "../utils/jwt.js";

const router = Router();
type AuthRequest = Request & { user: JwtPayload };

const CreateChallengeSchema = z.object({
  durationDays: z.number({ invalid_type_error: "Duração deve ser um número" }).int().min(7, "Mínimo de 7 dias"),
  reason: z.string().min(10, "Escreve pelo menos 10 caracteres").max(500).trim(),
});

const QuitRequestSchema = z.object({
  feeling: z.string().min(5, "Escreve pelo menos 5 caracteres").max(1000).trim(),
});

function computeEndsAt(startedAt: Date, durationDays: number): Date {
  const d = new Date(startedAt);
  d.setDate(d.getDate() + durationDays);
  return d;
}

function formatChallenge(c: InstanceType<typeof Challenge>) {
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - c.startedAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.min(elapsed, c.durationDays);
  const daysRemaining = Math.max(c.durationDays - daysElapsed, 0);

  // Format quit request with time remaining
  let quitRequest = null;
  if (c.quitRequest) {
    const msRemaining = c.quitRequest.unlocksAt.getTime() - now.getTime();
    const hoursRemaining = Math.max(Math.ceil(msRemaining / (1000 * 60 * 60)), 0);
    const minutesRemaining = Math.max(Math.ceil(msRemaining / (1000 * 60)), 0);
    quitRequest = {
      requestedAt: c.quitRequest.requestedAt,
      unlocksAt: c.quitRequest.unlocksAt,
      feeling: c.quitRequest.feeling,
      status: c.quitRequest.status,
      cancelledAt: c.quitRequest.cancelledAt,
      hoursRemaining,
      minutesRemaining,
      isUnlocked: msRemaining <= 0,
    };
  }

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
    quitRequest,
    progress: {
      daysElapsed,
      daysRemaining,
      percentage: Math.round((daysElapsed / c.durationDays) * 100),
    },
  };
}

// POST /challenges
router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub: userId, deviceId } = (req as AuthRequest).user;
    const existing = await Challenge.findOne({ userId, status: "active" });
    if (existing) { res.status(409).json({ error: "Já tens um desafio ativo." }); return; }
    const { durationDays, reason } = CreateChallengeSchema.parse(req.body);
    const startedAt = new Date();
    const challenge = await Challenge.create({
      userId, deviceId, durationDays, reason,
      status: "active", startedAt,
      endsAt: computeEndsAt(startedAt, durationDays),
      quitRequest: null,
    });
    res.status(201).json(formatChallenge(challenge));
  } catch (err) { next(err); }
});

// GET /challenges/active
router.get("/active", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub: userId } = (req as AuthRequest).user;
    const now = new Date();

    // Auto-complete expired challenges
    await Challenge.updateMany(
      { userId, status: "active", endsAt: { $lte: now }, quitRequest: null },
      { $set: { status: "completed", completedAt: now } }
    );

    // Auto-cancel: if quit request unlocked and not cancelled → cancel challenge
    const unlocked = await Challenge.findOne({
      userId, status: "active",
      "quitRequest.status": "pending",
      "quitRequest.unlocksAt": { $lte: now },
    });
    if (unlocked) {
      await Challenge.updateOne(
        { _id: unlocked._id },
        { $set: { status: "cancelled", cancelledAt: now } }
      );
      res.status(200).json({ challenge: null });
      return;
    }

    const challenge = await Challenge.findOne({ userId, status: "active" });
    res.status(200).json({ challenge: challenge ? formatChallenge(challenge) : null });
  } catch (err) { next(err); }
});

// PATCH /challenges/:id/cancel
router.patch("/:id/cancel", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub: userId } = (req as AuthRequest).user;
    const challenge = await Challenge.findOneAndUpdate(
      { _id: req.params.id, userId, status: "active" },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
      { new: true }
    );
    if (!challenge) { res.status(404).json({ error: "Desafio não encontrado." }); return; }
    res.status(200).json(formatChallenge(challenge));
  } catch (err) { next(err); }
});

// POST /challenges/:id/quit-request — inicia pedido de desistência
router.post("/:id/quit-request", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub: userId } = (req as AuthRequest).user;
    const { feeling } = QuitRequestSchema.parse(req.body);

    const challenge = await Challenge.findOne({ _id: req.params.id, userId, status: "active" });
    if (!challenge) { res.status(404).json({ error: "Desafio não encontrado." }); return; }

    // Already has pending quit request
    if (challenge.quitRequest?.status === "pending") {
      res.status(409).json({ error: "Já tens um pedido de desistência pendente." }); return;
    }

    const requestedAt = new Date();
    const unlocksAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000); // +24h

    await Challenge.updateOne(
      { _id: challenge._id },
      { $set: { quitRequest: { requestedAt, unlocksAt, feeling, status: "pending", cancelledAt: null } } }
    );

    const updated = await Challenge.findById(challenge._id);
    res.status(200).json(formatChallenge(updated!));
  } catch (err) { next(err); }
});

// DELETE /challenges/:id/quit-request — cancela pedido de desistência
router.delete("/:id/quit-request", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub: userId } = (req as AuthRequest).user;

    const challenge = await Challenge.findOne({ _id: req.params.id, userId, status: "active", "quitRequest.status": "pending" });
    if (!challenge) { res.status(404).json({ error: "Pedido não encontrado." }); return; }

    await Challenge.updateOne(
      { _id: challenge._id },
      { $set: { "quitRequest.status": "cancelled_by_user", "quitRequest.cancelledAt": new Date() } }
    );

    // Clear the quit request so challenge resumes normally
    await Challenge.updateOne({ _id: challenge._id }, { $set: { quitRequest: null } });

    const updated = await Challenge.findById(challenge._id);
    res.status(200).json(formatChallenge(updated!));
  } catch (err) { next(err); }
});

// GET /challenges — histórico
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub: userId } = (req as AuthRequest).user;
    const challenges = await Challenge.find({ userId }).sort({ createdAt: -1 }).limit(20);
    res.status(200).json({ challenges: challenges.map(formatChallenge) });
  } catch (err) { next(err); }
});

export default router;
