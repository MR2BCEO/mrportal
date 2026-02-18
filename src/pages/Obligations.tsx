import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Download, ArrowUpDown } from "lucide-react";
import { exportObligationsCSV } from "@/lib/exportCSV";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

// Map DB statuses to term-monitoring groups
const termGroup = (status: string) => {
  if (["DONE", "ACTIVE", "PLANNED"].includes(status)) return "valid";
  if (status === "DUE_SOON") return "expiring";
  if (status === "OVERDUE") return "expired";
  return "other";
};

export default function Obligations() {
  const [obligations, setObligations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("obligations")
      .select("id, title, status, next_due_date, performed_date, findings_summary, customers(name), locations(name), service_catalog(code, name, division, group_name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setObligations(data || []));
  }, []);

  const uniqueLocations = useMemo(() => {
    const names = new Set<string>();
    obligations.forEach(o => { const n = (o.locations as any)?.name; if (n) names.add(n); });
    return Array.from(names).sort();
  }, [obligations]);

  // Stats
  const stats = useMemo(() => {
    let valid = 0, expiring = 0, expired = 0;
    obligations.forEach(o => {
      const g = termGroup(o.status);
      if (g === "valid") valid++;
      else if (g === "expiring") expiring++;
      else if (g === "expired") expired++;
    });
    return { total: obligations.length, valid, expiring, expired };
  }, [obligations]);

  const filtered = obligations.filter(o => {
    // Status filter
    if (statusFilter === "valid" && termGroup(o.status) !== "valid") return false;
    if (statusFilter === "expiring" && termGroup(o.status) !== "expiring") return false;
    if (statusFilter === "expired" && termGroup(o.status) !== "expired") return false;
    // Location filter
    if (locationFilter !== "all" && (o.locations as any)?.name !== locationFilter) return false;
    // Search
    if (search) {
      const q = search.toLowerCase();
      if (!o.title.toLowerCase().includes(q) && !(o.customers as any)?.name?.toLowerCase().includes(q)) return false;
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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with stats chips */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Přehled vaší revizní agendy</p>
      </div>

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
      </div>

      {/* Table card */}
      <div className="bg-card rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Poslední nahrané revize</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Hledat..." className="pl-8 h-8 w-40 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[140px] text-sm">
                <SelectValue placeholder="Všechny stavy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny stavy</SelectItem>
                <SelectItem value="valid">Platná</SelectItem>
                <SelectItem value="expiring">Brzy expiruje</SelectItem>
                <SelectItem value="expired">Expirovaná</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="Všechny lokality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny lokality</SelectItem>
                {uniqueLocations.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ revize</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("performed_date")}>
                <span className="inline-flex items-center gap-1">Datum <ArrowUpDown className="w-3 h-3" /></span>
              </TableHead>
              <TableHead>Lokalita</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("next_due_date")}>
                <span className="inline-flex items-center gap-1">Platnost do <ArrowUpDown className="w-3 h-3" /></span>
              </TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="w-16">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(ob => (
              <TableRow
                key={ob.id}
                className="cursor-pointer h-10"
                onClick={() => navigate(`/obligations/${ob.id}`)}
              >
                <TableCell className="text-sm font-medium text-primary hover:underline">
                  {ob.title}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ob.performed_date ? format(new Date(ob.performed_date), "d. M. yyyy") : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {(ob.locations as any)?.name || "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={ob.status} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/obligations/${ob.id}`); }}>
                    Detail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Žádné revize</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
