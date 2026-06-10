import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminNav } from "@/lib/admin-nav";
import { AdminAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/smtp")({
  component: SMTPPage,
});

function SMTPPage() {
  const { user, update } = useAuth();
  const [gmail, setGmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await AdminAPI.saveSMTP({ gmail, appPassword });
      update({ smtpConfigured: true });
      toast.success("SMTP credentials updated");
      setAppPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell
      nav={adminNav}
      navTitle="Admin"
      title="SMTP Settings"
      subtitle="Manage your Gmail sending credentials"
    >
      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {user?.smtpConfigured ? (
              <p className="text-success">✓ SMTP credentials are configured.</p>
            ) : (
              <p className="text-warning">⚠ SMTP not configured yet. Add credentials below.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gmail + App Password</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Use a Google App Password — not your regular Gmail password. Credentials are sent over
              HTTPS and stored encrypted on the backend.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="g">Gmail address</Label>
                <Input
                  id="g"
                  type="email"
                  placeholder="you@gmail.com"
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap">App Password</Label>
                <Input
                  id="ap"
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save credentials"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
