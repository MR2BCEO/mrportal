import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Download, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

const DEFAULT_THRESHOLD_DAYS = 30;

// Compute term group from next_due_date (NOT from DB status)
function computeTermGroup(nextDueDate: string | null, thresholdDays: number): "valid" | "expiring" | "expired" | "needs_info" {
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

const termGroupLabel: Record<string, string> = {
  valid: "Platná",
  expiring: "Brzy expiruje",
  expired: "Expirovaná",
  needs_info: "Chybí údaje",
};

export default function Obligations() {
  const [obligations, setObligations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [thresholdDays, setThresholdDays] = useState(DEFAULT_THRESHOLD_DAYS);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("obligations")
      .select("id, title, status, next_due_date, performed_date, findings_summary, customers(name), locations(name), service_catalog(code, name, division, group_name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setObligations(data || []));

    // Load threshold from settings
    supabase.from("app_settings").select("value").eq("key", "due_soon_threshold_days").single()
      .then(({ data }) => {
        if (data) {
          const val = parseInt(String(data.value));
          if (!isNaN(val) && val > 0) setThresholdDays(val);
        }
      });
  }, []);

  // Unique values for filter dropdowns
  const uniqueCustomers = useMemo(() => {
    const names = new Set<string>();
    obligations.forEach(o => { const n = (o.customers as any)?.name; if (n) names.add(n); });
    return Array.from(names).sort();
  }, [obligations]);

  const uniqueLocations = useMemo(() => {
    const names = new Set<string>();
    obligations.forEach(o => { const n = (o.locations as any)?.name; if (n) names.add(n); });
    return Array.from(names).sort();
  }, [obligations]);

  const uniqueServices = useMemo(() => {
    const map = new Map<string, string>();
    obligations.forEach(o => {
      const sc = o.service_catalog as any;
      if (sc?.code) map.set(sc.code, `${sc.code} – ${sc.name}`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [obligations]);

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    obligations.forEach(o => {
      if (o.next_due_date) {
        const d = new Date(o.next_due_date);
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    });
    return Array.from(set).sort();
  }, [obligations]);

  // Stats computed from next_due_date
  const stats = useMemo(() => {
    let valid = 0, expiring = 0, expired = 0, needsInfo = 0;
    obligations.forEach(o => {
      const g = computeTermGroup(o.next_due_date, thresholdDays);
      if (g === "valid") valid++;
      else if (g === "expiring") expiring++;
      else if (g === "expired") expired++;
      else if (g === "needs_info") needsInfo++;
    });
    return { total: obligations.length, valid, expiring, expired, needsInfo };
  }, [obligations, thresholdDays]);

  const filtered = obligations.filter(o => {
    const group = computeTermGroup(o.next_due_date, thresholdDays);
    // Status chip filter
    if (statusFilter === "valid" && group !== "valid") return false;
    if (statusFilter === "expiring" && group !== "expiring") return false;
    if (statusFilter === "expired" && group !== "expired") return false;
    if (statusFilter === "needs_info" && group !== "needs_info") return false;
    // Customer filter
    if (customerFilter !== "all" && (o.customers as any)?.name !== customerFilter) return false;
    // Location filter
    if (locationFilter !== "all" && (o.locations as any)?.name !== locationFilter) return false;
    // Service filter
    if (serviceFilter !== "all" && (o.service_catalog as any)?.code !== serviceFilter) return false;
    // Month filter
    if (monthFilter !== "all" && o.next_due_date) {
      const d = new Date(o.next_due_date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (ym !== monthFilter) return false;
    } else if (monthFilter !== "all" && !o.next_due_date) {
      return false;
    }
    // Search
    if (search) {
      const q = search.toLowerCase();
      const title = o.title?.toLowerCase() || "";
      const customer = (o.customers as any)?.name?.toLowerCase() || "";
      const location = (o.locations as any)?.name?.toLowerCase() || "";
      if (!title.includes(q) && !customer.includes(q) && !location.includes(q)) return false;
    }
    return true;
  });

  const [sortField, setSortField] = useState<"performed_date" | "next_due_date">("next_due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortField] || "";
    const vb = b[sortField] || "";
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  // Export filtered data to CSV
  const handleExportCSV = () => {
    if (sorted.length === 0) {
      alert("Žádná data k exportu");
      return;
    }

    const headers = ["Odběratel", "Lokalita", "Služba", "Datum provedení", "Platnost do", "Stav"];
    const rows = sorted.map(ob => {
      const group = computeTermGroup(ob.next_due_date, thresholdDays);
      const sc = ob.service_catalog as any;
      return [
        (ob.customers as any)?.name || "",
        (ob.locations as any)?.name || "",
        sc ? `${sc.code} – ${sc.name}` : ob.title,
        ob.performed_date ? format(new Date(ob.performed_date), "d.M.yyyy") : "",
        ob.next_due_date ? format(new Date(ob.next_due_date), "d.M.yyyy") : "",
        termGroupLabel[group] || group,
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revize_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    const monthNames = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
    return `${monthNames[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* A) Fixed heading */}
      <div>
        <h1 className="text-2xl font-bold">Revize</h1>
        <p className="text-sm text-muted-foreground">Přehled a hlídání termínů revizní agendy</p>
      </div>

      {/* D) Status chips as filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            statusFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-muted text-foreground border-border hover:bg-muted/80"
          }`}
        >
          Celkem <span className="font-bold ml-1">{stats.total}</span>
        </button>
        <button
          onClick={() => setStatusFilter("valid")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            statusFilter === "valid" ? "bg-green-600 text-white border-green-600" : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          }`}
        >
          Platné <span className="font-bold ml-1">{stats.valid}</span>
        </button>
        <button
          onClick={() => setStatusFilter("expiring")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            statusFilter === "expiring" ? "bg-yellow-500 text-white border-yellow-500" : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
          }`}
        >
          Brzy expiruje <span className="font-bold ml-1">{stats.expiring}</span>
        </button>
        <button
          onClick={() => setStatusFilter("expired")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            statusFilter === "expired" ? "bg-red-600 text-white border-red-600" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
          }`}
        >
          Expirované <span className="font-bold ml-1">{stats.expired}</span>
        </button>
        {stats.needsInfo > 0 && (
          <button
            onClick={() => setStatusFilter("needs_info")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              statusFilter === "needs_info" ? "bg-gray-600 text-white border-gray-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
          >
            Chybí údaje <span className="font-bold ml-1">{stats.needsInfo}</span>
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="bg-card rounded-lg border">
        {/* C) Filters toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
          <h2 className="text-sm font-semibold mr-auto">Seznam revizí</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Hledat..." className="pl-8 h-8 w-40 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Odběratel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všichni odběratelé</SelectItem>
              {uniqueCustomers.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Lokalita" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny lokality</SelectItem>
              {uniqueLocations.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-8 w-[170px] text-sm">
              <SelectValue placeholder="Služba" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny služby</SelectItem>
              {uniqueServices.map(([code, label]) => (
                <SelectItem key={code} value={code}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Expirace měsíc" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny měsíce</SelectItem>
              {uniqueMonths.map(ym => (
                <SelectItem key={ym} value={ym}>{formatMonth(ym)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue placeholder="Stav" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="valid">Platná</SelectItem>
              <SelectItem value="expiring">Brzy expiruje</SelectItem>
              <SelectItem value="expired">Expirovaná</SelectItem>
              <SelectItem value="needs_info">Chybí údaje</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />Export CSV
          </Button>
          <Button size="sm" className="h-8" onClick={() => navigate("/obligations/new")}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Nová revize
          </Button>
        </div>

        {/* B) Table with correct columns */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Odběratel</TableHead>
              <TableHead>Lokalita</TableHead>
              <TableHead>Služba</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("performed_date")}>
                <span className="inline-flex items-center gap-1">
                  Datum provedení
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("next_due_date")}>
                <span className="inline-flex items-center gap-1">
                  Platnost do
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="w-16">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(ob => {
              const group = computeTermGroup(ob.next_due_date, thresholdDays);
              const sc = ob.service_catalog as any;
              return (
                <TableRow
                  key={ob.id}
                  className="cursor-pointer h-10"
                  onClick={() => navigate(`/obligations/${ob.id}`)}
                >
                  <TableCell className="text-sm">
                    {(ob.customers as any)?.name || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(ob.locations as any)?.name || "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {sc ? `${sc.code} – ${sc.name}` : ob.title}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ob.performed_date ? format(new Date(ob.performed_date), "d. M. yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={
                      group === "valid" ? "PLANNED" :
                      group === "expiring" ? "DUE_SOON" :
                      group === "expired" ? "OVERDUE" :
                      "NEEDS_INFO"
                    } />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/obligations/${ob.id}`); }}>
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">Žádné revize</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
