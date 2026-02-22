import { Schema, model, Document } from "mongoose";

export interface IOtpCode extends Document {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const otpCodeSchema = new Schema<IOtpCode>(
  { email: { type: String, required: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 } },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const OtpCode = model<IOtpCode>("OtpCode", otpCodeSchema);
