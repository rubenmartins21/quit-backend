import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { OtpCode } from "../models/OtpCode.js";
import { User } from "../models/User.js";
import { Device } from "../models/Device.js";
import {
  generateOtp,
  hashOtp,
  otpExpiresAt,
  MAX_ATTEMPTS,
} from "../utils/otp.js";
import { sendOtpEmail } from "../services/email.service.js";
import { signToken } from "../utils/jwt.js";

const router = Router();

const otpLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MS,
  max: env.OTP_RATE_LIMIT_MAX,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email ?? "").toLowerCase()}`,
  handler: (_req, res) =>
    res.status(429).json({ error: "Demasiados pedidos. Tenta mais tarde." }),
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (_req, res) =>
    res.status(429).json({ error: "Demasiadas tentativas." }),
});

const RequestOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});
const VerifyOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
  deviceId: z.string().uuid(),
  platform: z.enum(["windows", "mac", "linux"]),
});

router.post(
  "/request-otp",
  otpLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = RequestOtpSchema.parse(req.body);
      await OtpCode.deleteMany({ email });
      const otp = generateOtp();
      await OtpCode.create({
        email,
        codeHash: hashOtp(otp),
        expiresAt: otpExpiresAt(),
        attempts: 0,
      });
      await sendOtpEmail(email, otp);
      res.status(200).json({ message: "Codigo enviado." });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/verify-otp",
  verifyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, code, deviceId, platform } = VerifyOtpSchema.parse(
        req.body,
      );
      const otpRecord = await OtpCode.findOne({
        email,
        expiresAt: { $gt: new Date() },
      });
      if (!otpRecord) {
        res.status(400).json({ error: "Codigo invalido ou expirado." });
        return;
      }
      if (otpRecord.attempts >= MAX_ATTEMPTS) {
        await OtpCode.deleteOne({ _id: otpRecord._id });
        res
          .status(400)
          .json({ error: "Demasiadas tentativas. Solicita novo codigo." });
        return;
      }
      await OtpCode.updateOne(
        { _id: otpRecord._id },
        { $inc: { attempts: 1 } },
      );
      if (hashOtp(code) !== otpRecord.codeHash) {
        const remaining = MAX_ATTEMPTS - (otpRecord.attempts + 1);
        res
          .status(400)
          .json({
            error: `Codigo incorreto. ${remaining} tentativa(s) restante(s).`,
          });
        return;
      }
      await OtpCode.deleteOne({ _id: otpRecord._id });
      const user = await User.findOneAndUpdate(
        { email },
        { $set: { lastLoginAt: new Date() }, $setOnInsert: { email } },
        { upsert: true, new: true },
      );
      if (!user) throw new Error("Falha ao criar utilizador");
      await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: { lastSeenAt: new Date() },
          $setOnInsert: { deviceId, userId: user._id, platform },
        },
        { upsert: true, new: true },
      );
      const token = signToken({
        sub: user._id.toString(),
        email: user.email,
        deviceId,
      });
      res
        .status(200)
        .json({ token, user: { id: user._id.toString(), email: user.email } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
