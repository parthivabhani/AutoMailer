import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/services/api";

export type Role = "super_admin" | "admin" | "sender";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Admin: whether SMTP onboarding completed */
  smtpConfigured?: boolean;
  /** Sender: parent admin id */
  adminId?: string;
}

const STORAGE_KEY = "auto-mailer-user";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  update: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("not ready");
  },
  logout: () => {},
  update: () => {},
});

/**
 * Mock credentials — replace with Supabase Auth when backend is wired.
 * super@demo.io / admin@demo.io / sender@demo.io — password: `demo`
 */
const MOCK_USERS: AuthUser[] = [
  { id: "u_super", email: "super@demo.io", name: "Platform Owner", role: "super_admin" },
  { id: "u_admin", email: "admin@demo.io", name: "Acme Marketing", role: "admin", smtpConfigured: false },
  { id: "u_sender", email: "sender@demo.io", name: "Jamie Sender", role: "sender", adminId: "u_admin" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const persist = (u: AuthUser | null) => {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user } = res.data.data || res.data;
    localStorage.setItem("auto-mailer-token", token);
    persist(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem("auto-mailer-token");
    persist(null);
  };

  const update = (patch: Partial<AuthUser>) => {
    if (!user) return;
    persist({ ...user, ...patch });
  };

  return <Ctx.Provider value={{ user, loading, login, logout, update }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function roleHome(role: Role): string {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  return "/sender";
}
