import type { ReactNode } from "react";
import { Sidebar, type NavItem } from "./Sidebar";
import { Topbar } from "./Topbar";
import { DynamicBackground } from "@/components/ui/dynamic-background";

export function DashboardShell({
  nav,
  navTitle,
  title,
  subtitle,
  children,
}: {
  nav: NavItem[];
  navTitle: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background/40 text-foreground relative">
      {/* Interactive background orbs behind panels */}
      <DynamicBackground />

      <Sidebar items={nav} title={navTitle} />

      <div className="flex flex-1 flex-col overflow-hidden backdrop-blur-[2px]">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6 relative z-10">{children}</main>
      </div>
    </div>
  );
}
