import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/StatCard";
import { StatCardSkeleton } from "@/components/ui/loading-skeleton";
import { AdminAPI } from "@/services/api";
import { Users, FileSpreadsheet, Mail, Clock, Zap, Settings } from "lucide-react";
import { adminNav } from "@/lib/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn, SlideIn } from "@/components/ui/animated-wrapper";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof AdminAPI.overviewStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    AdminAPI.overviewStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell nav={adminNav} navTitle="Admin" title="Overview" subtitle="Your team's outreach at a glance">
      <FadeIn>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <SlideIn delay={0}>
                <StatCard label="Senders" value={stats?.totalSenders ?? "—"} icon={Users} hint="Active sender accounts" />
              </SlideIn>
              <SlideIn delay={100}>
                <StatCard label="CSVs uploaded" value={stats?.totalCSVs ?? "—"} icon={FileSpreadsheet} hint="Contact lists" />
              </SlideIn>
              <SlideIn delay={200}>
                <StatCard label="Emails sent" value={stats?.emailsSent ?? "—"} icon={Mail} hint="Successfully delivered" trend="up" />
              </SlideIn>
              <SlideIn delay={300}>
                <StatCard label="Pending" value={stats?.emailsPending ?? "—"} icon={Clock} hint="Awaiting delivery" />
              </SlideIn>
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SlideIn delay={400}>
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">Getting started</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  Add sender accounts for your teammates under <span className="text-foreground font-medium">Senders</span>.
                </p>
                <p className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  Upload a leads CSV and run AI Segmentation under <span className="text-foreground font-medium">CSV Manager</span>.
                </p>
                <p className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  Assign segments to senders — they'll compose and send from their own dashboards.
                </p>
              </CardContent>
            </Card>
          </SlideIn>
          <SlideIn delay={500}>
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Settings className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">Sending source</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>All emails go out via your connected Gmail using a Google App Password.</p>
                <p>Manage credentials under <span className="text-foreground font-medium">SMTP Settings</span>.</p>
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
