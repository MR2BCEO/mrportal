import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Download, ArrowUpDown, X, ChevronLeft, ChevronRight } from "lucide-react";
import { exportObligationsCSV } from "@/lib/exportCSV";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { cs } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "DONE", label: "Vyhovující", color: "bg-green-600" },
  { value: "OVERDUE", label: "Nevyhovující", color: "bg-red-600" },
  { value: "PLANNED", label: "Rozpracováno", color: "bg-yellow-500" },
  { value: "DUE_SOON", label: "Čekání", color: "bg-orange-400" },
  { value: "IN_PROGRESS", label: "Probíhá", color: "bg-blue-500" },
  { value: "NEEDS_INFO", label: "Chybí údaje", color: "bg-gray-400" },
  { value: "ARCHIVED", label: "Archiv", color: "bg-gray-300" },
] as const;

const DAY_NAMES = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export default function Obligations() {
  const [obligations, setObligations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [customerFilters, setCustomerFilters] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sortField, setSortField] = useState<"next_due_date" | "title">("next_due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("obligations")
      .select("id, title, status, next_due_date, performed_date, findings_summary, customers(name), locations(name), service_catalog(code, name, division, group_name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setObligations(data || []));
  }, []);

  const toggleStatus = (s: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const toggleCustomer = (name: string) => {
    setCustomerFilters(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const uniqueCustomers = useMemo(() => {
    const names = new Set<string>();
    obligations.forEach(o => { const n = (o.customers as any)?.name; if (n) names.add(n); });
    return Array.from(names).sort();
  }, [obligations]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = obligations
    .filter(o => {
      if (statusFilters.size > 0 && !statusFilters.has(o.status)) return false;
      const cName = (o.customers as any)?.name;
      if (customerFilters.size > 0 && (!cName || !customerFilters.has(cName))) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.title.toLowerCase().includes(q) && !cName?.toLowerCase().includes(q) && !o.id?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = (getDay(monthStart) + 6) % 7; // Monday = 0

  const dueDates = useMemo(() => {
    const set = new Set<string>();
    obligations.forEach(o => { if (o.next_due_date) set.add(o.next_due_date); });
    return set;
  }, [obligations]);

  const hasActiveFilters = statusFilters.size > 0 || customerFilters.size > 0;

  return (
    <div className="flex gap-0 animate-fade-in h-[calc(100vh-4rem)]">
      {/* Main table */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Revize</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={async () => {
              const count = await exportObligationsCSV();
              if (!count) alert("Žádná data k exportu");
            }}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Export
            </Button>
            <Button size="sm" className="h-8" onClick={() => navigate("/obligations/new")}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Nová revize
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[120px] cursor-pointer select-none" onClick={() => toggleSort("title")}>
                  <span className="inline-flex items-center gap-1">Číslo revize <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead className="w-[120px]">Stav</TableHead>
                <TableHead>Zákazník</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("next_due_date")}>
                  <span className="inline-flex items-center gap-1">Datum <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead>Poznámka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ob => {
                const isSelected = selectedId === ob.id;
                const cName = (ob.customers as any)?.name || "—";
                return (
                  <TableRow
                    key={ob.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedId(isSelected ? null : ob.id)}
                    onDoubleClick={() => navigate(`/obligations/${ob.id}`)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{ob.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell><StatusBadge status={ob.status} /></TableCell>
                    <TableCell className="text-sm">{cName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ob.next_due_date ? format(new Date(ob.next_due_date), "d.M.yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {ob.title || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">Žádné revize</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-72 border-l bg-muted/20 flex flex-col shrink-0 overflow-auto">
        <div className="p-4 space-y-5">
          {/* Search */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hledat</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Hledat..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Filtry */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Filtry</h3>

            {/* Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={statusFilters.size > 0}
                  onCheckedChange={() => { if (statusFilters.size > 0) setStatusFilters(new Set()); }}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span className="text-sm font-medium">Stav</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(s => {
                  const active = statusFilters.has(s.value);
                  return (
                    <button
                      key={s.value}
                      onClick={() => toggleStatus(s.value)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold transition-all border ${
                        active
                          ? `${s.color} text-white border-transparent`
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Customer filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={customerFilters.size > 0}
                onCheckedChange={() => { if (customerFilters.size > 0) setCustomerFilters(new Set()); }}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm font-medium">Zákazník</span>
            </div>
            {customerFilters.size > 0 && (
              <div className="flex flex-wrap gap-1">
                {Array.from(customerFilters).map(name => (
                  <span key={name} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleCustomer(name)} />
                    {name}
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-28 overflow-auto space-y-0.5">
              {uniqueCustomers.map(name => (
                <button
                  key={name}
                  onClick={() => toggleCustomer(name)}
                  className={`block w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                    customerFilters.has(name) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox checked className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              <span className="text-sm font-medium">
                {format(calendarMonth, "LLLL", { locale: cs })}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">{format(calendarMonth, "yyyy")}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCalendarMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCalendarMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-[10px] font-medium text-muted-foreground py-0.5">{d}</div>
              ))}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const hasDue = dueDates.has(dateStr);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={dateStr}
                    className={`text-xs py-1 rounded transition-colors ${
                      isToday ? "bg-primary text-primary-foreground font-bold" :
                      hasDue ? "bg-destructive/20 text-destructive font-semibold" :
                      "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                );
              })}
            </div>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setStatusFilters(new Set()); setCustomerFilters(new Set()); }}>
              Zrušit všechny filtry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
