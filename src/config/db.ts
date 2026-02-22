import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB conectado:", mongoose.connection.host);
  } catch (err) {
    console.error("Falha ao conectar MongoDB:", err);
    process.exit(1);
  }
}
