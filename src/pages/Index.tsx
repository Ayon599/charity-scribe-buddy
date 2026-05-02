import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface FundSummary {
  id: string;
  name: string;
  income: number;
  expense: number;
  balance: number;
}

const formatBDT = (n: number) =>
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(n);

export default function Index() {
  const { user, isAdmin } = useAuth();
  const [summaries, setSummaries] = useState<FundSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: funds }, { data: txns }, { data: exps }] = await Promise.all([
        supabase.from("funds").select("id, name, sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("transactions").select("fund_id, amount"),
        supabase.from("expenses").select("fund_id, amount"),
      ]);

      const incomeMap = new Map<string, number>();
      (txns ?? []).forEach((t) => {
        incomeMap.set(t.fund_id, (incomeMap.get(t.fund_id) ?? 0) + Number(t.amount));
      });
      const expenseMap = new Map<string, number>();
      (exps ?? []).forEach((e) => {
        expenseMap.set(e.fund_id, (expenseMap.get(e.fund_id) ?? 0) + Number(e.amount));
      });

      setSummaries(
        (funds ?? []).map((f) => {
          const income = incomeMap.get(f.id) ?? 0;
          const expense = expenseMap.get(f.id) ?? 0;
          return { id: f.id, name: f.name, income, expense, balance: income - expense };
        })
      );
      setLoading(false);
    };
    load();
  }, []);

  const totals = summaries.reduce(
    (acc, s) => ({
      income: acc.income + s.income,
      expense: acc.expense + s.expense,
      balance: acc.balance + s.balance,
    }),
    { income: 0, expense: 0, balance: 0 }
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}.
          {!isAdmin && " (Awaiting admin role)"}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳ {formatBDT(totals.income)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expense</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳ {formatBDT(totals.expense)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳ {formatBDT(totals.balance)}</div>
              </CardContent>
            </Card>
          </div>

          <h3 className="mb-3 text-lg font-semibold">Fund Balances</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Income</span>
                    <span>৳ {formatBDT(s.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expense</span>
                    <span>৳ {formatBDT(s.expense)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Balance</span>
                    <span>৳ {formatBDT(s.balance)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
