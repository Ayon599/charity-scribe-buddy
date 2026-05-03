import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search } from "lucide-react";
import { formatBDT } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Fund = Pick<Database["public"]["Tables"]["funds"]["Row"], "id" | "name">;

const schema = z.object({
  fund_id: z.string().uuid("Select a fund"),
  amount: z.coerce.number().positive("Amount must be > 0"),
  expense_date: z.string().min(1),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  payee: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  fund_id: "",
  amount: 0,
  expense_date: new Date().toISOString().slice(0, 10),
  category: "",
  payee: "",
  description: "",
};

interface Row extends Expense {
  fund?: { name: string } | null;
}

export default function Expenses() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fundFilter, setFundFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(empty);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Expenses | Prottoy Foundation";
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [e, f] = await Promise.all([
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("funds").select("id, name").eq("is_active", true).order("sort_order"),
    ]);
    if (e.error) toast({ title: "Load failed", description: e.error.message, variant: "destructive" });
    const fundMap = new Map((f.data ?? []).map((x) => [x.id, x]));
    setRows((e.data ?? []).map((r) => ({ ...r, fund: fundMap.get(r.fund_id) ?? null })));
    setFunds(f.data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fundFilter !== "all" && r.fund_id !== fundFilter) return false;
      if (!q) return true;
      return (
        (r.payee ?? "").toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.fund?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, fundFilter]);

  const totals = useMemo(() => filtered.reduce((s, r) => s + Number(r.amount), 0), [filtered]);

  function openCreate() {
    setForm({ ...empty, fund_id: funds[0]?.id ?? "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const v = parsed.data;
    const { error } = await supabase.from("expenses").insert({
      fund_id: v.fund_id,
      amount: v.amount,
      expense_date: v.expense_date,
      category: v.category || null,
      payee: v.payee || null,
      description: v.description || null,
      created_by: user?.id ?? null,
    });
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Expense recorded" });
      setDialogOpen(false);
      load();
    }
    setSubmitting(false);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
            <p className="text-sm text-muted-foreground">Track outflows from each fund.</p>
          </div>
          <Button onClick={openCreate} disabled={funds.length === 0}>
            <Plus className="h-4 w-4" /> New Expense
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expense entries</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} entries · Total ৳ ${formatBDT(totals)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search payee, category or fund"
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
                    <TableHead>Fund</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No expenses recorded.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.expense_date}</TableCell>
                      <TableCell>{r.fund?.name ?? "—"}</TableCell>
                      <TableCell>{r.category ?? "—"}</TableCell>
                      <TableCell>{r.payee ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                        {r.description ?? "—"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
            <DialogDescription>Add an outflow against a specific fund.</DialogDescription>
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
                <Label htmlFor="expense_date">Date *</Label>
                <Input id="expense_date" type="date" value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (৳) *</Label>
                <Input id="amount" type="number" min={0} step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Utilities, Salary, Supplies…" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payee">Payee</Label>
              <Input id="payee" value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Record expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
