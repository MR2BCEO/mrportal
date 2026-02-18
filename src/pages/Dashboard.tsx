import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertTriangle, Clock, CalendarDays, CalendarPlus, Plus,
  CheckCircle2, Play, MapPin, ArrowRight, RotateCcw, Shield, Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, addWeeks, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { cs } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_THRESHOLD_DAYS = 30;
const RANGE_OPTIONS = [7, 14, 30, 60] as const;

type TermGroup = "valid" | "expiring" | "expired";

function computeTermGroup(nextDueDate: string | null, rangeDays: number): TermGroup {
  if (!nextDueDate) return "expired"; // legacy/null treated as expired
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
};

interface TechnicianItem {
  id: string;
  name: string;
  company: string | null;
}

interface ObligationRow {
  id: string;
  title: string;
  status: string;
  next_due_date: string | null;
  performed_date: string | null;
  responsible_user_id: string | null;
  technician_name: string | null;
  customers: { name: string } | null;
  locations: { id: string; name: string } | null;
  service_catalog: { code: string; name: string; division: string } | null;
  profiles: { name: string | null } | null;
}

type KpiFilter = "all" | "valid" | "expired" | "expiring" | "this_month" | "next_month" | "week" | null;

export default function Dashboard() {
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [settingsThreshold, setSettingsThreshold] = useState(DEFAULT_THRESHOLD_DAYS);
  const [rangeDays, setRangeDays] = useState(DEFAULT_THRESHOLD_DAYS);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [technicians, setTechnicians] = useState<TechnicianItem[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchObligations = () => {
    supabase
      .from("obligations")
      .select("id, title, status, next_due_date, performed_date, responsible_user_id, technician_name, customers(name), locations(id, name), service_catalog(code, name, division), profiles(name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setObligations(data as unknown as ObligationRow[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchObligations();
    supabase.from("app_settings").select("value").eq("key", "due_soon_threshold_days").maybeSingle()
      .then(({ data }) => {
        if (data) {
          const val = parseInt(String(data.value));
          if (!isNaN(val) && val > 0) {
            setSettingsThreshold(val);
            setRangeDays(val);
          }
        }
      });
    supabase.from("technicians").select("id, name, company").eq("is_active", true).order("name")
      .then(({ data }) => setTechnicians((data as unknown as TechnicianItem[]) || []));
  }, []);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const nextMonthDate = new Date(thisYear, thisMonth + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthMonth = nextMonthDate.getMonth();

  const baseList = useMemo(() => {
    if (technicianFilter === "all") return obligations;
    return obligations.filter(o => o.technician_name === technicianFilter);
  }, [obligations, technicianFilter]);

  const counts = useMemo(() => {
    let expired = 0, expiring = 0, valid = 0, thisM = 0, nextM = 0;
    baseList.forEach(o => {
      const g = computeTermGroup(o.next_due_date, rangeDays);
      if (g === "expired") expired++;
      else if (g === "expiring") expiring++;
      else if (g === "valid") valid++;
      if (isInMonth(o.next_due_date, thisYear, thisMonth)) thisM++;
      if (isInMonth(o.next_due_date, nextMonthYear, nextMonthMonth)) nextM++;
    });
    return { total: baseList.length, valid, expired, expiring, thisMonth: thisM, nextMonth: nextM };
  }, [baseList, rangeDays, thisYear, thisMonth, nextMonthYear, nextMonthMonth]);

  // Week strip data (8 weeks)
  const weekStrip = useMemo(() => {
    const weeks: { start: Date; end: Date; count: number; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const count = baseList.filter(o => {
        if (!o.next_due_date) return false;
        const due = new Date(o.next_due_date);
        return isWithinInterval(due, { start: weekStart, end: weekEnd });
      }).length;
      weeks.push({
        start: weekStart,
        end: weekEnd,
        count,
        label: `${format(weekStart, "d.M.", { locale: cs })}`,
      });
    }
    return weeks;
  }, [baseList]);

  // Filtered list for focus sections
  const expiredList = useMemo(() => {
    return baseList
      .filter(o => computeTermGroup(o.next_due_date, rangeDays) === "expired")
      .sort((a, b) => (a.next_due_date || "").localeCompare(b.next_due_date || ""))
      .slice(0, 5);
  }, [baseList, rangeDays]);

  const expiringList = useMemo(() => {
    return baseList
      .filter(o => computeTermGroup(o.next_due_date, rangeDays) === "expiring")
      .sort((a, b) => (a.next_due_date || "9999").localeCompare(b.next_due_date || "9999"))
      .slice(0, 10);
  }, [baseList, rangeDays]);

  const tableData = useMemo(() => {
    let list = baseList;

    if (kpiFilter === "all") {
      // no filter
    } else if (kpiFilter === "valid") {
      list = list.filter(o => computeTermGroup(o.next_due_date, rangeDays) === "valid");
    } else if (kpiFilter === "expired") {
      list = list.filter(o => computeTermGroup(o.next_due_date, rangeDays) === "expired");
    } else if (kpiFilter === "expiring") {
      list = list.filter(o => computeTermGroup(o.next_due_date, rangeDays) === "expiring");
    } else if (kpiFilter === "this_month") {
      list = list.filter(o => isInMonth(o.next_due_date, thisYear, thisMonth));
    } else if (kpiFilter === "next_month") {
      list = list.filter(o => isInMonth(o.next_due_date, nextMonthYear, nextMonthMonth));
    } else if (kpiFilter === "week" && selectedWeek !== null) {
      const w = weekStrip[selectedWeek];
      if (w) {
        list = list.filter(o => {
          if (!o.next_due_date) return false;
          const due = new Date(o.next_due_date);
          return isWithinInterval(due, { start: w.start, end: w.end });
        });
      }
    }

    const groupOrder: Record<TermGroup, number> = { expired: 0, expiring: 1, valid: 2 };
    const sorted = [...list].sort((a, b) => {
      const ga = computeTermGroup(a.next_due_date, rangeDays);
      const gb = computeTermGroup(b.next_due_date, rangeDays);
      if (groupOrder[ga] !== groupOrder[gb]) return groupOrder[ga] - groupOrder[gb];
      const da = a.next_due_date || "9999";
      const db = b.next_due_date || "9999";
      return da.localeCompare(db);
    });

    return sorted.slice(0, 20);
  }, [baseList, kpiFilter, rangeDays, thisYear, thisMonth, nextMonthYear, nextMonthMonth, selectedWeek, weekStrip]);

  const topLocations = useMemo(() => {
    const locMap = new Map<string, { id: string; name: string; customerName: string; count: number; expiredCount: number; expiringCount: number }>();
    baseList.forEach(o => {
      if (!o.locations) return;
      const g = computeTermGroup(o.next_due_date, rangeDays);
      if (g === "expired" || g === "expiring") {
        const key = o.locations.id;
        const existing = locMap.get(key);
        if (existing) {
          existing.count++;
          if (g === "expired") existing.expiredCount++;
          else existing.expiringCount++;
        } else {
          locMap.set(key, {
            id: key,
            name: o.locations.name,
            customerName: o.customers?.name || "",
            count: 1,
            expiredCount: g === "expired" ? 1 : 0,
            expiringCount: g === "expiring" ? 1 : 0,
          });
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

  const maxWeekCount = Math.max(...weekStrip.map(w => w.count), 1);

  const kpiCards: { key: KpiFilter; label: string; count: number; icon: typeof AlertTriangle; borderColor: string; iconBg: string; iconColor: string }[] = [
    { key: "expired", label: "Po termínu", count: counts.expired, icon: AlertTriangle, borderColor: "border-red-500/50", iconBg: "bg-red-500/10", iconColor: "text-red-500" },
    { key: "expiring", label: `Do ${rangeDays} dnů`, count: counts.expiring, icon: Clock, borderColor: "border-yellow-500/50", iconBg: "bg-yellow-500/10", iconColor: "text-yellow-500" },
    { key: "this_month", label: "Tento měsíc", count: counts.thisMonth, icon: CalendarDays, borderColor: "border-blue-500/50", iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
    { key: "next_month", label: "Příští měsíc", count: counts.nextMonth, icon: CalendarPlus, borderColor: "border-sky-400/50", iconBg: "bg-sky-400/10", iconColor: "text-sky-400" },
  ];

  const statusPills: { key: KpiFilter; label: string; count: number; bg: string; text: string }[] = [
    { key: "all", label: "Celkem", count: counts.total, bg: "bg-muted", text: "text-foreground" },
    { key: "valid", label: "Platné", count: counts.valid, bg: "bg-green-500/10", text: "text-green-700 dark:text-green-400" },
    { key: "expiring", label: "Brzy vyprší", count: counts.expiring, bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400" },
    { key: "expired", label: "Expirované", count: counts.expired, bg: "bg-red-500/10", text: "text-red-700 dark:text-red-400" },
  ];

  const ObligationCardRow = ({ ob }: { ob: ObligationRow }) => {
    const group = computeTermGroup(ob.next_due_date, rangeDays);
    const isDone = ob.status === "DONE";
    const isInProgress = ob.status === "IN_PROGRESS";
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
        onClick={() => navigate(`/obligations/${ob.id}`)}
      >
        {/* Left color indicator */}
        <div className={`w-1 self-stretch rounded-full shrink-0 ${
          group === "expired" ? "bg-red-500" : group === "expiring" ? "bg-yellow-500" : "bg-green-500"
        }`} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {ob.service_catalog ? `${ob.service_catalog.name}` : ob.title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {ob.customers?.name || "—"}
            {ob.locations?.name ? ` · ${ob.locations.name}` : ""}
            {ob.technician_name ? ` · 🔧 ${ob.technician_name}` : ""}
          </p>
        </div>

        {/* Date + Badge in fixed-width right section for perfect alignment */}
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-sm font-bold tabular-nums whitespace-nowrap w-[5.5rem] text-right ${
            group === "expired" ? "text-red-600 dark:text-red-400" : group === "expiring" ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"
          }`}>
            {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}
          </span>
          <div className="w-[7rem] flex justify-start">
            <StatusBadge status={termGroupToStatus[group]} />
          </div>
        </div>

        {/* Quick actions - minimal width, flush right */}
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-8" onClick={e => e.stopPropagation()}>
          {!isDone && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10" title="Hotovo" onClick={(e) => handleQuickAction(ob.id, "DONE", e)}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {!isInProgress && !isDone && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10" title="Zahájeno" onClick={(e) => handleQuickAction(ob.id, "IN_PROGRESS", e)}>
              <Play className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ===== A) COMMAND BAR ===== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Přehled termínů revizí a povinností</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/obligations")}>
              <Eye className="w-3.5 h-3.5 mr-1.5" />Všechny revize
            </Button>
            <Button size="sm" onClick={() => navigate("/obligations/new")}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Nová povinnost
            </Button>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          {statusPills.map(pill => {
            const isActive = kpiFilter === pill.key;
            return (
              <button
                key={pill.key}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all ${pill.bg} ${pill.text} ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md" : "hover:shadow-sm"}`}
                onClick={() => setKpiFilter(isActive ? null : pill.key)}
              >
                {pill.label}
                <span className="font-bold">{pill.count}</span>
              </button>
            );
          })}
          {kpiFilter && (
            <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1" onClick={() => { setKpiFilter(null); setSelectedWeek(null); }}>
              <RotateCcw className="w-3 h-3" />Reset
            </button>
          )}
        </div>

        {/* Range & technician filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Horizont:</span>
            {RANGE_OPTIONS.map(d => (
              <button
                key={d}
                className={`h-7 px-2.5 text-xs rounded-md border font-medium transition-colors ${
                  rangeDays === d
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:bg-accent"
                }`}
                onClick={() => setRangeDays(d)}
              >
                {d} dnů
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Technik:</span>
            <select
              value={technicianFilter}
              onChange={e => setTechnicianFilter(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-card text-foreground"
            >
              <option value="all">Všichni</option>
              {technicians.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name}{t.company ? ` (${t.company})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(kpi => {
          const isActive = kpiFilter === kpi.key;
          return (
            <Card
              key={kpi.key}
              className={`cursor-pointer transition-all hover:shadow-lg border-l-4 ${kpi.borderColor} ${isActive ? "ring-2 ring-primary shadow-lg" : ""}`}
              onClick={() => { setKpiFilter(isActive ? null : kpi.key); setSelectedWeek(null); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                    <kpi.icon className={`w-4.5 h-4.5 ${kpi.iconColor}`} />
                  </div>
                  {kpi.count > 0 && kpi.key === "expired" && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  )}
                </div>
                <p className="text-3xl font-extrabold tracking-tight">{kpi.count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ===== B) WEEK STRIP – Expirace v čase ===== */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Expirace – příštích 8 týdnů</p>
          <div className="grid grid-cols-8 gap-1.5">
            {weekStrip.map((w, i) => {
              const isSelected = kpiFilter === "week" && selectedWeek === i;
              const barHeight = Math.max(8, (w.count / maxWeekCount) * 48);
              return (
                <button
                  key={i}
                  className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent/50"}`}
                  onClick={() => {
                    if (isSelected) { setKpiFilter(null); setSelectedWeek(null); }
                    else { setKpiFilter("week"); setSelectedWeek(i); }
                  }}
                >
                  <div className="w-full flex items-end justify-center h-12">
                    <div
                      className={`w-full max-w-[28px] rounded-sm transition-all ${w.count === 0 ? "bg-muted" : isSelected ? "bg-primary" : "bg-primary/40"}`}
                      style={{ height: `${barHeight}px` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${isSelected ? "text-primary" : ""}`}>{w.count}</span>
                  <span className="text-[10px] text-muted-foreground leading-none">{w.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ===== C) FOCUS LISTS ===== */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Načítání...</div>
      ) : kpiFilter ? (
        /* Filtered view */
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Filtrované výsledky ({tableData.length})
            </h2>
          </div>
          <div className="space-y-1.5">
            {tableData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Žádné revize k zobrazení.</p>
            ) : (
              tableData.map(ob => <ObligationCardRow key={ob.id} ob={ob} />)
            )}
          </div>
        </div>
      ) : (
        /* Default: focus sections */
        <div className="space-y-6">
          {/* Po termínu */}
          {expiredList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Po termínu ({counts.expired})
                </h2>
              </div>
              <div className="space-y-1.5">
                {expiredList.map(ob => <ObligationCardRow key={ob.id} ob={ob} />)}
                {counts.expired > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setKpiFilter("expired")}>
                    Zobrazit všechny ({counts.expired}) →
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Do X dnů */}
          {expiringList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                  Do {rangeDays} dnů ({counts.expiring})
                </h2>
              </div>
              <div className="space-y-1.5">
                {expiringList.map(ob => <ObligationCardRow key={ob.id} ob={ob} />)}
                {counts.expiring > 10 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setKpiFilter("expiring")}>
                    Zobrazit všechny ({counts.expiring}) →
                  </Button>
                )}
              </div>
            </div>
          )}

          {expiredList.length === 0 && expiringList.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold">Vše v pořádku</p>
              <p className="text-sm text-muted-foreground">Žádné expirované ani blížící se termíny.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== D) TOP LOKACE ===== */}
      {topLocations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Top lokace do {rangeDays} dnů
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {topLocations.map(loc => (
              <Card key={loc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/locations/${loc.id}`)}>
                <CardContent className="p-4">
                   <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {loc.expiredCount > 0 && (
                        <span className="text-lg font-extrabold text-red-600 dark:text-red-400">{loc.expiredCount}</span>
                      )}
                      {loc.expiredCount > 0 && loc.expiringCount > 0 && (
                        <span className="text-muted-foreground text-xs">/</span>
                      )}
                      {loc.expiringCount > 0 && (
                        <span className="text-lg font-extrabold text-yellow-600 dark:text-yellow-400">{loc.expiringCount}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold truncate">{loc.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{loc.customerName}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {loc.expiredCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Po termínu</span>}
                    {loc.expiringCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Brzy</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/locations/${loc.id}`); }}>
                    Zobrazit <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
