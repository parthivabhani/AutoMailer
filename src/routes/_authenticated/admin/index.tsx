import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/StatCard";
import { StatCardSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { AdminAPI } from "@/services/api";
import {
  Users,
  FileSpreadsheet,
  Mail,
  Clock,
  Zap,
  Settings,
  ArrowRight,
  BarChart3,
  Plus,
  Upload,
  Shield,
} from "lucide-react";
import { adminNav } from "@/lib/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

// Mock analytics trends for Recharts
const mockTrendData = [
  { day: "Mon", sent: 120, pending: 15 },
  { day: "Tue", sent: 240, pending: 30 },
  { day: "Wed", sent: 180, pending: 25 },
  { day: "Thu", sent: 480, pending: 45 },
  { day: "Fri", sent: 390, pending: 20 },
  { day: "Sat", sent: 150, pending: 10 },
  { day: "Sun", sent: 290, pending: 35 },
];

function AdminOverview() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof AdminAPI.overviewStats>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminAPI.overviewStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell
      nav={adminNav}
      navTitle="Admin"
      title="Outreach overview"
      subtitle="Manage your campaign operations and sender queues"
    >
      <FadeIn>
        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
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
                <StatCard
                  label="Senders"
                  value={stats?.totalSenders ?? "—"}
                  icon={Users}
                  hint="Active sender members"
                />
              </SlideIn>
              <SlideIn delay={100}>
                <StatCard
                  label="CSVs uploaded"
                  value={stats?.totalCSVs ?? "—"}
                  icon={FileSpreadsheet}
                  hint="Uploaded contact sheets"
                />
              </SlideIn>
              <SlideIn delay={200}>
                <StatCard
                  label="Emails sent"
                  value={stats?.emailsSent ?? "—"}
                  icon={Mail}
                  hint="Delivered messages"
                  trend="up"
                />
              </SlideIn>
              <SlideIn delay={300}>
                <StatCard
                  label="Pending"
                  value={stats?.emailsPending ?? "—"}
                  icon={Clock}
                  hint="Messages in queue"
                />
              </SlideIn>
            </>
          )}
        </div>

        {/* Charts & Actions Workspace */}
        <div className="grid gap-6 lg:grid-cols-12 mb-6">
          {/* Trend Chart */}
          <SlideIn delay={400} className="lg:col-span-8">
            <Card className="glass-panel border-border/40 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Delivery Activity Trend
                </CardTitle>
                <CardDescription className="text-xs">
                  Outbound marketing delivery volume across active senders
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={mockTrendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="color-mix(in oklch, var(--foreground) 6%, transparent)"
                    />
                    <XAxis
                      dataKey="day"
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "color-mix(in oklch, var(--card) 90%, transparent)",
                        border: "1px solid color-mix(in oklch, var(--foreground) 10%, transparent)",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorSent)"
                      name="Delivered"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Quick Launch Hub */}
          <SlideIn delay={500} className="lg:col-span-4">
            <Card className="glass-panel border-border/40 shadow-xl h-full flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary animate-pulse" /> Launch Hub
                </CardTitle>
                <CardDescription className="text-xs">
                  Action center to manage campaigns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col justify-center">
                <Link to="/admin/csv">
                  <Button
                    className="w-full justify-between hover-float h-10 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                    variant="outline"
                  >
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Upload lead CSV
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link to="/admin/senders">
                  <Button
                    className="w-full justify-between hover-float h-10 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                    variant="outline"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" /> Add team sender
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link to="/admin/smtp">
                  <Button
                    className="w-full justify-between hover-float h-10 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                    variant="outline"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" /> SMTP setup
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </SlideIn>
        </div>

        {/* Guides Workspace */}
        <div className="grid gap-6 md:grid-cols-2">
          <SlideIn delay={600}>
            <Card className="glass-panel border-border/40 shadow-xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Settings className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-bold">SMTP Connection Guide</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3 leading-relaxed">
                <p>
                  Auto Mailer Pro requires a Google App Password to channel outbox messages through
                  Nodemailer. Regular account passwords will be blocked by Google Security.
                </p>
                <p>
                  You can configure or replace linked credentials anytime in the{" "}
                  <Link to="/admin/smtp" className="text-primary font-semibold hover:underline">
                    SMTP Settings
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </SlideIn>

          <SlideIn delay={700}>
            <Card className="glass-panel border-border/40 shadow-xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-bold">Outreach Governance</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3 leading-relaxed">
                <p>
                  Avoid sending multiple emails to the same address. The server enforces strict{" "}
                  <strong>recipient de-duplication</strong> checks before dispatching nodemailer
                  requests.
                </p>
                <p>
                  Check all delivery activities and error message responses under the{" "}
                  <Link to="/admin/logs" className="text-primary font-semibold hover:underline">
                    Email Logs
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
