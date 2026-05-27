import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/StatCard";
import { AdminAPI } from "@/services/api";
import { Users, FileSpreadsheet, Mail, Clock } from "lucide-react";
import { adminNav } from "@/lib/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof AdminAPI.overviewStats>> | null>(null);
  useEffect(() => { AdminAPI.overviewStats().then(setStats); }, []);

  return (
    <DashboardShell nav={adminNav} navTitle="Admin" title="Overview" subtitle="Your team's outreach at a glance">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Senders" value={stats?.totalSenders ?? "—"} icon={Users} />
        <StatCard label="CSVs uploaded" value={stats?.totalCSVs ?? "—"} icon={FileSpreadsheet} />
        <StatCard label="Emails sent" value={stats?.emailsSent ?? "—"} icon={Mail} />
        <StatCard label="Pending" value={stats?.emailsPending ?? "—"} icon={Clock} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Getting started</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Add sender accounts for your teammates under <span className="text-foreground">Senders</span>.</p>
            <p>2. Upload a leads CSV and run AI Segmentation under <span className="text-foreground">CSV Manager</span>.</p>
            <p>3. Assign segments to senders — they'll compose and send from their own dashboards.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sending source</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>All emails go out via your connected Gmail using a Google App Password.</p>
            <p>Manage credentials under <span className="text-foreground">SMTP Settings</span>.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
