import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Locations() {
  const [locations, setLocations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("locations").select("*, customers(name)").order("name")
      .then(({ data }) => setLocations(data || []));
  }, []);

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Lokace</h1>
        <p className="text-muted-foreground text-sm">{locations.length} lokací</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Hledat lokace..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filtered.map(l => (
          <Card key={l.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/locations/${l.id}`)}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(l.customers as any)?.name} · {[l.address_line, l.city].filter(Boolean).join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Žádné lokace</p>}
      </div>
    </div>
  );
}
