import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth, roleHome } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Sparkles, Zap, BarChart3, Shield, Key, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { DynamicBackground } from "@/components/ui/dynamic-background";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "admin" && !user.smtpConfigured) navigate({ to: "/onboarding" });
    else navigate({ to: roleHome(user.role) as "/admin" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setSubmitting(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name}`);
      if (u.role === "admin" && !u.smtpConfigured) navigate({ to: "/onboarding" });
      else navigate({ to: roleHome(u.role) as "/admin" });
    } catch (err: unknown) {
      let errorMsg = "An unexpected error occurred.";
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      if (err && typeof err === "object" && "response" in err) {
        const response = (err as { response?: { data?: { error?: string } } }).response;
        if (response?.data?.error) {
          errorMsg = response.data.error;
        }
      }
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword("demo");
    toast.success(`Populated preset for: ${presetEmail}`, { duration: 1500 });
  };

  return (
    <div className="relative min-h-screen grid lg:grid-cols-12 bg-background/20 overflow-hidden">
      {/* Dynamic background */}
      <DynamicBackground />

      {/* Left side: Login Panel */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <SlideIn direction="right" className="w-full max-w-md">
          <Card className="glass-panel border-border/40 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-accent to-primary animate-gradient-shift" />
            <CardHeader className="space-y-4 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20">
                <Mail className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Access Campaign Suite
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sign in to launch or coordinate AI-powered marketing outreach.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 glass-input"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label
                      htmlFor="password"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Password
                    </Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 glass-input"
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover-float transition-all duration-300"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Authenticating…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign in <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="pt-4 border-t border-border/30">
                <p className="text-xs font-bold text-center text-muted-foreground uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5">
                  <Key className="h-3 w-3" /> Quick Demo Accounts
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Super Admin",
                      email: "super@demo.io",
                      color: "from-blue-500/10 to-indigo-500/10 hover:border-blue-500/30",
                    },
                    {
                      label: "Admin",
                      email: "admin@demo.io",
                      color: "from-purple-500/10 to-pink-500/10 hover:border-purple-500/30",
                    },
                    {
                      label: "Sender",
                      email: "sender@demo.io",
                      color: "from-green-500/10 to-emerald-500/10 hover:border-green-500/30",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.email}
                      type="button"
                      onClick={() => handleSelectPreset(preset.email)}
                      className={`text-left p-2.5 rounded-xl border border-border/40 bg-gradient-to-br ${preset.color} hover-float transition-all duration-200 cursor-pointer`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {preset.label}
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate font-mono mt-0.5">
                        {preset.email}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      </div>

      {/* Right side: Futuristic UI Graphic */}
      <div className="hidden lg:col-span-6 lg:flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-l border-border/10 p-12 relative overflow-hidden z-10">
        <div className="max-w-md space-y-8 relative z-10">
          <ScaleIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur-md">
              <Sparkles
                className="h-4 w-4 text-primary animate-spin"
                style={{ animationDuration: "4s" }}
              />
              Personalization Engine
            </div>
          </ScaleIn>
          <h2 className="text-4xl font-bold tracking-tight leading-tight text-gradient-shine bg-clip-text text-transparent">
            Automating outreach with ultimate deliverability.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Auto Mailer manages contacts in smart cohorts, formats template variables per recipient
            dynamically, and channels messages through authenticated SMTP lines.
          </p>

          <div className="space-y-4 pt-4">
            {[
              {
                icon: Zap,
                title: "Groq AI Clustering",
                desc: "Clustered groups mapped automatically from custom raw columns",
              },
              {
                icon: Sparkles,
                title: "Tone & Subject humanizer",
                desc: "Crafting optimized headlines and polished body sentences",
              },
              {
                icon: Shield,
                title: "Domain Reputation Protection",
                desc: "Deduplication algorithms keeping your domain off blacklists",
              },
            ].map((f, i) => (
              <SlideIn
                key={i}
                delay={i * 100}
                className="flex gap-4 p-4 rounded-2xl glass-panel hover-float transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shrink-0">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </SlideIn>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
