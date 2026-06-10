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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Wand2,
  Type,
  Send,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";

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
  const [preview, setPreview] = useState(true);
  const [dupes, setDupes] = useState<string[]>([]);

  // Lead cycling preview states
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    SenderAPI.myAssignedCSVs(user.id).then((arr) => {
      setCsvs(arr);
      setCsvId(arr[0]?.id ?? "");
    });
  }, [user]);

  const csv = useMemo(() => csvs.find((c) => c.id === csvId), [csvs, csvId]);

  const recipients = useMemo(() => {
    if (!csv) return [];
    if (segmentId === "__all__") return csv.rows;
    const seg = csv.segments.find((s) => s.id === segmentId);
    if (!seg) return csv.rows;
    return csv.rows.filter((r) => seg.rowIds.includes(r._id));
  }, [csv, segmentId]);

  // Reset preview index when recipients change
  useEffect(() => {
    setPreviewIndex(0);
  }, [recipients]);

  const activePreviewLead = useMemo(() => {
    return recipients[previewIndex] ?? null;
  }, [recipients, previewIndex]);

  const generate = async () => {
    if (!csv || !brief.trim() || !recipients[0]) {
      toast.error("Pick a CSV sheet and write a prompt brief");
      return;
    }
    setBusy("gen");
    try {
      const out = await SenderAPI.aiGenerateEmail(brief, recipients[0]);
      setBody(out);
      toast.success("AI draft composed successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to generate AI draft";
      toast.error(errMsg);
    } finally {
      setBusy(null);
    }
  };

  const humanize = async () => {
    if (!body.trim()) return;
    setBusy("human");
    try {
      const result = await SenderAPI.aiHumanize(body);
      setBody(result);
      toast.success("Tone humanized successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Tone humanization failed.";
      toast.error(errMsg);
    } finally {
      setBusy(null);
    }
  };

  const suggestSubjects = async () => {
    if (!body.trim()) {
      toast.error("Please compose a body draft first");
      return;
    }
    setBusy("subj");
    try {
      const ideas = await SenderAPI.aiSubjects(body);
      setSubjectIdeas(ideas);
      toast.success("AI subject recommendations generated!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to generate subject ideas.";
      toast.error(errMsg);
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!csv || !subject.trim() || !body.trim() || !recipients.length) {
      toast.error("Complete subject, email body, and check recipients count");
      return;
    }
    setBusy("send");
    try {
      const res = await SenderAPI.sendCampaign({
        csvId: csv.id,
        segmentId: segmentId === "__all__" ? undefined : segmentId,
        subject,
        body,
        recipientIds: recipients.map((r) => r._id),
      });
      setDupes(res.skippedDuplicates);
      toast.success(`Campaign successfully sent to ${res.sent} contacts!`);
    } catch (err: unknown) {
      let errorMsg = "Campaign dispatch failed.";
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
    } finally {
      setBusy(null);
    }
  };

  // Variable Interpolator Helper with markup tokens for variable highlights
  const renderInterpolatedHTML = (text: string, lead: Record<string, string>) => {
    if (!text) return <span className="text-muted-foreground italic">(empty message body)</span>;

    // Split by {variable} regex
    const parts = text.split(/(\{[\w+]+\})/g);
    return parts.map((part, index) => {
      const isVar = part.startsWith("{") && part.endsWith("}");
      if (isVar) {
        const key = part.slice(1, -1);
        const val = lead[key];
        return val !== undefined ? (
          <span
            key={index}
            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold mx-0.5 inline-block text-[11px] animate-pulse"
          >
            {val}
          </span>
        ) : (
          <span
            key={index}
            className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-bold mx-0.5 inline-block text-[11px]"
          >
            {part} (undefined)
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderInterpolatedTextOnly = (text: string, lead: Record<string, string>) => {
    if (!text) return "";
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return lead[key] !== undefined ? lead[key] : match;
    });
  };

  return (
    <DashboardShell
      nav={senderNav}
      navTitle="Sender"
      title="Outreach Editor"
      subtitle="Compose personalized email templates and dispatch to cohorts"
    >
      <FadeIn className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
        <div className="space-y-6">
          {/* Target Audience Selectors */}
          <Card className="glass-panel border-border/40 shadow-xl">
            <CardHeader className="pb-3 border-b border-border/10 bg-background/10">
              <CardTitle className="text-sm font-bold">Target Cohorts</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned CSV Sheet
                </Label>
                <Select
                  value={csvId}
                  onValueChange={(v) => {
                    setCsvId(v);
                    setSegmentId("__all__");
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/40">
                    <SelectValue placeholder="Choose database" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel rounded-xl">
                    {csvs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Segment
                </Label>
                <Select value={segmentId} onValueChange={setSegmentId} disabled={!csv}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-panel rounded-xl">
                    <SelectItem value="__all__">All records ({csv?.rows.length ?? 0})</SelectItem>
                    {csv?.segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label} ({s.rowIds.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 text-xs font-semibold text-muted-foreground">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {recipients.length} Recipient{recipients.length === 1 ? "" : "s"} targeted
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Email Editor */}
          <Card className="glass-panel border-border/40 shadow-xl">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border/10 bg-background/10 pb-3">
              <CardTitle className="text-sm font-bold">Compose Outreach Template</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={humanize}
                  disabled={busy !== null || !body}
                  className="h-8 text-xs rounded-lg cursor-pointer"
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1 text-primary animate-pulse" /> Humanize Tone
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={suggestSubjects}
                  disabled={busy !== null || !body}
                  className="h-8 text-xs rounded-lg cursor-pointer"
                >
                  <Type className="h-3.5 w-3.5 mr-1 text-primary animate-pulse" /> Subjects
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {/* Prompt Brief */}
              <div className="space-y-2">
                <Label
                  htmlFor="s-brief"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  AI Generation Prompt Brief
                </Label>
                <Textarea
                  id="s-brief"
                  rows={2.5}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="glass-input"
                  placeholder="e.g. Introduce our B2B SaaS platform that cuts CRM logging time by 90% using speech-to-text integration. Keep the tone conversational, friendly, and brief."
                />
                <Button
                  size="sm"
                  onClick={generate}
                  disabled={busy !== null}
                  className="font-bold uppercase tracking-wider h-8 text-[10px] rounded-lg cursor-pointer shadow-md shadow-primary/10"
                >
                  <Sparkles
                    className="h-3.5 w-3.5 mr-1 text-white animate-spin"
                    style={{ animationDuration: "5s" }}
                  />
                  {busy === "gen" ? "Composing AI Draft…" : "Generate AI Copy"}
                </Button>
              </div>

              {/* Subject Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="s-subj"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Subject Line
                </Label>
                <Input
                  id="s-subj"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Quick intro / Help with {company}'s CRM logs"
                  className="h-10 glass-input"
                />

                {subjectIdeas.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      AI Recommendations:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {subjectIdeas.map((idea) => (
                        <button
                          key={idea}
                          onClick={() => setSubject(idea)}
                          className="text-[10px] px-2 py-1 rounded-lg border border-border/50 bg-background/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 cursor-pointer"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Body Content Editor */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label
                    htmlFor="s-body"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Email Template Body
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Tip: Type variable fields in brackets (e.g.{" "}
                    <code className="text-primary font-bold">{"{name}"}</code> or{" "}
                    <code className="text-primary font-bold">{"{company}"}</code>)
                  </span>
                </div>
                <Textarea
                  id="s-body"
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi {name},&#10;&#10;I noticed that {company} operates in the {industry} sector. We help teams with automated outreach templates..."
                  className="glass-input font-mono text-xs leading-relaxed"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Action / Preview Workspace */}
        <div className="space-y-6">
          {/* Dispatch Control */}
          <Card className="glass-panel border-border/40 shadow-xl">
            <CardHeader className="pb-3 border-b border-border/10 bg-background/10">
              <CardTitle className="text-sm font-bold">Outreach Dispatch</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button
                className="w-full h-10 font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:bg-primary/5 transition-all duration-200"
                onClick={() => setPreview((p) => !p)}
                variant="outline"
              >
                <Eye className="h-4 w-4 mr-1.5" />{" "}
                {preview ? "Collapse Preview" : "Expand Live Preview"}
              </Button>
              <Button
                className="w-full h-10 font-bold uppercase tracking-wider rounded-xl hover-float transition-all duration-300 shadow-lg shadow-primary/20 cursor-pointer"
                onClick={send}
                disabled={busy !== null || !recipients.length}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {busy === "send" ? "Dispatching..." : `Send to ${recipients.length} Leads`}
              </Button>
              {dupes.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-xs text-foreground space-y-2">
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wide text-warning-foreground">
                    <AlertTriangle className="h-4 w-4 text-warning" /> {dupes.length} Duplicates
                    skipped
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    These contacts were previously emailed and were automatically excluded by the
                    de-duplication safety checks.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Personalization Preview Panel */}
          {preview && activePreviewLead && (
            <SlideIn delay={100}>
              <Card className="glass-panel border-border/40 shadow-xl overflow-hidden relative">
                <CardHeader className="pb-3 border-b border-border/10 bg-background/10">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Campaign Preview</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
                      Lead {previewIndex + 1} of {recipients.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground font-mono truncate font-semibold mt-1">
                    To: {activePreviewLead.name} ({activePreviewLead.email})
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Lead cyclers */}
                  <div className="flex justify-between items-center gap-2 pb-3 border-b border-border/10">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                      disabled={previewIndex <= 0}
                      className="h-8 w-8 rounded-lg cursor-pointer hover:bg-primary/5"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      Cycle lead columns
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPreviewIndex((i) => Math.min(recipients.length - 1, i + 1))}
                      disabled={previewIndex >= recipients.length - 1}
                      className="h-8 w-8 rounded-lg cursor-pointer hover:bg-primary/5"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-wider bg-background/50 border border-border/50"
                      >
                        Subject
                      </Badge>
                      <div className="p-3 rounded-lg bg-background/30 border border-border/30 text-xs font-semibold">
                        {renderInterpolatedTextOnly(subject, activePreviewLead) || (
                          <span className="text-muted-foreground italic">(no subject header)</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-wider bg-background/50 border border-border/50"
                      >
                        Email Body
                      </Badge>
                      <div className="p-3.5 rounded-lg bg-background/30 border border-border/30 text-xs font-mono whitespace-pre-wrap leading-relaxed min-h-[140px]">
                        {renderInterpolatedHTML(body, activePreviewLead)}
                      </div>
                    </div>
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
