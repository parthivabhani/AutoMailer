import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { AdminAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DynamicBackground } from "@/components/ui/dynamic-background";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";
import { Mail, ShieldAlert, Key, ChevronRight, HelpCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading, update } = useAuth();
  const navigate = useNavigate();
  const [gmail, setGmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (user.role !== "admin") navigate({ to: "/" });
    else if (user.smtpConfigured) navigate({ to: "/admin" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!gmail || !appPassword) {
      toast.error("All credentials are required.");
      return;
    }
    setBusy(true);
    try {
      await AdminAPI.saveSMTP({ gmail, appPassword });
      update({ smtpConfigured: true });
      toast.success("SMTP credentials successfully linked!");
      navigate({ to: "/admin" });
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
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background/20 overflow-hidden">
      {/* Canvas Background */}
      <DynamicBackground />

      <ScaleIn className="w-full max-w-xl z-10">
        <Card className="glass-panel border-border/40 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-accent to-primary animate-gradient-shift" />
          <CardHeader className="space-y-4 pb-4">
            <div className="flex justify-between items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20">
                <Mail className="h-6 w-6 animate-pulse" />
              </div>
              <div className="flex gap-2">
                <span
                  className={`h-2.5 w-8 rounded-full transition-colors duration-300 ${step >= 1 ? "bg-primary" : "bg-muted"}`}
                />
                <span
                  className={`h-2.5 w-8 rounded-full transition-colors duration-300 ${step >= 2 ? "bg-primary" : "bg-muted"}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {step === 1 ? "Configure Sending Source" : "Link Gmail App Password"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {step === 1
                  ? "Connect your outbound server connection. Senders will dispatch emails from this address."
                  : "Allow Auto Mailer to channel messages securely through your Google Workspace server."}
              </p>
            </div>
          </CardHeader>

          <CardContent>
            {step === 1 ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning-foreground space-y-2">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">
                    <ShieldAlert className="h-4 w-4" /> Crucial Information
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    To deliver campaigns successfully from Gmail, Google requires an{" "}
                    <strong>App Password</strong>. Your standard password or OAuth will fail to
                    authenticate NodeMailer processes.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="step-gmail"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Gmail address
                    </Label>
                    <Input
                      id="step-gmail"
                      type="email"
                      placeholder="marketing@yourdomain.com"
                      value={gmail}
                      onChange={(e) => setGmail(e.target.value)}
                      className="h-11 glass-input"
                      required
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!gmail || !gmail.includes("@")) {
                      toast.error("Please enter a valid Gmail address first");
                      return;
                    }
                    setStep(2);
                  }}
                  className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/20 hover-float transition-all duration-300"
                >
                  Continue to Credentials <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-primary" /> Setup Steps:
                    </span>
                    <a
                      href="https://support.google.com/accounts/answer/185833"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline flex items-center gap-1.5 hover:text-primary/80 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" /> Instructions guide
                    </a>
                  </div>
                  <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal pl-4">
                    <li>Open Google Account Settings → Security.</li>
                    <li>Enable 2-Step Verification.</li>
                    <li>
                      Search for <strong>App Passwords</strong> and generate one for "Mail".
                    </li>
                    <li>Paste the 16-character code below.</li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Connected Email
                    </Label>
                    <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-sm font-mono font-bold text-muted-foreground">
                      {gmail}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="step-apppwd"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Google App Password
                    </Label>
                    <Input
                      id="step-apppwd"
                      type="password"
                      placeholder="xxxx xxxx xxxx xxxx"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      className="h-11 glass-input font-mono tracking-widest text-center"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 h-11 text-base font-semibold hover:bg-primary/5"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-[2] h-11 text-base font-semibold shadow-lg shadow-primary/20 hover-float transition-all duration-300"
                    disabled={busy}
                  >
                    {busy ? "Activating Server…" : "Save & Complete Setup"}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  SMTP app passwords are fully encrypted using <strong>AES-256-CBC</strong> on our
                  databases, ensuring credentials cannot be read even in data transfer pipelines.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </ScaleIn>
    </div>
  );
}
