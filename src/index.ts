import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

async function bootstrap() {
  await connectDB();
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"], credentials: true }));
  app.use(express.json({ limit: "16kb" }));
  app.use("/auth", authRoutes);
  app.use("/", userRoutes);
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use((_req, res) => res.status(404).json({ error: "Rota nao encontrada" }));
  app.use(errorHandler);
  app.listen(env.PORT, () => console.log(`Backend em http://localhost:${env.PORT}`));
}

bootstrap();
