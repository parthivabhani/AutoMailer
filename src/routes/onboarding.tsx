import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { AdminAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading, update } = useAuth();
  const navigate = useNavigate();
  const [gmail, setGmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (user.role !== "admin") navigate({ to: "/" });
    else if (user.smtpConfigured) navigate({ to: "/admin" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await AdminAPI.saveSMTP({ gmail, appPassword });
      update({ smtpConfigured: true });
      toast.success("SMTP credentials saved");
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Connect your Gmail</CardTitle>
          <p className="text-sm text-muted-foreground">
            Your team will send from this address. Use a{" "}
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Google App Password
            </a>
            , not your account password.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gmail">Gmail address</Label>
              <Input
                id="gmail"
                type="email"
                placeholder="you@gmail.com"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apppwd">Google App Password</Label>
              <Input
                id="apppwd"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Save & continue"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Credentials are sent to the backend over HTTPS and stored encrypted at rest.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
