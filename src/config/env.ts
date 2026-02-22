import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("30d"),
  EMAIL_FROM: z.string().default("Quit <no-reply@quit.app>"),
  OTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  OTP_RATE_LIMIT_MAX: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variaveis de ambiente invalidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
