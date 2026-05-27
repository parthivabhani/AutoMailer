import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "super_admin" | "admin" | "sender";
    name: string;
    adminId?: string;
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token format." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1. Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token." });
    }

    // 2. Fetch user's profile and role from the database profiles table
    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (dbError || !profile) {
      // Fallback in case profile record doesn't exist yet but user is authenticated
      // We can default to sender role or try to infer it
      return res.status(403).json({ error: "Forbidden: Profile record not found." });
    }

    // 3. Attach authenticated user details to request object
    (req as AuthenticatedRequest).user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      name: profile.name,
      adminId: profile.admin_id
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Internal Server Error during authentication." });
  }
}

export function requireRole(roles: Array<"super_admin" | "admin" | "sender">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: "Unauthorized: Authentication required." });
    }

    if (!roles.includes(authReq.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of roles [${roles.join(", ")}]` });
    }

    next();
  };
}
