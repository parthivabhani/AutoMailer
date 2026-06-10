import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminNav } from "@/lib/admin-nav";
import { AdminAPI } from "@/services/api";
import type { EmailLog, SenderAccount } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { FadeIn, SlideIn } from "@/components/ui/animated-wrapper";

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

  const getStatusBadge = (s: EmailLog["status"]) => {
    if (s === "sent") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] font-bold uppercase tracking-wide bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" /> Sent
        </Badge>
      );
    }
    if (s === "failed") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] font-bold uppercase tracking-wide bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse mr-1.5" /> Failed
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5" /> Pending
      </Badge>
    );
  };

  return (
    <DashboardShell
      nav={adminNav}
      navTitle="Admin"
      title="Outbound logs"
      subtitle="Audit records of email transmissions and delivery reports"
    >
      <FadeIn className="space-y-6">
        {/* Filters Panel */}
        <Card className="glass-panel border-border/40 shadow-xl">
          <CardHeader className="pb-3 border-b border-border/10 bg-background/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter Delivery Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end pt-4">
            <div className="space-y-1.5 min-w-[200px] flex-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Team Sender
              </Label>
              <Select
                value={senderFilter}
                onValueChange={(v) => {
                  setSenderFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  <SelectItem value="__all__ font-semibold">All sender members</SelectItem>
                  {senders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery from
              </Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="h-10 glass-input px-3"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery to
              </Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="h-10 glass-input px-3"
              />
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setSenderFilter("__all__");
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className="h-10 font-bold uppercase tracking-wider rounded-xl hover:bg-primary/5 cursor-pointer text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Filters
            </Button>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="glass-panel border-border/40 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/10 bg-background/10 pb-4">
            <CardTitle className="text-sm font-bold">
              Email Transmissions ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-background/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider h-11 pl-6">
                      Recipient Name
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider h-11">
                      Email address
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider h-11">
                      Sender Profile
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider h-11">
                      Subject Header
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider h-11">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider h-11 pr-6">
                      Timestamp
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slice.map((l) => (
                    <TableRow
                      key={l.id}
                      className="hover:bg-primary/5 transition-colors border-b border-border/10"
                    >
                      <TableCell className="font-bold py-3.5 pl-6 text-sm">
                        {l.recipientName}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {l.recipientEmail}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{l.senderName}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs font-medium">
                        {l.subject}
                      </TableCell>
                      <TableCell>{getStatusBadge(l.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs pr-6">
                        {new Date(l.timestamp).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!slice.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-12 text-sm text-muted-foreground"
                      >
                        No delivery logs recorded for selected constraints.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border/10 bg-background/10">
                <p className="text-xs text-muted-foreground font-semibold">
                  Page {page} of {pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg h-8 px-3 cursor-pointer hover:bg-primary/5"
                  >
                    <ChevronLeft className="h-4 w-4 mr-0.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg h-8 px-3 cursor-pointer hover:bg-primary/5"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-0.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </DashboardShell>
  );
}
