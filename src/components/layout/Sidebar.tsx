import { Link, useRouterState } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export function Sidebar({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-gradient-to-b from-sidebar to-sidebar/95 text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border/50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight">Auto Mailer</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:shadow-sm",
              )}
            >
              <item.icon className={cn("h-4 w-4 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
              <span className="relative">
                {item.label}
                {active && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary-foreground/50 rounded-full" />
                )}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">System Online</span>
        </div>
      </div>
    </aside>
  );
}
