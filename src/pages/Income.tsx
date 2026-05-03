import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Receipt } from "lucide-react";
import { formatBDT, PAYMENT_METHODS, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Txn = Database["public"]["Tables"]["transactions"]["Row"];
type Fund = Pick<Database["public"]["Tables"]["funds"]["Row"], "id" | "name" | "code">;
type Member = Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "full_name" | "member_no" | "monthly_fee">;

const txnSchema = z.object({
  fund_id: z.string().uuid("Select a fund"),
  member_id: z.string().uuid().optional().or(z.literal("")),
  donor_name: z.string().trim().max(200).optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be > 0"),
  payment_method: z.enum(PAYMENT_METHODS),
  txn_date: z.string().min(1),
  for_month: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  issue_receipt: z.boolean(),
});
type FormValues = z.infer<typeof txnSchema>;

const empty: FormValues = {
  fund_id: "",
  member_id: "",
  donor_name: "",
  amount: 0,
  payment_method: "cash",
  txn_date: new Date().toISOString().slice(0, 10),
  for_month: "",
  description: "",
  issue_receipt: true,
};

interface Row extends Txn {
  fund?: { name: string; code: string } | null;
  member?: { full_name: string; member_no: number } | null;
  receipt?: { receipt_no: string } | null;
}

export default function Income() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fundFilter, setFundFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(empty);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Income | Prottoy Foundation";
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [t, f, m, r] = await Promise.all([
      supabase.from("transactions").select("*").order("txn_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("funds").select("id, name, code").eq("is_active", true).order("sort_order"),
      supabase.from("members").select("id, full_name, member_no, monthly_fee").eq("is_active", true).order("member_no"),
      supabase.from("receipts").select("transaction_id, receipt_no"),
    ]);
    if (t.error) toast({ title: "Load failed", description: t.error.message, variant: "destructive" });
    const fundMap = new Map((f.data ?? []).map((x) => [x.id, x]));
    const memberMap = new Map((m.data ?? []).map((x) => [x.id, x]));
    const recMap = new Map((r.data ?? []).map((x) => [x.transaction_id, x]));
    setRows((t.data ?? []).map((row) => ({
      ...row,
      fund: fundMap.get(row.fund_id) ?? null,
      member: row.member_id ? memberMap.get(row.member_id) ?? null : null,
      receipt: recMap.get(row.id) ?? null,
    })));
    setFunds(f.data ?? []);
    setMembers(m.data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fundFilter !== "all" && r.fund_id !== fundFilter) return false;
      if (!q) return true;
      return (
        (r.donor_name ?? "").toLowerCase().includes(q) ||
        (r.member?.full_name ?? "").toLowerCase().includes(q) ||
        (r.receipt?.receipt_no ?? "").toLowerCase().includes(q) ||
        (r.fund?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, fundFilter]);

  const totals = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.amount), 0),
    [filtered]
  );

  function openCreate() {
    setForm({ ...empty, fund_id: funds[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function onMemberSelect(id: string) {
    const member = members.find((mm) => mm.id === id);
    setForm((prev) => ({
      ...prev,
      member_id: id,
      donor_name: member?.full_name ?? prev.donor_name,
      amount: prev.amount || Number(member?.monthly_fee ?? 0),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = txnSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    if (!parsed.data.member_id && !parsed.data.donor_name) {
      toast({ title: "Missing donor", description: "Choose a member or enter a donor name.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const v = parsed.data;
    const payload = {
      fund_id: v.fund_id,
      member_id: v.member_id || null,
      donor_name: v.donor_name || null,
      amount: v.amount,
      payment_method: v.payment_method,
      txn_date: v.txn_date,
      for_month: v.for_month ? `${v.for_month}-01` : null,
      description: v.description || null,
      created_by: user?.id ?? null,
    };
    const { data: ins, error } = await supabase.from("transactions").insert(payload).select("id").single();
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    if (v.issue_receipt && ins) {
      const issuedTo = v.donor_name || members.find((mm) => mm.id === v.member_id)?.full_name || "Donor";
      const { error: rerr } = await supabase.from("receipts").insert({
        transaction_id: ins.id,
        amount: v.amount,
        issued_to: issuedTo,
        issued_by: user?.id ?? null,
        receipt_no: "",
      });
      if (rerr) toast({ title: "Receipt failed", description: rerr.message, variant: "destructive" });
    }
    toast({ title: "Income recorded" });
    setDialogOpen(false);
    setSubmitting(false);
    load();
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
            <p className="text-sm text-muted-foreground">
              Record member contributions and donations. Receipts are auto-numbered.
            </p>
          </div>
          <Button onClick={openCreate} disabled={funds.length === 0}>
            <Plus className="h-4 w-4" /> New Income
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} entries · Total ৳ ${formatBDT(totals)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search donor, member, fund or receipt no."
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={fundFilter} onValueChange={setFundFilter}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All funds</SelectItem>
                  {funds.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Donor / Member</TableHead>
                    <TableHead>Fund</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No income recorded.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.txn_date}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.receipt ? (
                          <Badge variant="secondary" className="gap-1">
                            <Receipt className="h-3 w-3" />{r.receipt.receipt_no}
                          </Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {r.member?.full_name ?? r.donor_name ?? "—"}
                        </div>
                        {r.member && (
                          <div className="text-xs text-muted-foreground">Member #{r.member.member_no}</div>
                        )}
                      </TableCell>
                      <TableCell>{r.fund?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{PAYMENT_LABEL[r.payment_method as PaymentMethod]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">৳{formatBDT(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record income</DialogTitle>
            <DialogDescription>Add a contribution or donation to a fund.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Fund *</Label>
                <Select value={form.fund_id} onValueChange={(v) => setForm({ ...form, fund_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                  <SelectContent>
                    {funds.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="txn_date">Date *</Label>
                <Input id="txn_date" type="date" value={form.txn_date}
                  onChange={(e) => setForm({ ...form, txn_date: e.target.value })} required />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Member (optional)</Label>
              <Select value={form.member_id || "none"}
                onValueChange={(v) => v === "none" ? setForm({ ...form, member_id: "" }) : onMemberSelect(v)}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— External donor —</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>#{m.member_no} · {m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="donor_name">Donor name</Label>
              <Input id="donor_name" value={form.donor_name}
                onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                placeholder="If different from member or for external donor" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (৳) *</Label>
                <Input id="amount" type="number" min={0} step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
              </div>
              <div className="grid gap-2">
                <Label>Payment method *</Label>
                <Select value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v as PaymentMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => (
                      <SelectItem key={p} value={p}>{PAYMENT_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="for_month">For month (optional)</Label>
              <Input id="for_month" type="month" value={form.for_month}
                onChange={(e) => setForm({ ...form, for_month: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Issue receipt</Label>
                <p className="text-xs text-muted-foreground">Auto-numbered as PF-YYYY-####</p>
              </div>
              <Switch checked={form.issue_receipt}
                onCheckedChange={(v) => setForm({ ...form, issue_receipt: v })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Record income"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
