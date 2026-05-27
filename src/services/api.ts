import axios from "axios";

/**
 * Centralized API client.
 * Point this at your Node.js + Express + Supabase backend via VITE_API_BASE_URL.
 * Until then, calls fall back to mock data in `src/lib/mock-data.ts`.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auto-mailer-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Typed endpoints (Live Express API) --------------------------------------

import {
  type AdminAccount,
  type SenderAccount,
  type CSVFile,
  type EmailLog,
  type CSVRow,
} from "@/lib/mock-data";

export const PlatformAPI = {
  // GET /super-admin/admins
  listAdmins: async (): Promise<AdminAccount[]> => {
    const res = await api.get("/super-admin/admins");
    return res.data;
  },
  setAdminStatus: async (id: string, status: "active" | "suspended") => {
    const res = await api.patch(`/super-admin/admins/${id}/status`, { status });
    return res.data;
  },
  platformStats: async () => {
    const res = await api.get("/super-admin/stats");
    return res.data;
  },
};

export const AdminAPI = {
  overviewStats: async () => {
    const res = await api.get("/admin/stats");
    return res.data;
  },
  // Senders
  listSenders: async (): Promise<SenderAccount[]> => {
    const res = await api.get("/admin/senders");
    return res.data;
  },
  createSender: async (input: { name: string; email: string; password: string }) => {
    const res = await api.post("/admin/senders", input);
    return res.data;
  },
  deleteSender: async (id: string) => {
    const res = await api.delete(`/admin/senders/${id}`);
    return res.data;
  },
  // CSVs
  listCSVs: async (): Promise<CSVFile[]> => {
    const res = await api.get("/admin/csv");
    return res.data;
  },
  uploadCSV: async (input: { name: string; rows: CSVRow[]; columns: string[] }) => {
    const res = await api.post("/admin/csv", input);
    return res.data;
  },
  /** POST /admin/csv/:id/segment — backend calls Groq to cluster rows */
  segmentCSV: async (csvId: string) => {
    const res = await api.post(`/admin/csv/${csvId}/segment`);
    return res.data;
  },
  assignCSV: async (csvId: string, senderId: string, segmentId?: string) => {
    const res = await api.post(`/admin/csv/${csvId}/assign`, { senderId, segmentId });
    return res.data;
  },
  // Logs
  listEmailLogs: async (filter?: { senderId?: string; from?: string; to?: string }) => {
    const res = await api.get("/admin/logs", { params: filter });
    return res.data;
  },
  // SMTP
  saveSMTP: async (input: { gmail: string; appPassword: string }) => {
    const res = await api.post("/admin/smtp", input);
    return res.data;
  },
};

export const SenderAPI = {
  myAssignedCSVs: async (senderId: string): Promise<CSVFile[]> => {
    const res = await api.get("/sender/assigned");
    return res.data;
  },
  /** POST /ai/generate — backend → Groq */
  aiGenerateEmail: async (brief: string, recipient: CSVRow) => {
    const res = await api.post("/ai/generate", { brief, recipient });
    return res.data;
  },
  /** POST /ai/humanize */
  aiHumanize: async (body: string) => {
    const res = await api.post("/ai/humanize", { body });
    return res.data;
  },
  /** POST /ai/subjects */
  aiSubjects: async (body: string): Promise<string[]> => {
    const res = await api.post("/ai/subjects", { body });
    return res.data;
  },
  /** POST /sender/send — backend uses Nodemailer + admin's Google App Password */
  sendCampaign: async (input: {
    csvId: string;
    segmentId?: string;
    subject: string;
    body: string;
    recipientIds: string[];
  }) => {
    const res = await api.post("/sender/send", input);
    return res.data;
  },
};
