import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

const userSchema = new Schema<IUser>(
  { email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    lastLoginAt: { type: Date, default: null } },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = model<IUser>("User", userSchema);
