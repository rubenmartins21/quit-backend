import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import challengeRoutes from "./routes/challenge.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

async function bootstrap() {
  await connectDB();

  const app = express();

  // ─── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS — only allow Electron's custom protocol and localhost (dev) ───────
  const allowedOrigins = [
    "app://quit", // Electron production (custom protocol)
    "http://localhost:5173", // Vite dev server
    "http://localhost:3000",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (desktop apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked: ${origin}`));
        }
      },
      credentials: true,
    }),
  );

  // ─── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false }));

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use("/auth", authRoutes);
  app.use("/", userRoutes);
  app.use("/challenges", challengeRoutes);
  app.use("/feedback", feedbackRoutes);

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV });
  });

  // ─── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: "Rota não encontrada" });
  });

  // ─── Error handler ────────────────────────────────────────────────────────
  app.use(errorHandler);

  app.listen(env.PORT, () => {
    console.log(`\n🚀  Quit backend running on http://localhost:${env.PORT}`);
    console.log(`    ENV: ${env.NODE_ENV}\n`);
  });
}

bootstrap();
