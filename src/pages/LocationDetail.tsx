import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, DomainBadge } from "@/components/StatusBadge";
import { ArrowLeft, Box, ClipboardCheck } from "lucide-react";

export default function LocationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase.from("locations").select("*, customers(name)").eq("id", id).single().then(({ data }) => setLocation(data));
    supabase.from("assets").select("*").eq("location_id", id).order("name").then(({ data }) => setAssets(data || []));
    supabase.from("obligations").select("id, title, domain, status, next_due_date, obligation_types(code, name)").eq("location_id", id).order("next_due_date").then(({ data }) => setObligations(data || []));
  }, [id]);

  if (!location) return <div className="p-8 text-center text-muted-foreground">Načítání...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/locations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{location.name}</h1>
          <p className="text-sm text-muted-foreground">{(location.customers as any)?.name} · {[location.address_line, location.city, location.zip].filter(Boolean).join(", ")}</p>
        </div>
      </div>

      <Tabs defaultValue="obligations">
        <TabsList>
          <TabsTrigger value="obligations"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />Povinnosti ({obligations.length})</TabsTrigger>
          <TabsTrigger value="assets"><Box className="w-3.5 h-3.5 mr-1.5" />Zařízení ({assets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="obligations" className="mt-4 space-y-3">
          {obligations.map((ob: any) => (
            <Card key={ob.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/obligations/${ob.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <p className="font-semibold">{ob.title}</p>
                <div className="flex items-center gap-2">
                  <DomainBadge domain={ob.domain} />
                  <StatusBadge status={ob.status} />
                </div>
              </CardContent>
            </Card>
          ))}
          {obligations.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádné povinnosti</p>}
        </TabsContent>

        <TabsContent value="assets" className="mt-4 space-y-3">
          {assets.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{[a.category, a.manufacturer, a.serial_number].filter(Boolean).join(" · ")}</p>
              </CardContent>
            </Card>
          ))}
          {assets.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádná zařízení</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
