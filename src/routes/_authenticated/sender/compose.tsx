import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { senderNav } from "@/lib/sender-nav";
import { SenderAPI } from "@/services/api";
import { useAuth } from "@/lib/auth";
import type { CSVFile } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Wand2, Type, Send, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sender/compose")({
  component: ComposePage,
});

function ComposePage() {
  const { user } = useAuth();
  const [csvs, setCsvs] = useState<CSVFile[]>([]);
  const [csvId, setCsvId] = useState<string>("");
  const [segmentId, setSegmentId] = useState<string>("__all__");
  const [brief, setBrief] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [subjectIdeas, setSubjectIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState<"gen" | "human" | "subj" | "send" | null>(null);
  const [preview, setPreview] = useState(false);
  const [dupes, setDupes] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    SenderAPI.myAssignedCSVs(user.id).then((arr) => { setCsvs(arr); setCsvId(arr[0]?.id ?? ""); });
  }, [user]);

  const csv = useMemo(() => csvs.find((c) => c.id === csvId), [csvs, csvId]);
  const recipients = useMemo(() => {
    if (!csv) return [];
    if (segmentId === "__all__") return csv.rows;
    const seg = csv.segments.find((s) => s.id === segmentId);
    if (!seg) return csv.rows;
    return csv.rows.filter((r) => seg.rowIds.includes(r._id));
  }, [csv, segmentId]);

  const generate = async () => {
    if (!csv || !brief.trim() || !recipients[0]) { toast.error("Pick a CSV and write a brief"); return; }
    setBusy("gen");
    try {
      const out = await SenderAPI.aiGenerateEmail(brief, recipients[0]);
      setBody(out);
      toast.success("AI draft ready");
    } finally { setBusy(null); }
  };

  const humanize = async () => {
    if (!body.trim()) return;
    setBusy("human");
    try { setBody(await SenderAPI.aiHumanize(body)); toast.success("Humanized"); }
    finally { setBusy(null); }
  };

  const suggestSubjects = async () => {
    if (!body.trim()) { toast.error("Write a body first"); return; }
    setBusy("subj");
    try { setSubjectIdeas(await SenderAPI.aiSubjects(body)); }
    finally { setBusy(null); }
  };

  const send = async () => {
    if (!csv || !subject.trim() || !body.trim() || !recipients.length) {
      toast.error("Add subject, body, and pick recipients");
      return;
    }
    setBusy("send");
    try {
      const res = await SenderAPI.sendCampaign({
        csvId: csv.id,
        segmentId: segmentId === "__all__" ? undefined : segmentId,
        subject, body,
        recipientIds: recipients.map((r) => r._id),
      });
      setDupes(res.skippedDuplicates);
      toast.success(`Sent to ${res.sent} recipients`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  return (
    <DashboardShell nav={senderNav} navTitle="Sender" title="Compose & Send" subtitle="AI-assisted personalized outreach">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Audience</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">CSV</Label>
                <Select value={csvId} onValueChange={(v) => { setCsvId(v); setSegmentId("__all__"); }}>
                  <SelectTrigger><SelectValue placeholder="Choose CSV" /></SelectTrigger>
                  <SelectContent>
                    {csvs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segment</Label>
                <Select value={segmentId} onValueChange={setSegmentId} disabled={!csv}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All ({csv?.rows.length ?? 0})</SelectItem>
                    {csv?.segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} ({s.rowIds.length})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"} selected.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Email body</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={humanize} disabled={busy !== null || !body}>
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Humanize
                </Button>
                <Button size="sm" variant="outline" onClick={suggestSubjects} disabled={busy !== null || !body}>
                  <Type className="h-3.5 w-3.5 mr-1.5" /> Subjects
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brief" className="text-xs">Campaign brief (for AI generator)</Label>
                <Textarea
                  id="brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. We help B2B SaaS companies double demo conversion via AI-personalized outbound."
                />
                <Button size="sm" onClick={generate} disabled={busy !== null}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {busy === "gen" ? "Generating…" : "Generate personalized draft"}
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subj" className="text-xs">Subject</Label>
                <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
                {subjectIdeas.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {subjectIdeas.map((s) => (
                      <button key={s} onClick={() => setSubject(s)} className="text-xs px-2 py-1 rounded-md border border-border hover:bg-accent">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="body" className="text-xs">Body</Label>
                <Textarea id="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {name},…" />
                <p className="text-[11px] text-muted-foreground">Tip: include CSV fields like {"{name}"} for personalization — the backend interpolates per-recipient.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Send</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => setPreview((p) => !p)} variant="outline">
                <Eye className="h-3.5 w-3.5 mr-1.5" /> {preview ? "Hide preview" : "Preview first email"}
              </Button>
              <Button className="w-full" onClick={send} disabled={busy !== null}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {busy === "send" ? "Sending…" : `Send to ${recipients.length}`}
              </Button>
              {dupes.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
                  <div className="flex items-center gap-1.5 font-medium mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    {dupes.length} duplicate{dupes.length === 1 ? "" : "s"} skipped
                  </div>
                  These recipients were already emailed previously and were excluded by the backend dedup check.
                </div>
              )}
            </CardContent>
          </Card>

          {preview && recipients[0] && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
                <p className="text-xs text-muted-foreground">As seen by {recipients[0].name} ({recipients[0].email})</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="secondary" className="text-xs">Subject</Badge>
                <p className="text-sm font-medium">{subject || "(no subject)"}</p>
                <Badge variant="secondary" className="text-xs mt-2">Body</Badge>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">{body || "(empty)"}</pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
