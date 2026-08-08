import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logoAsset from "@/assets/logo.png.asset.json";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
  Tags,
  Receipt,
  ShieldCheck,
  Scale,
  Droplet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/members", label: "Members", icon: Users },
  { to: "/member-types", label: "Member Types", icon: Tags },
  { to: "/funds", label: "Funds", icon: Wallet },
  { to: "/income", label: "Income", icon: ArrowDownCircle },
  { to: "/expenses", label: "Expenses", icon: ArrowUpCircle },
  { to: "/dues", label: "Dues", icon: Receipt },
  { to: "/reconciliation", label: "Reconciliation", icon: ScaleIcon },

  { to: "/blood-donors", label: "Blood Donors", icon: Droplet },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="border-b p-4 flex items-center gap-3">
          <img src={logoAsset.url} alt="Prottoy Foundation" className="h-10 w-10 rounded-full" />
          <div>
            <h1 className="text-sm font-semibold leading-tight">Prottoy Foundation</h1>
            <p className="text-xs text-muted-foreground">Account Management</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
          {isSuperAdmin && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Users
            </NavLink>
          )}
        </nav>
        <div className="border-t p-3">
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {(user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? user?.email}
          </p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="md:hidden flex items-center justify-between border-b bg-card p-3">
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="Prottoy Foundation" className="h-7 w-7 rounded-full" />
            <h1 className="font-semibold">Prottoy Foundation</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
