/**
 * Feedback.ts
 * Localização: src/models/Feedback.ts
 */

import { Schema, model, Document, Types } from "mongoose";

export type FeedbackType = "bug" | "suggestion" | "other";

export interface IFeedback extends Document {
  _id: Types.ObjectId;
  type: FeedbackType;
  message: string;
  contact: string | null;
  appVersion: string | null;
  platform: string | null;
  createdAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    type:       { type: String, enum: ["bug", "suggestion", "other"], required: true },
    message:    { type: String, required: true, trim: true, maxlength: 2000 },
    contact:    { type: String, default: null, trim: true },
    appVersion: { type: String, default: null },
    platform:   { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Feedback = model<IFeedback>("Feedback", feedbackSchema);
