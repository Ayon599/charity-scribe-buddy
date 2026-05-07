import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Fund = { id: string; name: string; code: string };
type SubRow = {
  id: string;
  fund_id: string;
  monthly_amount: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};

type RowState = {
  enabled: boolean;
  monthly_amount: number;
  start_date: string;
  existingId?: string;
};

export function MemberSubscriptionsDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  memberId: string | null;
  memberName: string;
}) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [state, setState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !memberId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId]);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [fRes, sRes] = await Promise.all([
      supabase.from("funds").select("id,name,code").eq("is_active", true).order("sort_order"),
      supabase.from("member_fund_subscriptions").select("*").eq("member_id", memberId!),
    ]);
    if (fRes.error) toast({ title: "Failed to load funds", description: fRes.error.message, variant: "destructive" });
    if (sRes.error) toast({ title: "Failed to load subs", description: sRes.error.message, variant: "destructive" });
    const fundList = (fRes.data ?? []) as Fund[];
    const subs = (sRes.data ?? []) as SubRow[];
    const next: Record<string, RowState> = {};
    fundList.forEach((f) => {
      const existing = subs.find((s) => s.fund_id === f.id);
      next[f.id] = existing
        ? {
            enabled: existing.is_active,
            monthly_amount: Number(existing.monthly_amount),
            start_date: existing.start_date,
            existingId: existing.id,
          }
        : { enabled: false, monthly_amount: 0, start_date: today };
    });
    setFunds(fundList);
    setState(next);
    setLoading(false);
  }

  async function handleSave() {
    if (!memberId) return;
    setSaving(true);

    const upserts = funds
      .filter((f) => state[f.id]?.enabled)
      .map((f) => ({
        member_id: memberId,
        fund_id: f.id,
        monthly_amount: state[f.id].monthly_amount,
        start_date: state[f.id].start_date,
        is_active: true,
      }));

    const deactivateIds = funds
      .filter((f) => !state[f.id]?.enabled && state[f.id]?.existingId)
      .map((f) => state[f.id].existingId!);

    const errors: string[] = [];
    if (upserts.length) {
      const { error } = await supabase
        .from("member_fund_subscriptions")
        .upsert(upserts, { onConflict: "member_id,fund_id" });
      if (error) errors.push(error.message);
    }
    if (deactivateIds.length) {
      const { error } = await supabase
        .from("member_fund_subscriptions")
        .update({ is_active: false })
        .in("id", deactivateIds);
      if (error) errors.push(error.message);
    }

    setSaving(false);
    if (errors.length) {
      toast({ title: "Save failed", description: errors.join("; "), variant: "destructive" });
    } else {
      toast({ title: "Subscriptions saved" });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fund subscriptions — {memberName}</DialogTitle>
          <DialogDescription>
            Choose which funds this member contributes to and the expected monthly amount per fund.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 px-2 text-xs text-muted-foreground">
              <div className="col-span-1"></div>
              <div className="col-span-5">Fund</div>
              <div className="col-span-3 text-right">Monthly (৳)</div>
              <div className="col-span-3">Start date</div>
            </div>
            {funds.map((f) => {
              const s = state[f.id];
              if (!s) return null;
              return (
                <div key={f.id} className="grid grid-cols-12 items-center gap-2 rounded-md border p-2">
                  <div className="col-span-1 flex justify-center">
                    <Checkbox
                      checked={s.enabled}
                      onCheckedChange={(v) =>
                        setState({ ...state, [f.id]: { ...s, enabled: !!v } })
                      }
                    />
                  </div>
                  <div className="col-span-5">
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.code}</div>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!s.enabled}
                      value={s.monthly_amount}
                      onChange={(e) =>
                        setState({ ...state, [f.id]: { ...s, monthly_amount: Number(e.target.value) } })
                      }
                      className="text-right"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="date"
                      disabled={!s.enabled}
                      value={s.start_date}
                      onChange={(e) =>
                        setState({ ...state, [f.id]: { ...s, start_date: e.target.value } })
                      }
                    />
                  </div>
                </div>
              );
            })}
            {funds.length === 0 && (
              <p className="text-sm text-muted-foreground">No active funds. Add a fund first.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
