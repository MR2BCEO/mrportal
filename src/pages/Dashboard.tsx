import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, DivisionBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, HelpCircle, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchObligations();
  }, []);

  const fetchObligations = async () => {
    const { data, error } = await supabase
      .from("obligations")
      .select("id, title, status, next_due_date, performed_date, customers(name), locations(name), service_catalog(code, name, division)")
      .not("status", "in", '("ARCHIVED","DONE")')
      .order("next_due_date", { ascending: true, nullsFirst: false });
    if (!error && data) setObligations(data as unknown as ObligationRow[]);
    setLoading(false);
  };

  const counts = {
    OVERDUE: obligations.filter(o => o.status === "OVERDUE").length,
    DUE_SOON: obligations.filter(o => o.status === "DUE_SOON").length,
    NEEDS_INFO: obligations.filter(o => o.status === "NEEDS_INFO").length,
  };

  const filtered = statusFilter
    ? obligations.filter(o => o.status === statusFilter)
    : obligations;

  const kpiCards = [
    { key: "OVERDUE", label: "Po termínu", count: counts.OVERDUE, icon: AlertTriangle, color: "text-[hsl(var(--status-overdue))]" },
    { key: "DUE_SOON", label: "Brzy vyprší", count: counts.DUE_SOON, icon: Clock, color: "text-[hsl(var(--status-due-soon))]" },
    { key: "NEEDS_INFO", label: "Chybí údaje", count: counts.NEEDS_INFO, icon: HelpCircle, color: "text-[hsl(var(--status-needs-info))]" },
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
                    <th className="text-left p-3 font-medium text-muted-foreground">Lokace</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Expirace</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ob => (
                    <tr
                      key={ob.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/obligations/${ob.id}`)}
                    >
                      <td className="p-3 font-medium">{ob.title}</td>
                      <td className="p-3">
                        {ob.service_catalog ? (
                          <DivisionBadge division={ob.service_catalog.division} />
                        ) : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{ob.customers?.name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{ob.locations?.name || "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {ob.next_due_date ? format(new Date(ob.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}
                      </td>
                      <td className="p-3"><StatusBadge status={ob.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
