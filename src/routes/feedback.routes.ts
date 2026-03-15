/**
 * feedback.routes.ts
 * Localização: src/routes/feedback.routes.ts
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Feedback } from "../models/Feedback.js";

const router = Router();

const FeedbackSchema = z.object({
  type:       z.enum(["bug", "suggestion", "other"]),
  message:    z.string().min(10).max(2000).trim(),
  contact:    z.string().email().optional().nullable(),
  appVersion: z.string().optional().nullable(),
  platform:   z.string().optional().nullable(),
});

// POST /feedback
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = FeedbackSchema.parse(req.body);

    const doc = await Feedback.create({
      type:       data.type,
      message:    data.message,
      contact:    data.contact ?? null,
      appVersion: data.appVersion ?? null,
      platform:   data.platform ?? null,
    });

    console.log(`📬 Feedback [${doc.type}] guardado: ${doc._id}`);

    res.status(201).json({ ok: true, id: doc._id.toString() });
  } catch (err) {
    next(err);
  }
});

export default router;
