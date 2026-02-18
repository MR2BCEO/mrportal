import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, CalendarDays, CalendarPlus, HelpCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

function isInMonth(dateStr: string | null, year: number, month: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
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

type KpiFilter = "expired" | "expiring" | "this_month" | "next_month" | "needs_info" | null;

export default function Dashboard() {
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
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

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const nextMonthDate = new Date(thisYear, thisMonth + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthMonth = nextMonthDate.getMonth();

  const counts = useMemo(() => {
    let expired = 0, expiring = 0, thisM = 0, nextM = 0, needsInfo = 0;
    obligations.forEach(o => {
      const g = computeTermGroup(o.next_due_date, thresholdDays);
      if (g === "expired") expired++;
      else if (g === "expiring") expiring++;
      if (g === "needs_info") needsInfo++;
      if (isInMonth(o.next_due_date, thisYear, thisMonth)) thisM++;
      if (isInMonth(o.next_due_date, nextMonthYear, nextMonthMonth)) nextM++;
    });
    return { expired, expiring, thisMonth: thisM, nextMonth: nextM, needsInfo };
  }, [obligations, thresholdDays, thisYear, thisMonth, nextMonthYear, nextMonthMonth]);

  // Filter + sort for table
  const tableData = useMemo(() => {
    let list = obligations;

    if (kpiFilter === "expired") {
      list = list.filter(o => computeTermGroup(o.next_due_date, thresholdDays) === "expired");
    } else if (kpiFilter === "expiring") {
      list = list.filter(o => computeTermGroup(o.next_due_date, thresholdDays) === "expiring");
    } else if (kpiFilter === "this_month") {
      list = list.filter(o => isInMonth(o.next_due_date, thisYear, thisMonth));
    } else if (kpiFilter === "next_month") {
      list = list.filter(o => isInMonth(o.next_due_date, nextMonthYear, nextMonthMonth));
    } else if (kpiFilter === "needs_info") {
      list = list.filter(o => computeTermGroup(o.next_due_date, thresholdDays) === "needs_info");
    }

    // Default sort: OVERDUE first, then DUE_SOON, then by date asc
    const groupOrder: Record<TermGroup, number> = { expired: 0, expiring: 1, needs_info: 2, valid: 3 };
    const sorted = [...list].sort((a, b) => {
      const ga = computeTermGroup(a.next_due_date, thresholdDays);
      const gb = computeTermGroup(b.next_due_date, thresholdDays);
      if (groupOrder[ga] !== groupOrder[gb]) return groupOrder[ga] - groupOrder[gb];
      const da = a.next_due_date || "9999";
      const db = b.next_due_date || "9999";
      return da.localeCompare(db);
    });

    return sorted.slice(0, 20);
  }, [obligations, kpiFilter, thresholdDays, thisYear, thisMonth, nextMonthYear, nextMonthMonth]);

  const kpiCards: { key: KpiFilter; label: string; count: number; icon: typeof AlertTriangle; color: string }[] = [
    { key: "expired", label: "Po termínu", count: counts.expired, icon: AlertTriangle, color: "text-red-600" },
    { key: "expiring", label: "Brzy vyprší", count: counts.expiring, icon: Clock, color: "text-yellow-600" },
    { key: "this_month", label: "Tento měsíc", count: counts.thisMonth, icon: CalendarDays, color: "text-blue-600" },
    { key: "next_month", label: "Příští měsíc", count: counts.nextMonth, icon: CalendarPlus, color: "text-blue-400" },
    { key: "needs_info", label: "Chybí datum", count: counts.needsInfo, icon: HelpCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Hlídání termínů revizí a povinností</p>
        </div>
        <Button onClick={() => navigate("/obligations/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nová povinnost
        </Button>
      </div>

      {/* 1) KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map(kpi => (
          <Card
            key={kpi.key}
            className={`cursor-pointer transition-shadow hover:shadow-md ${kpiFilter === kpi.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setKpiFilter(kpiFilter === kpi.key ? null : kpi.key)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold">{kpi.count}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2) Critical obligations table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Nejkritičtější revize</CardTitle>
            <div className="flex items-center gap-2">
              {kpiFilter && (
                <Button variant="ghost" size="sm" onClick={() => setKpiFilter(null)}>
                  Zobrazit vše
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate("/obligations")}>
                Všechny revize →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Načítání...</div>
          ) : tableData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Žádné revize k zobrazení.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Odběratel</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Lokalita</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Služba</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Expirace</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Stav</th>
                    <th className="text-left p-3 font-medium text-muted-foreground w-16">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(ob => {
                    const group = computeTermGroup(ob.next_due_date, thresholdDays);
                    return (
                      <tr
                        key={ob.id}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/obligations/${ob.id}`)}
                      >
                        <td className="p-3">{ob.customers?.name || "—"}</td>
                        <td className="p-3 text-muted-foreground">{ob.locations?.name || "—"}</td>
                        <td className="p-3 font-medium">
                          {ob.service_catalog ? `${ob.service_catalog.code} – ${ob.service_catalog.name}` : ob.title}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}
                        </td>
                        <td className="p-3"><StatusBadge status={termGroupToStatus[group]} /></td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/obligations/${ob.id}`); }}>
                            Detail
                          </Button>
                        </td>
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
