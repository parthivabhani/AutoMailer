import { Link, useRouterState } from "@tanstack/react-router";
import { Mail, ShieldAlert } from "lucide-react";
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
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/20 bg-card/40 backdrop-blur-xl text-foreground relative z-20">
      {/* Brand logo header */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border/20 bg-background/20">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20">
          <Mail className="h-5 w-5 animate-pulse" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
            Auto Mailer
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
            {title}
          </span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {items.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                active
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground border border-transparent",
              )}
            >
              {/* Left active marker strip */}
              {active && <span className="active-capsule" />}

              <item.icon
                className={cn(
                  "h-4 w-4 transition-all duration-300",
                  active
                    ? "text-primary scale-110"
                    : "text-muted-foreground group-hover:text-foreground group-hover:scale-110",
                )}
              />

              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System status footer */}
      <div className="p-4 border-t border-border/20 bg-background/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10 shadow-inner">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
            System Live
          </span>
        </div>
      </div>
    </aside>
  );
}
