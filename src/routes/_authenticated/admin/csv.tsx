import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminNav } from "@/lib/admin-nav";
import { AdminAPI } from "@/services/api";
import type { CSVFile, SenderAccount } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Upload, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/csv")({
  component: CSVPage,
});

function CSVPage() {
  const { user } = useAuth();
  const [csvs, setCSVs] = useState<CSVFile[]>([]);
  const [senders, setSenders] = useState<SenderAccount[]>([]);
  const [active, setActive] = useState<CSVFile | null>(null);
  const [segmenting, setSegmenting] = useState(false);
  const [assignSender, setAssignSender] = useState<string>("");
  const [assignSegment, setAssignSegment] = useState<string>("__all__");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    AdminAPI.listCSVs().then((arr) => { setCSVs(arr); setActive(arr[0] ?? null); });
    AdminAPI.listSenders().then((arr) => {
      if (user) {
        setSenders([
          { id: user.id, name: `${user.name} (Me/Admin)`, email: user.email } as any,
          ...arr,
        ]);
      } else {
        setSenders(arr);
      }
    });
  }, [user]);

  const onUpload = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const cols = res.meta.fields ?? [];
        if (!cols.length) { toast.error("CSV has no headers"); return; }
        const rows = res.data.map((r, i) => ({ _id: `r_${Date.now()}_${i}`, ...r }));
        const csv = await AdminAPI.uploadCSV({ name: file.name, columns: cols, rows });
        setCSVs((arr) => [csv, ...arr]);
        setActive(csv);
        toast.success(`Uploaded ${file.name} (${rows.length} rows)`);
      },
      error: (err) => toast.error(err.message),
    });
  };

  const runSegmentation = async () => {
    if (!active) return;
    setSegmenting(true);
    try {
      const segs = await AdminAPI.segmentCSV(active.id);
      setActive({ ...active, segments: segs });
      setCSVs((arr) => arr.map((c) => (c.id === active.id ? { ...c, segments: segs } : c)));
      toast.success(`AI segmented into ${segs.length} groups`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSegmenting(false); }
  };

  const assign = async () => {
    if (!active || !assignSender) return;
    const seg = assignSegment === "__all__" ? undefined : assignSegment;
    try {
      await AdminAPI.assignCSV(active.id, assignSender, seg);
      const sender = senders.find((s) => s.id === assignSender);
      toast.success(`Assigned ${seg ? "segment" : "full CSV"} to ${sender?.name}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Failed to assign list.");
    }
  };

  return (
    <DashboardShell nav={adminNav} navTitle="Admin" title="CSV Manager" subtitle="Upload, segment with AI, and assign to senders">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">CSVs</CardTitle>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
            </Button>
            <input
              ref={fileRef} type="file" accept=".csv" hidden
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </CardHeader>
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
                <div className="text-xs text-muted-foreground">{c.rows.length} rows · {c.assignedSenderIds.length} assigned</div>
              </button>
            ))}
            {!csvs.length && <p className="text-sm text-muted-foreground">No CSVs yet. Upload your first list.</p>}
          </CardContent>
        </Card>

        {active ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{active.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {active.rows.length} rows · columns: {active.columns.join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={runSegmentation} disabled={segmenting}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {segmenting ? "Segmenting…" : "AI Segmentation"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {active.segments.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {active.segments.map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-xs">
                        {s.label} · {s.rowIds.length}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="overflow-x-auto border border-border rounded-md max-h-[420px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        {active.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {active.rows.slice(0, 50).map((row) => (
                        <TableRow key={row._id}>
                          {active.columns.map((c) => (
                            <TableCell key={c} className="text-xs">{row[c]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {active.rows.length > 50 && (
                  <p className="text-xs text-muted-foreground mt-2">Showing first 50 of {active.rows.length} rows.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Assign to sender</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">Sender</label>
                  <Select value={assignSender} onValueChange={setAssignSender}>
                    <SelectTrigger><SelectValue placeholder="Choose sender" /></SelectTrigger>
                    <SelectContent>
                      {senders.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">Scope</label>
                  <Select value={assignSegment} onValueChange={setAssignSegment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Full CSV</SelectItem>
                      {active.segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} ({s.rowIds.length})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={assign} disabled={!assignSender}>Assign</Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Upload a CSV to get started.</CardContent></Card>
        )}
      </div>
    </DashboardShell>
  );
}
