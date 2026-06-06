import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth, roleHome } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Sparkles, Zap, BarChart3 } from "lucide-react";
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
    <div className="grid min-h-screen lg:grid-cols-2 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-border/80 shadow-2xl backdrop-blur-sm">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
              <Mail className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sign in to Auto Mailer to manage your outreach campaigns
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="h-11"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="h-11"
                  placeholder="••••••••"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25" 
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
            
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center mb-3">Demo accounts (password: demo)</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                  super@demo.io
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                  admin@demo.io
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                  sender@demo.io
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background border-l border-border p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-lg space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            AI-Powered Email Outreach
          </div>
          <h2 className="text-4xl font-bold tracking-tight leading-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Transform your outreach with AI-powered email automation
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Personalized by AI, delivered from your Gmail. Scale your outreach without sacrificing quality.
          </p>
          <div className="grid gap-4 pt-4">
            {[
              { icon: Zap, title: "Smart Segmentation", desc: "Segment CSVs intelligently with one click" },
              { icon: Sparkles, title: "AI-Powered Content", desc: "Generate, humanize, and subject-test every send" },
              { icon: BarChart3, title: "Centralized Analytics", desc: "Track performance across every sender in your org" },
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
