import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge, DivisionBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ClipboardCheck, Download } from "lucide-react";
import { exportObligationsCSV } from "@/lib/exportCSV";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export default function Obligations() {
  const [obligations, setObligations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("obligations")
      .select("id, title, status, next_due_date, performed_date, customers(name), locations(name), service_catalog(code, name, division, group_name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setObligations(data || []));
  }, []);

  const filtered = obligations.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (divisionFilter !== "all" && (o.service_catalog as any)?.division !== divisionFilter) return false;
    if (search && !o.title.toLowerCase().includes(search.toLowerCase()) && !(o.customers as any)?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Povinnosti</h1>
          <p className="text-muted-foreground text-sm">{obligations.length} záznamů</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            const count = await exportObligationsCSV();
            if (!count) alert("Žádná data k exportu");
          }}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
          <Button onClick={() => navigate("/obligations/new")}>
            <Plus className="w-4 h-4 mr-2" />Nová povinnost
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hledat..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Divize" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny divize</SelectItem>
            <SelectItem value="Revize a inspekce">Revize a inspekce</SelectItem>
            <SelectItem value="BOZP a požární ochrana">BOZP a požární ochrana</SelectItem>
            <SelectItem value="Školení a certifikace">Školení a certifikace</SelectItem>
            <SelectItem value="Technická správa budov">Technická správa budov</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vše</SelectItem>
            <SelectItem value="OVERDUE">Po termínu</SelectItem>
            <SelectItem value="DUE_SOON">Brzy</SelectItem>
            <SelectItem value="PLANNED">Plánováno</SelectItem>
            <SelectItem value="IN_PROGRESS">Probíhá</SelectItem>
            <SelectItem value="DONE">Hotovo</SelectItem>
            <SelectItem value="NEEDS_INFO">Chybí údaje</SelectItem>
            <SelectItem value="ARCHIVED">Archiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map(ob => (
          <Card key={ob.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/obligations/${ob.id}`)}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{ob.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(ob.customers as any)?.name} · {(ob.locations as any)?.name}
                    {(ob.service_catalog as any)?.code ? ` · ${(ob.service_catalog as any).code}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}
                </span>
                {(ob.service_catalog as any)?.division && <DivisionBadge division={(ob.service_catalog as any).division} />}
                <StatusBadge status={ob.status} />
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Žádné povinnosti</p>
        )}
      </div>
    </div>
  );
}
