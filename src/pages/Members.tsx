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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Power } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type MemberType = Database["public"]["Enums"]["member_type"];
type Member = Database["public"]["Tables"]["members"]["Row"];

const memberSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  member_type: z.enum(["founding", "executive", "general"]),
  monthly_fee: z.coerce.number().min(0).max(1_000_000),
  joining_date: z.string().min(1, "Joining date required"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof memberSchema>;

const emptyForm: FormValues = {
  full_name: "",
  email: "",
  mobile: "",
  address: "",
  member_type: "general",
  monthly_fee: 0,
  joining_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

const typeLabel: Record<MemberType, string> = {
  founding: "Founding",
  executive: "Executive",
  general: "General",
};

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MemberType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<Member | null>(null);

  useEffect(() => {
    document.title = "Members | Prottoy Foundation";
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("member_no", { ascending: true });
    if (error) {
      toast({ title: "Failed to load members", description: error.message, variant: "destructive" });
    } else {
      setMembers(data ?? []);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (typeFilter !== "all" && m.member_type !== typeFilter) return false;
      if (statusFilter === "active" && !m.is_active) return false;
      if (statusFilter === "inactive" && m.is_active) return false;
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.mobile ?? "").toLowerCase().includes(q) ||
        String(m.member_no).includes(q)
      );
    });
  }, [members, search, typeFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      full_name: m.full_name,
      email: m.email ?? "",
      mobile: m.mobile ?? "",
      address: m.address ?? "",
      member_type: m.member_type,
      monthly_fee: Number(m.monthly_fee ?? 0),
      joining_date: m.joining_date,
      notes: m.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = memberSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Invalid input",
        description: parsed.error.issues[0]?.message ?? "Check the form",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const v = parsed.data;
    const payload = {
      full_name: v.full_name,
      email: v.email || null,
      mobile: v.mobile || null,
      address: v.address || null,
      member_type: v.member_type,
      monthly_fee: v.monthly_fee,
      joining_date: v.joining_date,
      notes: v.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from("members").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Member updated" });
        setDialogOpen(false);
        fetchMembers();
      }
    } else {
      const { error } = await supabase.from("members").insert(payload);
      if (error) {
        toast({ title: "Create failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Member added" });
        setDialogOpen(false);
        fetchMembers();
      }
    }
    setSubmitting(false);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    const { error } = await supabase
      .from("members")
      .update({ is_active: !toggleTarget.is_active })
      .eq("id", toggleTarget.id);
    if (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: toggleTarget.is_active ? "Member deactivated" : "Member activated" });
      fetchMembers();
    }
    setToggleTarget(null);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
            <p className="text-sm text-muted-foreground">
              Manage foundation members and their monthly contribution amounts.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Member list</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} of ${members.length} members`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, mobile, or member no."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="founding">Founding</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Monthly Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No members found.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.member_no}</TableCell>
                      <TableCell>
                        <div className="font-medium">{m.full_name}</div>
                        {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{typeLabel[m.member_type]}</Badge>
                      </TableCell>
                      <TableCell>{m.mobile ?? "—"}</TableCell>
                      <TableCell>{m.joining_date}</TableCell>
                      <TableCell className="text-right font-mono">
                        ৳{Number(m.monthly_fee).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {m.is_active ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToggleTarget(m)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
            <DialogTitle>{editing ? "Edit member" : "Add member"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Member No. ${editing.member_no}`
                : "A member number will be assigned automatically."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full name *</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Member type *</Label>
                <Select
                  value={form.member_type}
                  onValueChange={(v) => setForm({ ...form, member_type: v as MemberType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="founding">Founding</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="monthly_fee">Monthly fee (৳) *</Label>
                <Input
                  id="monthly_fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.monthly_fee}
                  onChange={(e) =>
                    setForm({ ...form, monthly_fee: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="joining_date">Joining date *</Label>
              <Input
                id="joining_date"
                type="date"
                value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active ? "Deactivate member?" : "Activate member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? `${toggleTarget?.full_name} will be marked inactive and hidden from default lists.`
                : `${toggleTarget?.full_name} will be reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
