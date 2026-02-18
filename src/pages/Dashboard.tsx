import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, HelpCircle, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

const DEFAULT_THRESHOLD_DAYS = 30;

type TermGroup = "valid" | "expiring" | "expired" | "needs_info";

function computeTermGroup(nextDueDate: string | null, thresholdDays: number): TermGroup {
  if (!nextDueDate) return "needs_info";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "expired";
  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);
  if (due <= thresholdDate) return "expiring";
  return "valid";
}

const termGroupToStatus: Record<TermGroup, string> = {
  valid: "PLANNED",
  expiring: "DUE_SOON",
  expired: "OVERDUE",
  needs_info: "NEEDS_INFO",
};

interface ObligationRow {
  id: string;
  title: string;
  status: string;
  next_due_date: string | null;
  performed_date: string | null;
  customers: { name: string } | null;
  locations: { name: string } | null;
  service_catalog: { code: string; name: string; division: string } | null;
}

export default function Dashboard() {
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TermGroup | null>(null);
  const [thresholdDays, setThresholdDays] = useState(DEFAULT_THRESHOLD_DAYS);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("obligations")
      .select("id, title, status, next_due_date, performed_date, customers(name), locations(name), service_catalog(code, name, division)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setObligations(data as unknown as ObligationRow[]);
        setLoading(false);
      });

    supabase.from("app_settings").select("value").eq("key", "due_soon_threshold_days").single()
      .then(({ data }) => {
        if (data) {
          const val = parseInt(String(data.value));
          if (!isNaN(val) && val > 0) setThresholdDays(val);
        }
      });
  }, []);

  const counts = { expired: 0, expiring: 0, needs_info: 0 };
  obligations.forEach(o => {
    const g = computeTermGroup(o.next_due_date, thresholdDays);
    if (g === "expired") counts.expired++;
    else if (g === "expiring") counts.expiring++;
    else if (g === "needs_info") counts.needs_info++;
  });

  const filtered = statusFilter
    ? obligations.filter(o => computeTermGroup(o.next_due_date, thresholdDays) === statusFilter)
    : obligations;

  const kpiCards = [
    { key: "expired" as TermGroup, label: "Po termínu", count: counts.expired, icon: AlertTriangle, color: "text-red-600" },
    { key: "expiring" as TermGroup, label: "Brzy vyprší", count: counts.expiring, icon: Clock, color: "text-yellow-600" },
    { key: "needs_info" as TermGroup, label: "Chybí údaje", count: counts.needs_info, icon: HelpCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Přehled povinností a termínů</p>
        </div>
        <Button onClick={() => navigate("/obligations/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nová povinnost
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpiCards.map(kpi => (
          <Card
            key={kpi.key}
            className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === kpi.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter(statusFilter === kpi.key ? null : kpi.key)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.count}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Obligations Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Povinnosti</CardTitle>
            {statusFilter && (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter(null)}>
                Zobrazit vše
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Načítání...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Žádné povinnosti. <Link to="/obligations/new" className="text-primary hover:underline">Vytvořit první</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Název</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Služba</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Odběratel</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Lokalita</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Expirace</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ob => {
                    const group = computeTermGroup(ob.next_due_date, thresholdDays);
                    return (
                      <tr
                        key={ob.id}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/obligations/${ob.id}`)}
                      >
                        <td className="p-3 font-medium">{ob.title}</td>
                        <td className="p-3 text-muted-foreground">
                          {ob.service_catalog ? `${ob.service_catalog.code} – ${ob.service_catalog.name}` : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">{ob.customers?.name || "—"}</td>
                        <td className="p-3 text-muted-foreground">{ob.locations?.name || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}
                        </td>
                        <td className="p-3"><StatusBadge status={termGroupToStatus[group]} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
