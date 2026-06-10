import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import Papa from "papaparse";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminNav } from "@/lib/admin-nav";
import { AdminAPI } from "@/services/api";
import type { CSVFile, SenderAccount } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Upload,
  UserPlus,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";
import { Input } from "@/components/ui/input";

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
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    AdminAPI.listCSVs().then((arr) => {
      setCSVs(arr);
      setActive(arr[0] ?? null);
    });
    AdminAPI.listSenders().then((arr) => {
      if (user) {
        setSenders([
          {
            id: user.id,
            name: `${user.name} (Me/Admin)`,
            email: user.email,
            assignedCsvIds: [],
            emailsSent: 0,
            createdAt: new Date().toISOString(),
          },
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
        if (!cols.length) {
          toast.error("CSV has no headers");
          return;
        }
        const rows = res.data.map((r, i) => ({ _id: `r_${Date.now()}_${i}`, ...r }));
        try {
          const csv = await AdminAPI.uploadCSV({ name: file.name, columns: cols, rows });
          setCSVs((arr) => [csv, ...arr]);
          setActive(csv);
          toast.success(`Uploaded ${file.name} successfully!`);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Failed to upload file.";
          toast.error(errMsg);
        }
      },
      error: (err) => toast.error(err.message),
    });
  };

  const runSegmentation = async () => {
    if (!active) return;
    setSegmenting(true);
    // Add artificial delay for the premium scanning visualization feedback
    const scanDelay = new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const [segs] = await Promise.all([AdminAPI.segmentCSV(active.id), scanDelay]);
      setActive({ ...active, segments: segs });
      setCSVs((arr) => arr.map((c) => (c.id === active.id ? { ...c, segments: segs } : c)));
      toast.success(`AI segmented leads into ${segs.length} distinct groups!`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "AI segmentation failed.";
      toast.error(errMsg);
    } finally {
      setSegmenting(false);
    }
  };

  const assign = async () => {
    if (!active || !assignSender) return;
    const seg = assignSegment === "__all__" ? undefined : assignSegment;
    try {
      await AdminAPI.assignCSV(active.id, assignSender, seg);
      const sender = senders.find((s) => s.id === assignSender);
      toast.success(`Assigned cohort to ${sender?.name} successfully!`);
    } catch (err: unknown) {
      let errorMsg = "Failed to assign list.";
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      if (err && typeof err === "object" && "response" in err) {
        const response = (err as { response?: { data?: { error?: string } } }).response;
        if (response?.data?.error) {
          errorMsg = response.data.error;
        }
      }
      toast.error(errorMsg);
    }
  };

  const filteredCSVs = useMemo(() => {
    return csvs.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [csvs, searchQuery]);

  return (
    <DashboardShell
      nav={adminNav}
      navTitle="Admin"
      title="CSV Manager"
      subtitle="Upload customer lists and assign targeted segments to your team"
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
        {/* Left column: CSV file list */}
        <SlideIn direction="right">
          <Card className="glass-panel border-border/40 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-bold tracking-tight">Database Sheets</CardTitle>
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="text-[10px] font-bold uppercase tracking-wider rounded-lg h-7 px-2 cursor-pointer"
              >
                <Upload className="h-3 w-3 mr-1" /> Upload
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Filter sheets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs glass-input"
                />
              </div>

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {filteredCSVs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActive(c);
                      setAssignSegment("__all__");
                    }}
                    className={`w-full text-left rounded-xl px-3.5 py-3 transition-all duration-200 border cursor-pointer ${
                      active?.id === c.id
                        ? "bg-primary/10 text-primary border-primary/20 shadow-sm font-bold"
                        : "hover:bg-primary/5 text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    <div className="text-xs truncate flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" /> {c.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1 font-semibold">
                      {c.rows.length} rows · {c.segments.length || "No"} cohorts
                    </div>
                  </button>
                ))}
                {!filteredCSVs.length && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No matching sheets found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        {/* Right column: Lead Grid & Segments */}
        {active ? (
          <div className="space-y-6">
            <Card className="glass-panel border-border/40 shadow-xl relative overflow-hidden">
              {/* AI Segmentation Scanning Animation overlay */}
              {segmenting && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-md z-30 flex flex-col items-center justify-center space-y-4">
                  <div className="relative flex h-12 w-12 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/20 opacity-75"></span>
                    <Sparkles
                      className="h-8 w-8 text-primary animate-spin"
                      style={{ animationDuration: "3s" }}
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold uppercase tracking-wider text-primary">
                      AI Parsing Leads Database
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Clustering profiles into optimized marketing segments...
                    </p>
                  </div>
                </div>
              )}

              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border/10 pb-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" /> {active.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {active.rows.length} records parsed · Columns: {active.columns.join(", ")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={runSegmentation}
                  disabled={segmenting}
                  className="h-9 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/30"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary animate-pulse" />
                  AI Segmentation
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {active.segments.length > 0 && (
                  <div className="p-4 bg-primary/5 border-b border-border/10 flex flex-wrap gap-2">
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

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
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
                      {active.rows.slice(0, 50).map((row) => (
                        <TableRow
                          key={row._id}
                          className="hover:bg-primary/5 transition-colors border-b border-border/10"
                        >
                          {active.columns.map((c) => (
                            <TableCell
                              key={c}
                              className="text-xs py-3 max-w-[200px] truncate font-medium"
                            >
                              {row[c]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {active.rows.length > 50 && (
                  <div className="p-3 bg-background/10 text-center text-[10px] text-muted-foreground border-t border-border/10 font-bold">
                    Displaying first 50 of {active.rows.length} rows. Upload larger lists to view
                    segment distributions.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignment Form */}
            <Card className="glass-panel border-border/40 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" /> Assign Database to Sender
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Outreach Sender
                  </Label>
                  <Select value={assignSender} onValueChange={setAssignSender}>
                    <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/40">
                      <SelectValue placeholder="Select team sender" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel rounded-xl">
                      {senders.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Scope/Cohort
                  </Label>
                  <Select value={assignSegment} onValueChange={setAssignSegment}>
                    <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-panel rounded-xl">
                      <SelectItem value="__all__">
                        Entire Spreadsheet ({active.rows.length})
                      </SelectItem>
                      {active.segments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label} ({s.rowIds.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={assign}
                  disabled={!assignSender}
                  className="h-10 px-6 font-bold uppercase tracking-wider rounded-xl hover-float transition-all duration-300 cursor-pointer shadow-lg shadow-primary/20"
                >
                  Assign Database
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <SlideIn delay={100}>
            <Card className="glass-panel border-border/40 shadow-xl py-20 text-center text-muted-foreground">
              <CardContent className="space-y-4">
                <FileSpreadsheet className="h-12 w-12 text-primary/40 mx-auto animate-bounce" />
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                    No Database Sheets Uploaded
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Upload lead sheets as CSV to begin AI segmenting and outreach assignments.
                  </p>
                </div>
                <Button
                  onClick={() => fileRef.current?.click()}
                  className="font-bold uppercase tracking-wider h-10 px-5 rounded-xl cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-1.5" /> Upload CSV Sheet
                </Button>
              </CardContent>
            </Card>
          </SlideIn>
        )}
      </div>
    </DashboardShell>
  );
}
