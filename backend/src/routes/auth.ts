import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing required fields: email, password." });
  }

  try {
    // 1. Sign in with Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !authData.session || !authData.user) {
      return res.status(400).json({ error: authErr?.message || "Invalid email or password." });
    }

    const token = authData.session.access_token;
    const userId = authData.user.id;

    // 2. Retrieve user profile details from profiles database table
    let { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      // Self-healing: if the trigger is missing or profile doesn't exist, create it cleanly!
      const { data: newProfile, error: createErr } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          name: "User",
          email: authData.user.email || email,
          role: "sender", // Safe default role
        })
        .select()
        .single();

      if (!createErr && newProfile) {
        profile = newProfile;
      } else {
        // Fallback default in-memory response if even database insert fails
        return res.json({
          token,
          user: {
            id: userId,
            email: authData.user.email,
            name: "User",
            role: "sender",
            smtpConfigured: false,
          },
        });
      }
    }

    return res.json({
      token,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        smtpConfigured: profile.smtp_configured,
        adminId: profile.admin_id,
      },
    });
  } catch (err) {
    console.error("Auth login router error:", err);
    return res.status(500).json({ error: "Internal server error during authentication login." });
  }
});

export default router;
