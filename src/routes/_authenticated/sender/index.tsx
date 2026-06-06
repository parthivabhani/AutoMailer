import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { senderNav } from "@/lib/sender-nav";
import { SenderAPI } from "@/services/api";
import { useAuth } from "@/lib/auth";
import type { CSVFile } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyStateSimple } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
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
      .then((arr) => { setCsvs(arr); setActive(arr[0] ?? null); })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <DashboardShell nav={senderNav} navTitle="Sender" title="Your assigned lists" subtitle="CSVs assigned to you by your admin">
      <FadeIn>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <SlideIn direction="right">
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Assigned CSVs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-md bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                ) : csvs.length > 0 ? (
                  csvs.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActive(c)}
                      className={`w-full text-left rounded-lg px-4 py-3 text-sm transition-all duration-200 ${
                        active?.id === c.id 
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                          : "hover:bg-muted/50 hover:shadow-sm"
                      }`}
                    >
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs opacity-80">{c.rows.length} recipients</div>
                    </button>
                  ))
                ) : (
                  <EmptyStateSimple
                    icon={Inbox}
                    title="No CSVs assigned"
                    description="Your admin hasn't assigned any contact lists to you yet."
                  />
                )}
              </CardContent>
            </Card>
          </SlideIn>

          {active && (
            <SlideIn delay={100}>
              <Card className="border-primary/20 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{active.name}</CardTitle>
                      {active.segments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {active.segments.map((s) => (
                            <Badge key={s.id} variant="secondary" className="text-xs border-primary/20">
                              {s.label} · {s.rowIds.length}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {active.rows.length} total
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border border-border rounded-lg max-h-[480px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>{active.columns.map((c) => <TableHead key={c} className="text-xs font-semibold">{c}</TableHead>)}</TableRow>
                      </TableHeader>
                      <TableBody>
                        {active.rows.map((r) => (
                          <TableRow key={r._id} className="hover:bg-muted/50 transition-colors">
                            {active.columns.map((c) => <TableCell key={c} className="text-xs">{r[c]}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </SlideIn>
          )}
        </div>
      </FadeIn>
    </DashboardShell>
  );
}
