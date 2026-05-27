import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/StatCard";
import { PlatformAPI } from "@/services/api";
import type { AdminAccount } from "@/lib/mock-data";
import { LayoutDashboard, Mail, Users, Building2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
});

const nav = [{ to: "/super-admin", label: "Platform", icon: LayoutDashboard }];

function SuperAdminPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof PlatformAPI.platformStats>> | null>(null);
  const [sortKey, setSortKey] = useState<keyof AdminAccount>("joinedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    PlatformAPI.listAdmins().then(setAdmins);
    PlatformAPI.platformStats().then(setStats);
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
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Total admins" value={stats?.totalAdmins ?? "—"} icon={Building2} />
        <StatCard label="Active admins" value={stats?.activeAdmins ?? stats?.totalAdmins ?? "—"} icon={LayoutDashboard} />
        <StatCard label="Total senders" value={stats?.totalSenders ?? "—"} icon={Users} />
        <StatCard label="Emails sent" value={stats?.emailsSent?.toLocaleString() ?? "—"} icon={Mail} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => sortBy("name")} className="cursor-pointer">Name</TableHead>
                  <TableHead onClick={() => sortBy("email")} className="cursor-pointer">Email</TableHead>
                  <TableHead onClick={() => sortBy("plan")} className="cursor-pointer">Plan</TableHead>
                  <TableHead onClick={() => sortBy("status")} className="cursor-pointer">Status</TableHead>
                  <TableHead onClick={() => sortBy("emailsSent")} className="cursor-pointer text-right">Emails</TableHead>
                  <TableHead onClick={() => sortBy("joinedAt")} className="cursor-pointer">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.email}</TableCell>
                    <TableCell><Badge variant="secondary">{a.plan || "Free"}</Badge></TableCell>
                    <TableCell>
                      <Badge
                        className={a.status === "active" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{(a.emailsSent ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{(a as any).createdAt ? new Date((a as any).createdAt).toLocaleDateString() : (a.joinedAt || "—")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(a)}>
                        {a.status === "active" ? "Suspend" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
