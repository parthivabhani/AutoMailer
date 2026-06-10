import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Moon, Sun, ChevronDown, Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/20 bg-card/30 px-6 backdrop-blur-xl z-20 relative">
      <div className="space-y-0.5">
        <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="h-9 w-9 rounded-xl hover:bg-primary/5 transition-all duration-300 text-muted-foreground hover:text-foreground relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Toggle theme"
          className="h-9 w-9 rounded-xl hover:bg-primary/5 transition-all duration-300 text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-45" />
          ) : (
            <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />
          )}
        </Button>

        <div className="h-4 w-[1px] bg-border/20" />

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 h-10 px-3 rounded-xl hover:bg-primary/5 hover-float transition-all duration-300 border border-transparent hover:border-border/30 bg-background/5"
            >
              <Avatar className="h-7 w-7 bg-gradient-to-br from-primary to-primary/60 border border-primary/20 shadow-sm">
                <AvatarFallback className="text-[10px] font-bold text-primary-foreground">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-bold">{user?.name}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold capitalize">
                  {user?.role?.replace("_", " ")}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 rounded-xl glass-panel p-1.5 shadow-2xl border-border/40 backdrop-blur-2xl"
          >
            <DropdownMenuLabel className="font-normal p-2.5">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold leading-none">{user?.name}</p>
                <p className="text-[10px] leading-none text-muted-foreground font-mono mt-0.5">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/20" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg cursor-pointer p-2 text-xs font-bold flex items-center gap-2"
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
