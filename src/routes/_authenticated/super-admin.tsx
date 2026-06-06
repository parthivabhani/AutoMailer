import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/StatCard";
import { StatCardSkeleton } from "@/components/ui/loading-skeleton";
import { PlatformAPI } from "@/services/api";
import type { AdminAccount } from "@/lib/mock-data";
import { LayoutDashboard, Mail, Users, Building2, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FadeIn, SlideIn } from "@/components/ui/animated-wrapper";

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
});

const nav = [{ to: "/super-admin", label: "Platform", icon: LayoutDashboard }];

function SuperAdminPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof PlatformAPI.platformStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof AdminAccount>("joinedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    Promise.all([
      PlatformAPI.listAdmins().then(setAdmins),
      PlatformAPI.platformStats().then(setStats),
    ]).finally(() => setLoading(false));
  }, []);

  const sorted = [...admins].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (av === bv) return 0;
    const c = av > bv ? 1 : -1;
    return sortDir === "asc" ? c : -c;
  });

  const toggleStatus = async (a: AdminAccount) => {
    const next = a.status === "active" ? "suspended" : "active";
    await PlatformAPI.setAdminStatus(a.id, next);
    setAdmins((arr) => arr.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    toast.success(`${a.name} ${next}`);
  };

  const sortBy = (k: keyof AdminAccount) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  return (
    <DashboardShell nav={nav} navTitle="Super Admin" title="Platform overview" subtitle="All admin accounts and platform-level stats">
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
                <StatCard label="Total admins" value={stats?.totalAdmins ?? "—"} icon={Building2} hint="Registered accounts" />
              </SlideIn>
              <SlideIn delay={100}>
                <StatCard label="Active admins" value={stats?.activeAdmins ?? stats?.totalAdmins ?? "—"} icon={LayoutDashboard} hint="Currently active" trend="up" />
              </SlideIn>
              <SlideIn delay={200}>
                <StatCard label="Total senders" value={stats?.totalSenders ?? "—"} icon={Users} hint="Platform-wide" />
              </SlideIn>
              <SlideIn delay={300}>
                <StatCard label="Emails sent" value={stats?.emailsSent?.toLocaleString() ?? "—"} icon={Mail} hint="All time" trend="up" />
              </SlideIn>
            </>
          )}
        </div>

        <SlideIn delay={400}>
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Admin accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead onClick={() => sortBy("name")} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead onClick={() => sortBy("email")} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead onClick={() => sortBy("plan")} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-1">Plan <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead onClick={() => sortBy("status")} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead onClick={() => sortBy("emailsSent")} className="cursor-pointer hover:bg-muted/50 transition-colors text-right">
                          <div className="flex items-center gap-1 justify-end">Emails <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead onClick={() => sortBy("joinedAt")} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-1">Joined <ArrowUpDown className="h-3 w-3" /></div>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((a) => (
                        <TableRow key={a.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-muted-foreground">{a.email}</TableCell>
                          <TableCell><Badge variant="secondary" className="border-primary/20">{a.plan || "Free"}</Badge></TableCell>
                          <TableCell>
                            <Badge
                              className={a.status === "active" 
                                ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" 
                                : "bg-muted text-muted-foreground"
                              }
                            >
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{(a.emailsSent ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">{(a as any).createdAt ? new Date((a as any).createdAt).toLocaleDateString() : (a.joinedAt || "—")}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant={a.status === "active" ? "outline" : "default"} 
                              size="sm" 
                              onClick={() => toggleStatus(a)}
                              className="transition-all duration-200"
                            >
                              {a.status === "active" ? "Suspend" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      </FadeIn>
    </DashboardShell>
  );
}
