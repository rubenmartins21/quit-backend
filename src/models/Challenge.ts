import { Schema, model, Document, Types } from "mongoose";

export type ChallengeStatus = "active" | "cancelled" | "completed";

export interface IChallenge extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string;
  durationDays: number;
  reason: string;
  status: ChallengeStatus;
  startedAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, required: true },
    durationDays: { type: Number, required: true, min: 7 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["active", "cancelled", "completed"], default: "active" },
    startedAt: { type: Date, default: () => new Date() },
    endsAt: { type: Date, required: true },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Index to quickly find active challenge for a user
challengeSchema.index({ userId: 1, status: 1 });

export const Challenge = model<IChallenge>("Challenge", challengeSchema);
