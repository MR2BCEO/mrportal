import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Search, Plus, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

function validateLocationName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Název musí mít alespoň 3 znaky";
  if (/^[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{1,2}$/i.test(trimmed)) return "Název nemůže být jen 1–2 písmena";
  return null;
}

function validateCity(city: string): string | null {
  if (city.trim().length < 2) return "Město musí mít alespoň 2 znaky";
  return null;
}

export default function Locations() {
  const [locations, setLocations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formName, setFormName] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formZip, setFormZip] = useState("");
  const [formNote, setFormNote] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [duplicateLocation, setDuplicateLocation] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: locData }, { data: custData }] = await Promise.all([
      supabase.from("locations").select("*, customers(name)").order("name"),
      supabase.from("customers").select("id, name").order("name"),
    ]);
    if (locData) setLocations(locData);
    if (custData) setCustomers(custData);
  };

  const checkDuplicate = useCallback(async (customerId: string, name: string, city: string) => {
    if (!customerId || name.trim().length < 3 || city.trim().length < 2) {
      setDuplicateLocation(null);
      return;
    }
    const { data } = await supabase.from("locations")
      .select("id, name, city")
      .eq("customer_id", customerId)
      .ilike("name", name.trim())
      .ilike("city", city.trim())
      .limit(1);
    setDuplicateLocation(data && data.length > 0 ? data[0] : null);
  }, []);

  const resetForm = () => {
    setFormCustomerId("");
    setFormName("");
    setFormStreet("");
    setFormCity("");
    setFormZip("");
    setFormNote("");
    setNameError(null);
    setCityError(null);
    setDuplicateLocation(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ne = validateLocationName(formName);
    const ce = validateCity(formCity);
    setNameError(ne);
    setCityError(ce);
    if (ne || ce || !formCustomerId || duplicateLocation) return;

    setLoading(true);
    const { error } = await supabase.from("locations").insert({
      customer_id: formCustomerId,
      name: formName.trim(),
      address_line: formStreet.trim() || null,
      city: formCity.trim(),
      zip: formZip.trim() || null,
      note: formNote.trim() || null,
    });

    if (error) {
      toast({ title: "Chyba", description: error.code === "23505" ? "Lokace s tímto názvem a městem již existuje" : "Nepodařilo se vytvořit lokaci", variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Lokace vytvořena" });
    resetForm();
    setDialogOpen(false);
    setLoading(false);
    fetchData();
  };

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase()) ||
    (l.customers as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lokace</h1>
          <p className="text-muted-foreground text-sm">{locations.length} lokací</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Nová lokace</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nová lokace</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Odběratel *</Label>
                <Select value={formCustomerId} onValueChange={(v) => { setFormCustomerId(v); checkDuplicate(v, formName, formCity); }}>
                  <SelectTrigger><SelectValue placeholder="Vyberte odběratele" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Název lokace *</Label>
                <Input
                  value={formName}
                  onChange={e => {
                    setFormName(e.target.value);
                    setNameError(validateLocationName(e.target.value));
                    checkDuplicate(formCustomerId, e.target.value, formCity);
                  }}
                  placeholder="např. Provozovna Frýdek"
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>

              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div className="space-y-1.5">
                  <Label>Město *</Label>
                  <Input
                    value={formCity}
                    onChange={e => {
                      setFormCity(e.target.value);
                      setCityError(validateCity(e.target.value));
                      checkDuplicate(formCustomerId, formName, e.target.value);
                    }}
                    placeholder="Frýdek-Místek"
                    className={cityError ? "border-destructive" : ""}
                  />
                  {cityError && <p className="text-xs text-destructive">{cityError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>PSČ</Label>
                  <Input value={formZip} onChange={e => setFormZip(e.target.value)} placeholder="73801" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Ulice</Label>
                <Input value={formStreet} onChange={e => setFormStreet(e.target.value)} placeholder="Hlavní 123" />
              </div>

              <div className="space-y-1.5">
                <Label>Poznámka</Label>
                <Input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Volitelná poznámka" />
              </div>

              {duplicateLocation && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-destructive">
                      Lokace "{duplicateLocation.name}" v městě {duplicateLocation.city} již existuje
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => { setDialogOpen(false); navigate(`/locations/${duplicateLocation.id}`); }}
                    >
                      Otevřít existující lokaci →
                    </Button>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !!duplicateLocation || !!nameError || !!cityError || !formCustomerId}>
                {loading ? "Ukládání..." : "Vytvořit lokaci"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Hledat lokace..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filtered.map(l => {
          const addr = [l.address_line, l.city, l.zip].filter(Boolean).join(", ");
          return (
            <Card key={l.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/locations/${l.id}`)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(l.customers as any)?.name}{addr ? ` · ${addr}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Žádné lokace</p>}
      </div>
    </div>
  );
}
