import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth, roleHome } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@demo.io");
  const [password, setPassword] = useState("demo");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "admin" && !user.smtpConfigured) navigate({ to: "/onboarding" });
    else navigate({ to: roleHome(user.role) as "/admin" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name}`);
      if (u.role === "admin" && !u.smtpConfigured) navigate({ to: "/onboarding" });
      else navigate({ to: roleHome(u.role) as "/admin" });
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-border/80">
          <CardHeader className="space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Mail className="h-4 w-4" />
            </div>
            <CardTitle className="text-xl">Sign in to Auto Mailer</CardTitle>
            <p className="text-sm text-muted-foreground">
              Demo accounts (password <code className="text-foreground">demo</code>):<br />
              <span className="text-foreground">super@demo.io</span> ·{" "}
              <span className="text-foreground">admin@demo.io</span> ·{" "}
              <span className="text-foreground">sender@demo.io</span>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex items-center justify-center bg-sidebar border-l border-sidebar-border p-12">
        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> AI-assisted outreach
          </div>
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Cold email at the speed of your team — personalized by AI, delivered from your Gmail.
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Segment CSVs intelligently with one click</li>
            <li>• Generate, humanize, and subject-test every send</li>
            <li>• Centralized logs across every sender in your org</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
