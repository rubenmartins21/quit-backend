import { env } from "../config/env.js";

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  if (env.NODE_ENV === "development") {
    console.log("\n─────────────────────────────────");
    console.log(`OTP para ${email}: ${otp}`);
    console.log("─────────────────────────────────\n");
    return;
  }
  // TODO: Nodemailer SMTP em producao
  throw new Error("SMTP nao configurado em producao");
}
