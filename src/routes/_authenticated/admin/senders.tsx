import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminNav } from "@/lib/admin-nav";
import { AdminAPI } from "@/services/api";
import type { SenderAccount } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/senders")({
  component: SendersPage,
});

function SendersPage() {
  const [senders, setSenders] = useState<SenderAccount[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { AdminAPI.listSenders().then(setSenders); }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || password.length < 6) {
      toast.error("Fill all fields (password ≥ 6 chars)");
      return;
    }
    setBusy(true);
    try {
      const s = await AdminAPI.createSender({ name, email, password });
      setSenders((arr) => [s, ...arr]);
      toast.success(`Sender ${s.name} created`);
      setName(""); setEmail(""); setPassword("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const onDelete = async (id: string) => {
    try {
      await AdminAPI.deleteSender(id);
      setSenders((arr) => arr.filter((s) => s.id !== id));
      toast.success("Sender removed");
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Failed to delete sender.");
    }
  };

  return (
    <DashboardShell nav={adminNav} navTitle="Admin" title="Senders" subtitle="Create and manage sender accounts">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">New sender</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="n">Name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="p">Password</Label><Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create sender"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">All senders ({senders.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">CSVs</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {senders.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.assignedCsvIds.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.emailsSent}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onDelete(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
