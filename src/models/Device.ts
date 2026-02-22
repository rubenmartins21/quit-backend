import { Schema, model, Document, Types } from "mongoose";
export type Platform = "windows" | "mac" | "linux";

export interface IDevice extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string;
  platform: Platform;
  createdAt: Date;
  lastSeenAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  { userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["windows","mac","linux"], required: true },
    lastSeenAt: { type: Date, default: () => new Date() } },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Device = model<IDevice>("Device", deviceSchema);
