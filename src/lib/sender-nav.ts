import { Inbox, PenSquare } from "lucide-react";
import type { NavItem } from "@/components/layout/Sidebar";

export const senderNav: NavItem[] = [
  { to: "/sender", label: "Assigned CSVs", icon: Inbox },
  { to: "/sender/compose", label: "Compose & Send", icon: PenSquare },
];
