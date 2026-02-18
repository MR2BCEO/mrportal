import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertTriangle, Clock, CalendarDays, CalendarPlus, HelpCircle, Plus,
  CheckCircle2, Play, MapPin, ArrowRight, RotateCcw, User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Toggle } from "@/components/ui/toggle";

const DEFAULT_THRESHOLD_DAYS = 30;
const RANGE_OPTIONS = [7, 14, 30, 60] as const;

type TermGroup = "valid" | "expiring" | "expired" | "needs_info";

function computeTermGroup(nextDueDate: string | null, rangeDays: number): TermGroup {
  if (!nextDueDate) return "needs_info";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "expired";
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + rangeDays);
  if (due <= threshold) return "expiring";
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
  responsible_user_id: string | null;
  customers: { name: string } | null;
  locations: { id: string; name: string } | null;
  service_catalog: { code: string; name: string; division: string } | null;
  profiles: { name: string | null } | null;
}

type KpiFilter = "expired" | "expiring" | "this_month" | "next_month" | "needs_info" | null;

export default function Dashboard() {
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [settingsThreshold, setSettingsThreshold] = useState(DEFAULT_THRESHOLD_DAYS);
  const [rangeDays, setRangeDays] = useState(DEFAULT_THRESHOLD_DAYS);
  const [onlyMine, setOnlyMine] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchObligations = () => {
    supabase
      .from("obligations")
      .select("id, title, status, next_due_date, performed_date, responsible_user_id, customers(name), locations(id, name), service_catalog(code, name, division), profiles(name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setObligations(data as unknown as ObligationRow[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchObligations();
    supabase.from("app_settings").select("value").eq("key", "due_soon_threshold_days").single()
      .then(({ data }) => {
        if (data) {
          const val = parseInt(String(data.value));
          if (!isNaN(val) && val > 0) {
            setSettingsThreshold(val);
            setRangeDays(val);
          }
        }
      });
  }, []);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const nextMonthDate = new Date(thisYear, thisMonth + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthMonth = nextMonthDate.getMonth();

  const baseList = useMemo(() => {
    if (!onlyMine || !user) return obligations;
    return obligations.filter(o => o.responsible_user_id === user.id);
  }, [obligations, onlyMine, user]);

  const counts = useMemo(() => {
    let expired = 0, expiring = 0, thisM = 0, nextM = 0, needsInfo = 0;
    baseList.forEach(o => {
      const g = computeTermGroup(o.next_due_date, rangeDays);
      if (g === "expired") expired++;
      else if (g === "expiring") expiring++;
      if (g === "needs_info") needsInfo++;
      if (isInMonth(o.next_due_date, thisYear, thisMonth)) thisM++;
      if (isInMonth(o.next_due_date, nextMonthYear, nextMonthMonth)) nextM++;
    });
    return { expired, expiring, thisMonth: thisM, nextMonth: nextM, needsInfo };
  }, [baseList, rangeDays, thisYear, thisMonth, nextMonthYear, nextMonthMonth]);

  const tableData = useMemo(() => {
    let list = baseList;

    if (kpiFilter === "expired") {
      list = list.filter(o => computeTermGroup(o.next_due_date, rangeDays) === "expired");
    } else if (kpiFilter === "expiring") {
      list = list.filter(o => computeTermGroup(o.next_due_date, rangeDays) === "expiring");
    } else if (kpiFilter === "this_month") {
      list = list.filter(o => isInMonth(o.next_due_date, thisYear, thisMonth));
    } else if (kpiFilter === "next_month") {
      list = list.filter(o => isInMonth(o.next_due_date, nextMonthYear, nextMonthMonth));
    } else if (kpiFilter === "needs_info") {
      list = list.filter(o => computeTermGroup(o.next_due_date, rangeDays) === "needs_info");
    }

    const groupOrder: Record<TermGroup, number> = { expired: 0, expiring: 1, needs_info: 2, valid: 3 };
    const sorted = [...list].sort((a, b) => {
      const ga = computeTermGroup(a.next_due_date, rangeDays);
      const gb = computeTermGroup(b.next_due_date, rangeDays);
      if (groupOrder[ga] !== groupOrder[gb]) return groupOrder[ga] - groupOrder[gb];
      const da = a.next_due_date || "9999";
      const db = b.next_due_date || "9999";
      return da.localeCompare(db);
    });

    return sorted.slice(0, 20);
  }, [baseList, kpiFilter, rangeDays, thisYear, thisMonth, nextMonthYear, nextMonthMonth]);

  // D) Top locations with most expirations within range
  const topLocations = useMemo(() => {
    const locMap = new Map<string, { id: string; name: string; count: number }>();
    baseList.forEach(o => {
      if (!o.locations) return;
      const g = computeTermGroup(o.next_due_date, rangeDays);
      if (g === "expired" || g === "expiring") {
        const key = o.locations.id;
        const existing = locMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          locMap.set(key, { id: key, name: o.locations.name, count: 1 });
        }
      }
    });
    return Array.from(locMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [baseList, rangeDays]);

  const handleQuickAction = async (id: string, newStatus: "DONE" | "IN_PROGRESS", e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("obligations").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: newStatus === "DONE" ? "Označeno jako hotovo" : "Zahájeno" });
    fetchObligations();
  };

  const kpiCards: { key: KpiFilter; label: string; count: number; icon: typeof AlertTriangle; color: string; bgColor: string; pillBg: string; pillText: string }[] = [
    { key: "expired", label: "Expirované", count: counts.expired, icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", pillBg: "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800", pillText: "text-red-700 dark:text-red-300" },
    { key: "expiring", label: "Brzy vyprší", count: counts.expiring, icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", pillBg: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800", pillText: "text-yellow-700 dark:text-yellow-300" },
    { key: "this_month", label: "Tento měsíc", count: counts.thisMonth, icon: CalendarDays, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", pillBg: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800", pillText: "text-blue-700 dark:text-blue-300" },
    { key: "next_month", label: "Příští měsíc", count: counts.nextMonth, icon: CalendarPlus, color: "text-sky-500", bgColor: "bg-sky-100 dark:bg-sky-900/30", pillBg: "bg-sky-100 dark:bg-sky-900/40 border-sky-200 dark:border-sky-800", pillText: "text-sky-700 dark:text-sky-300" },
    { key: "needs_info", label: "Chybí datum", count: counts.needsInfo, icon: HelpCircle, color: "text-muted-foreground", bgColor: "bg-muted", pillBg: "bg-muted border-border", pillText: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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

      {/* A) KPI Cards – clickable filters */}
      <div className="flex flex-wrap gap-2">
        {kpiCards.map(kpi => {
          const isActive = kpiFilter === kpi.key;
          return (
            <button
              key={kpi.key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer ${kpi.pillBg} ${kpi.pillText} ${isActive ? "ring-2 ring-primary ring-offset-2 shadow-md" : "hover:shadow-sm"}`}
              onClick={() => setKpiFilter(isActive ? null : kpi.key)}
            >
              {kpi.label}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-xs font-bold ${isActive ? "bg-primary text-primary-foreground" : kpi.bgColor + " " + kpi.color}`}>
                {kpi.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* C) Critical obligations table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Nejkritičtější revize</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {/* B) Range switcher */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Do:</span>
                {RANGE_OPTIONS.map(d => (
                  <Button
                    key={d}
                    variant={rangeDays === d ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setRangeDays(d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <div className="h-5 w-px bg-border hidden sm:block" />
              {/* "My" filter */}
              <Button
                variant={onlyMine ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setOnlyMine(!onlyMine)}
              >
                <User className="w-3 h-3 mr-1" />Moje
              </Button>
              {kpiFilter && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setKpiFilter(null)}>
                  <RotateCcw className="w-3 h-3 mr-1" />Reset
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/obligations")}>
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
                    <th className="text-left p-3 font-medium text-muted-foreground">Odpovědný</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Stav</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(ob => {
                    const group = computeTermGroup(ob.next_due_date, rangeDays);
                    const isDone = ob.status === "DONE";
                    const isInProgress = ob.status === "IN_PROGRESS";
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
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {ob.profiles?.name || "—"}
                        </td>
                        <td className="p-3"><StatusBadge status={termGroupToStatus[group]} /></td>
                        <td className="p-3">
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate(`/obligations/${ob.id}`)}>
                              Detail
                            </Button>
                            {!isDone && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Hotovo"
                                onClick={(e) => handleQuickAction(ob.id, "DONE", e)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!isInProgress && !isDone && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Zahájeno"
                                onClick={(e) => handleQuickAction(ob.id, "IN_PROGRESS", e)}
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
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

      {/* D) Top locations */}
      {topLocations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Top lokace do {rangeDays} dnů
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {topLocations.map(loc => (
                <div key={loc.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.count} {loc.count === 1 ? "položka" : loc.count < 5 ? "položky" : "položek"}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => navigate(`/locations/${loc.id}`)}
                  >
                    Zobrazit <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
