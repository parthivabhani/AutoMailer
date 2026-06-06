import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminNav } from "@/lib/admin-nav";
import { AdminAPI } from "@/services/api";
import type { EmailLog, SenderAccount } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: LogsPage,
});

const PAGE = 10;

function LogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [senders, setSenders] = useState<SenderAccount[]>([]);
  const [senderFilter, setSenderFilter] = useState<string>("__all__");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    AdminAPI.listEmailLogs().then(setLogs);
    AdminAPI.listSenders().then(setSenders);
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (senderFilter !== "__all__" && l.senderId !== senderFilter) return false;
      if (from && l.timestamp < new Date(from).toISOString()) return false;
      if (to && l.timestamp > new Date(to + "T23:59:59").toISOString()) return false;
      return true;
    });
  }, [logs, senderFilter, from, to]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice((page - 1) * PAGE, page * PAGE);

  const statusColor = (s: EmailLog["status"]) =>
    s === "sent" ? "bg-success text-success-foreground"
    : s === "failed" ? "bg-destructive text-destructive-foreground"
    : "bg-warning text-warning-foreground";

  return (
    <DashboardShell nav={adminNav} navTitle="Admin" title="Email Logs" subtitle="Every email sent under your account">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 min-w-[200px]">
            <Label className="text-xs">Sender</Label>
            <Select value={senderFilter} onValueChange={(v) => { setSenderFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All senders</SelectItem>
                {senders.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <Button variant="ghost" onClick={() => { setSenderFilter("__all__"); setFrom(""); setTo(""); setPage(1); }}>
            Reset
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Logs ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.recipientName}</TableCell>
                    <TableCell className="text-muted-foreground">{l.recipientEmail}</TableCell>
                    <TableCell>{l.senderName}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{l.subject}</TableCell>
                    <TableCell><Badge className={statusColor(l.status)}>{l.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(l.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {!slice.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No logs match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
