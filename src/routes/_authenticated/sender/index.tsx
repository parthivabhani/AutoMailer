import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { senderNav } from "@/lib/sender-nav";
import { SenderAPI } from "@/services/api";
import { useAuth } from "@/lib/auth";
import type { CSVFile } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyStateSimple } from "@/components/ui/empty-state";
import { Inbox, FileSpreadsheet, Send, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FadeIn, SlideIn } from "@/components/ui/animated-wrapper";

export const Route = createFileRoute("/_authenticated/sender/")({
  component: SenderHome,
});

function SenderHome() {
  const { user } = useAuth();
  const [csvs, setCsvs] = useState<CSVFile[]>([]);
  const [active, setActive] = useState<CSVFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    SenderAPI.myAssignedCSVs(user.id)
      .then((arr) => {
        setCsvs(arr);
        setActive(arr[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <DashboardShell
      nav={senderNav}
      navTitle="Sender"
      title="Assigned databases"
      subtitle="Client lead sheets assigned to you for campaigns"
    >
      <FadeIn>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
          {/* Left panel: List of assigned sheets */}
          <SlideIn direction="right">
            <Card className="glass-panel border-border/40 shadow-xl">
              <CardHeader className="pb-3 border-b border-border/10 bg-background/10">
                <CardTitle className="text-sm font-bold tracking-tight">Active Datasets</CardTitle>
                <CardDescription className="text-[10px]">
                  Cohorts for custom messaging
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                    ))}
                  </div>
                ) : csvs.length > 0 ? (
                  csvs.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActive(c)}
                      className={`w-full text-left rounded-xl px-3.5 py-3.5 transition-all duration-200 border cursor-pointer ${
                        active?.id === c.id
                          ? "bg-primary/10 text-primary border-primary/20 shadow-sm font-bold"
                          : "hover:bg-primary/5 text-muted-foreground hover:text-foreground border-transparent"
                      }`}
                    >
                      <div className="text-xs truncate flex items-center gap-1.5">
                        <FileSpreadsheet className="h-4 w-4 shrink-0" /> {c.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-1 font-semibold">
                        {c.rows.length} prospects
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyStateSimple
                    icon={Inbox}
                    title="No assignments"
                    description="Your admin hasn't linked any contact spreadsheets yet."
                  />
                )}
              </CardContent>
            </Card>
          </SlideIn>

          {/* Right panel: Data records */}
          {active ? (
            <SlideIn delay={100}>
              <Card className="glass-panel border-border/40 shadow-xl overflow-hidden">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border/10 pb-4">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary animate-pulse" />{" "}
                      {active.name}
                    </CardTitle>
                    {active.segments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {active.segments.map((s) => (
                          <Badge
                            key={s.id}
                            variant="secondary"
                            className="text-[10px] font-bold tracking-wide bg-background/50 border border-border/50"
                          >
                            {s.label} · {s.rowIds.length} leads
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="text-xs font-mono font-bold bg-background/40"
                    >
                      {active.rows.length} Leads total
                    </Badge>
                    <Link to="/sender/compose">
                      <Button
                        size="sm"
                        className="h-9 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover-float transition-all duration-300 shadow-md shadow-primary/20"
                      >
                        Compose Campaign <Send className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-background/10 sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent">
                          {active.columns.map((c) => (
                            <TableHead
                              key={c}
                              className="text-[10px] font-bold uppercase tracking-wider h-10"
                            >
                              {c}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {active.rows.map((r) => (
                          <TableRow
                            key={r._id}
                            className="hover:bg-primary/5 transition-colors border-b border-border/10"
                          >
                            {active.columns.map((c) => (
                              <TableCell
                                key={c}
                                className="text-xs py-3 max-w-[200px] truncate font-medium"
                              >
                                {r[c]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </SlideIn>
          ) : (
            !loading && (
              <Card className="glass-panel border-border/40 shadow-xl py-20 text-center text-muted-foreground">
                <CardContent className="space-y-3">
                  <Inbox className="h-10 w-10 text-primary/30 mx-auto" />
                  <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Waiting for lists
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    When your platform admin assigns leads to your account, they will show up here.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
