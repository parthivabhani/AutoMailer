import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, roleHome } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/landing" });
    else if (user.role === "admin" && !user.smtpConfigured) navigate({ to: "/onboarding" });
    else navigate({ to: roleHome(user.role) as "/admin" });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Loading Auto Mailer…</div>
    </div>
  );
}
