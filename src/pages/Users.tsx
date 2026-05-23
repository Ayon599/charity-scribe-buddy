import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Copy, Check, Shield, UserMinus, UserPlus, Trash2 } from "lucide-react";
import { safeErrorMessage } from "@/lib/errors";

type Status = "pending_approval" | "approved" | "rejected";

interface AdminRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  status: Status;
  is_active: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  invited_at: string | null;
  created_at: string;
  roles: string[];
}

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

interface AuditEntry {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<AdminRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ row: AdminRow; action: string; label: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: prof }, { data: inv }, { data: log }, { data: roles }] = await Promise.all([
      supabase.from("admin_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_invitations").select("*").is("accepted_at", null).order("created_at", { ascending: false }),
      supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    setAdmins(
      (prof ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.user_id) ?? [] })) as AdminRow[],
    );
    setInvitations((inv ?? []) as Invitation[]);
    setAudit((log ?? []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const inviteUrlFor = (token: string) => `${window.location.origin}/accept-invite?token=${token}`;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email: inviteEmail.trim(), full_name: inviteName.trim() },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Could not create invitation",
        description: (data as any)?.error ?? error?.message ?? "Try again",
        variant: "destructive",
      });
      return;
    }
    const token = (data as any).invitation.token;
    setGeneratedLink(inviteUrlFor(token));
    setInviteName("");
    setInviteEmail("");
    load();
  };

  const closeInviteDialog = () => {
    setInviteOpen(false);
    setGeneratedLink(null);
    setCopied(false);
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const runAction = async (target_user_id: string, action: string, reason?: string) => {
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action, target_user_id, reason },
    });
    if (error || (data as any)?.error) {
      toast({
        title: "Action failed",
        description: (data as any)?.error ?? safeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Done", description: `Action "${action}" completed.` });
    load();
  };

  const approve = (row: AdminRow) => runAction(row.user_id, "approve");
  const reject = async () => {
    if (!rejectTarget) return;
    await runAction(rejectTarget.user_id, "reject", rejectReason || undefined);
    setRejectTarget(null);
    setRejectReason("");
  };
  const confirmRun = async () => {
    if (!confirmAction) return;
    await runAction(confirmAction.row.user_id, confirmAction.action);
    setConfirmAction(null);
  };

  const pendingAdmins = admins.filter((a) => a.status === "pending_approval");
  const otherAdmins = admins.filter((a) => a.status !== "pending_approval");

  const statusBadge = (a: AdminRow) => {
    if (!a.is_active) return <Badge variant="secondary">Deactivated</Badge>;
    if (a.status === "approved") return <Badge>Approved</Badge>;
    if (a.status === "pending_approval") return <Badge variant="outline">Pending</Badge>;
    return <Badge variant="destructive">Rejected</Badge>;
  };

  const roleBadge = (roles: string[]) =>
    roles.includes("super_admin") ? (
      <Badge className="bg-primary"><Shield className="mr-1 h-3 w-3" /> Super admin</Badge>
    ) : (
      <Badge variant="outline">Admin</Badge>
    );

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage admin accounts and invitations.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={(o) => (o ? setInviteOpen(true) : closeInviteDialog())}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Invite admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a new admin</DialogTitle>
              <DialogDescription>
                Create an invitation link the invitee can use to set their password.
              </DialogDescription>
            </DialogHeader>

            {generatedLink ? (
              <div className="space-y-3">
                <p className="text-sm">Share this link with the invitee. It expires in 7 days.</p>
                <div className="flex gap-2">
                  <Input readOnly value={generatedLink} onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyLink(generatedLink)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={closeInviteDialog}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={inviting}>
                    {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create invitation
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending approval {pendingAdmins.length > 0 && <Badge className="ml-2" variant="destructive">{pendingAdmins.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="all">All admins</TabsTrigger>
            <TabsTrigger value="invites">Pending invitations</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Awaiting approval</CardTitle></CardHeader>
              <CardContent>
                {pendingAdmins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending admins.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Email</TableHead>
                        <TableHead>Signed up</TableHead><TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingAdmins.map((a) => (
                        <TableRow key={a.user_id}>
                          <TableCell>{a.full_name ?? "—"}</TableCell>
                          <TableCell>{a.email ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" onClick={() => approve(a)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => setRejectTarget(a)}>Reject</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader><CardTitle>All admins</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Email</TableHead>
                      <TableHead>Role</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherAdmins.map((a) => {
                      const isSelf = a.user_id === user?.id;
                      const isSuper = a.roles.includes("super_admin");
                      return (
                        <TableRow key={a.user_id}>
                          <TableCell>{a.full_name ?? "—"} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</TableCell>
                          <TableCell>{a.email ?? "—"}</TableCell>
                          <TableCell>{roleBadge(a.roles)}</TableCell>
                          <TableCell>{statusBadge(a)}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {a.status === "approved" && a.is_active && !isSuper && (
                              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ row: a, action: "promote", label: "Promote to super admin" })}>
                                <Shield className="mr-1 h-3 w-3" /> Promote
                              </Button>
                            )}
                            {a.status === "approved" && a.is_active && isSuper && !isSelf && (
                              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ row: a, action: "demote", label: "Demote from super admin" })}>
                                Demote
                              </Button>
                            )}
                            {a.is_active && !isSelf && (
                              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ row: a, action: "deactivate", label: "Deactivate this account" })}>
                                <UserMinus className="mr-1 h-3 w-3" /> Deactivate
                              </Button>
                            )}
                            {!a.is_active && (
                              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ row: a, action: "reactivate", label: "Reactivate this account" })}>
                                <UserPlus className="mr-1 h-3 w-3" /> Reactivate
                              </Button>
                            )}
                            {a.status === "rejected" && (
                              <Button size="sm" onClick={() => approve(a)}>Approve</Button>
                            )}
                            {!isSelf && (
                              <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ row: a, action: "delete", label: "Delete this account permanently" })}>
                                <Trash2 className="mr-1 h-3 w-3" /> Delete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invites" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Pending invitations</CardTitle></CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open invitations.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Email</TableHead>
                        <TableHead>Expires</TableHead><TableHead>Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.full_name}</TableCell>
                          <TableCell>{i.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(i.expires_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => copyLink(inviteUrlFor(i.token))}>
                              <Copy className="mr-1 h-3 w-3" /> Copy link
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
              <CardContent>
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead><TableHead>Action</TableHead>
                        <TableHead>Target</TableHead><TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((e) => {
                        const target = admins.find((a) => a.user_id === e.target_user_id);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-sm">{new Date(e.created_at).toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline">{e.action}</Badge></TableCell>
                            <TableCell>{target?.full_name ?? target?.email ?? (e.metadata as any)?.email ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.reason ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.full_name ?? rejectTarget?.email}?</DialogTitle>
            <DialogDescription>The user will be notified and cannot log in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to the user)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional: why is this account being rejected?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generic confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "delete"
                ? "This permanently removes the user and their account. This cannot be undone."
                : "Are you sure you want to continue?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRun}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
