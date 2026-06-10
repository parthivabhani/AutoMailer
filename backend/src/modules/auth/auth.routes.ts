/**
 * auth.routes.ts — Refactored authentication endpoints
 */

import { Router, type Response } from "express";
import { validate } from "../../middleware/requestValidator.js";
import { LoginSchema } from "./auth.schema.js";
import { authService } from "./auth.service.js";
import { sendSuccess, sendError } from "../../shared/response.js";
import type { Request } from "express";

const router = Router();

// POST /auth/login
router.post("/login", validate(LoginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await authService.login(email, password);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(
      res,
      err.statusCode || 400,
      err.code || "LOGIN_ERROR",
      err.message || "Invalid email or password.",
    );
  }
});

// POST /auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(" ")[1] : null;

  try {
    if (token) {
      await authService.logout(token);
    }
    return sendSuccess(res, { message: "Successfully logged out" });
  } catch (err: any) {
    return sendError(res, 500, "LOGOUT_ERROR", "Failed to log out cleanly.");
  }
});

export default router;
