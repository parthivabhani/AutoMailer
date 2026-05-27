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

export const Route = createFileRoute("/_authenticated/sender/")({
  component: SenderHome,
});

function SenderHome() {
  const { user } = useAuth();
  const [csvs, setCsvs] = useState<CSVFile[]>([]);
  const [active, setActive] = useState<CSVFile | null>(null);

  useEffect(() => {
    if (!user) return;
    SenderAPI.myAssignedCSVs(user.id).then((arr) => { setCsvs(arr); setActive(arr[0] ?? null); });
  }, [user]);

  return (
    <DashboardShell nav={senderNav} navTitle="Sender" title="Your assigned lists" subtitle="CSVs assigned to you by your admin">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Assigned CSVs</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {csvs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                  active?.id === c.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.rows.length} recipients</div>
              </button>
            ))}
            {!csvs.length && <p className="text-sm text-muted-foreground">Nothing assigned yet.</p>}
          </CardContent>
        </Card>

        {active && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{active.name}</CardTitle>
              {active.segments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {active.segments.map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-xs">{s.label} · {s.rowIds.length}</Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border border-border rounded-md max-h-[480px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>{active.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.rows.map((r) => (
                      <TableRow key={r._id}>
                        {active.columns.map((c) => <TableCell key={c} className="text-xs">{r[c]}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
