import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  expires_at: string;
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.");
      setChecking(false);
      return;
    }
    supabase
      .rpc("validate_invitation_token", { _token: token })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setError("This invitation link is invalid, expired, or already used.");
        } else {
          setInvitation(data[0] as Invitation);
        }
        setChecking(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password });
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("accept-invitation", {
      body: { token, password: parsed.data.password },
    });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      toast({
        title: "Could not accept invitation",
        description: (data as any)?.error ?? error?.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Account created",
      description: "Your account is awaiting super admin approval. You'll be notified once it's approved.",
    });
    navigate("/auth", { replace: true });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Accept invitation</CardTitle>
          {invitation && (
            <CardDescription>
              You're invited to join as an admin. Set a password to create your account for{" "}
              <span className="font-medium">{invitation.email}</span>.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Link to="/auth" className="text-sm text-primary underline">Go to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={invitation?.full_name ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={invitation?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Choose a password (min 8 chars)</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                After creating your account, a super admin will need to approve it before you can sign in.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
