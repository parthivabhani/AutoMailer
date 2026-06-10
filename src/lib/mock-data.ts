export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  plan: "Starter" | "Growth" | "Scale";
  status: "active" | "suspended";
  joinedAt: string;
  emailsSent: number;
  sendersCount: number;
}

export interface SenderAccount {
  id: string;
  name: string;
  email: string;
  assignedCsvIds: string[];
  emailsSent: number;
  createdAt: string;
}

export type CSVRow = { _id: string } & Record<string, string>;

export interface CSVSegment {
  id: string;
  label: string;
  rowIds: string[];
}

export interface CSVFile {
  id: string;
  name: string;
  uploadedAt: string;
  columns: string[];
  rows: CSVRow[];
  segments: CSVSegment[];
  assignedSenderIds: string[];
}

export interface EmailLog {
  id: string;
  recipientName: string;
  recipientEmail: string;
  senderId: string;
  senderName: string;
  subject: string;
  status: "sent" | "failed" | "pending";
  timestamp: string;
}

// ---- Seed data --------------------------------------------------------------

export const mockAdmins: AdminAccount[] = [
  {
    id: "u_admin",
    name: "Acme Marketing",
    email: "admin@demo.io",
    plan: "Growth",
    status: "active",
    joinedAt: "2025-03-12",
    emailsSent: 4218,
    sendersCount: 4,
  },
  {
    id: "a_north",
    name: "Northwind Outreach",
    email: "ops@northwind.io",
    plan: "Scale",
    status: "active",
    joinedAt: "2024-11-02",
    emailsSent: 18904,
    sendersCount: 12,
  },
  {
    id: "a_lumen",
    name: "Lumen Studio",
    email: "hello@lumen.studio",
    plan: "Starter",
    status: "suspended",
    joinedAt: "2025-01-22",
    emailsSent: 312,
    sendersCount: 1,
  },
  {
    id: "a_pixel",
    name: "Pixelforge",
    email: "team@pixelforge.co",
    plan: "Growth",
    status: "active",
    joinedAt: "2024-08-19",
    emailsSent: 7621,
    sendersCount: 6,
  },
];

export const mockSenders: SenderAccount[] = [
  {
    id: "u_sender",
    name: "Jamie Sender",
    email: "sender@demo.io",
    assignedCsvIds: ["csv_seed_1"],
    emailsSent: 320,
    createdAt: "2025-04-01",
  },
  {
    id: "s_rachel",
    name: "Rachel Kim",
    email: "rachel@acme.io",
    assignedCsvIds: ["csv_seed_2"],
    emailsSent: 188,
    createdAt: "2025-04-08",
  },
  {
    id: "s_dmitri",
    name: "Dmitri Volkov",
    email: "dmitri@acme.io",
    assignedCsvIds: [],
    emailsSent: 51,
    createdAt: "2025-05-15",
  },
];

const seedRows1: CSVRow[] = Array.from({ length: 24 }, (_, i) => ({
  _id: `r1_${i}`,
  name: ["Ari Patel", "Jules Chen", "Sam Rivera", "Lin Park"][i % 4] + ` ${i + 1}`,
  email: `lead${i + 1}@prospect.io`,
  company: ["Northgate", "Helix", "Vector", "Quantum"][i % 4],
  industry: ["SaaS", "Fintech", "Healthcare", "E-commerce"][i % 4],
  title: ["Head of Growth", "VP Marketing", "Founder", "Demand Gen Lead"][i % 4],
}));

const seedRows2: CSVRow[] = Array.from({ length: 14 }, (_, i) => ({
  _id: `r2_${i}`,
  name: `Contact ${i + 1}`,
  email: `contact${i + 1}@enterprise.com`,
  company: ["Acme Corp", "Globex", "Initech"][i % 3],
  industry: ["Manufacturing", "Logistics"][i % 2],
}));

export const mockCSVs: CSVFile[] = [
  {
    id: "csv_seed_1",
    name: "q2-warm-leads.csv",
    uploadedAt: "2025-05-04T10:24:00Z",
    columns: ["name", "email", "company", "industry", "title"],
    rows: seedRows1,
    segments: [],
    assignedSenderIds: ["u_sender"],
  },
  {
    id: "csv_seed_2",
    name: "enterprise-targets.csv",
    uploadedAt: "2025-05-18T14:10:00Z",
    columns: ["name", "email", "company", "industry"],
    rows: seedRows2,
    segments: [],
    assignedSenderIds: ["s_rachel"],
  },
];

export const mockEmailLogs: EmailLog[] = Array.from({ length: 38 }, (_, i) => {
  const senders = [
    { id: "u_sender", name: "Jamie Sender" },
    { id: "s_rachel", name: "Rachel Kim" },
    { id: "s_dmitri", name: "Dmitri Volkov" },
  ];
  const s = senders[i % senders.length];
  const status = i % 11 === 0 ? "failed" : i % 7 === 0 ? "pending" : "sent";
  const date = new Date(Date.now() - i * 1000 * 60 * 60 * 6);
  return {
    id: `log_${i}`,
    recipientName: `Lead ${i + 1}`,
    recipientEmail: `lead${i + 1}@prospect.io`,
    senderId: s.id,
    senderName: s.name,
    subject: ["Quick intro", "Following up", "Idea for your team", "Worth 5 minutes?"][i % 4],
    status,
    timestamp: date.toISOString(),
  } satisfies EmailLog;
});

export const mockPlatformStats = () => ({
  totalAdmins: mockAdmins.length,
  activeAdmins: mockAdmins.filter((a) => a.status === "active").length,
  totalSenders: mockSenders.length + 19,
  totalEmailsSent: mockAdmins.reduce((s, a) => s + a.emailsSent, 0),
});

export const mockAdminStats = () => ({
  totalSenders: mockSenders.length,
  totalCSVs: mockCSVs.length,
  emailsSent: mockEmailLogs.filter((l) => l.status === "sent").length,
  emailsPending: mockEmailLogs.filter((l) => l.status === "pending").length,
});
