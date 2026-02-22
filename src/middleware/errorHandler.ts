import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Dados invalidos", details: err.flatten().fieldErrors }); return;
  }
  console.error("Erro:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
}
