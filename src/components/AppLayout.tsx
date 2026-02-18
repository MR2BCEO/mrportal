import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Building2, MapPin, ClipboardCheck, Settings, LogOut, Menu, X, ChevronDown
} from "lucide-react";
import logo from "@/assets/logo-muj-revizak.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UIExportButton } from "@/components/UIExportButton";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers", icon: Building2, label: "Odběratelé" },
  { to: "/locations", icon: MapPin, label: "Lokace" },
  { to: "/obligations", icon: ClipboardCheck, label: "Revize" },
  { to: "/settings", icon: Settings, label: "Nastavení", adminOnly: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { userName, userRole, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logo} alt="Můj Revizák" className="w-8 h-8 rounded-lg" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">Můj Revizák</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">Hlídání revizí</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && userRole !== "admin") return null;
            const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-3">
            <UIExportButton />
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-accent-foreground">
              {userName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-sidebar-foreground/50 uppercase">{userRole || "—"}</p>
            </div>
            <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground" title="Odhlásit">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b flex items-center px-4 gap-3 bg-card lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-sm">Můj Revizák</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
