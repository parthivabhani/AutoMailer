import { LayoutDashboard, Users, FileSpreadsheet, ScrollText, Settings } from "lucide-react";
import type { NavItem } from "@/components/layout/Sidebar";

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/senders", label: "Senders", icon: Users },
  { to: "/admin/csv", label: "CSV Manager", icon: FileSpreadsheet },
  { to: "/admin/logs", label: "Email Logs", icon: ScrollText },
  { to: "/admin/smtp", label: "SMTP Settings", icon: Settings },
];
