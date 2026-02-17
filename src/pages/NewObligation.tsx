import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Check, Plus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const steps = ["Odběratel & Lokace", "Typ povinnosti", "Termíny & Dokument"];

export default function NewObligation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [assetId, setAssetId] = useState("");

  // New customer/location dialogs
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocAddress, setNewLocAddress] = useState("");
  const [newLocCity, setNewLocCity] = useState("");

  // Step 2
  const [obligationTypes, setObligationTypes] = useState<any[]>([]);
  const [domain, setDomain] = useState<string>("");
  const [typeId, setTypeId] = useState("");

  // Step 3
  const [performedDate, setPerformedDate] = useState("");
  const [periodicityMonths, setPeriodicityMonths] = useState<string>("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [findingsSummary, setFindingsSummary] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.from("customers").select("id, name").order("name").then(({ data }) => setCustomers(data || []));
    supabase.from("obligation_types").select("*").eq("is_active", true).order("domain").then(({ data }) => setObligationTypes(data || []));
  }, []);

  useEffect(() => {
    if (customerId) {
      supabase.from("locations").select("id, name").eq("customer_id", customerId).order("name").then(({ data }) => setLocations(data || []));
    } else {
      setLocations([]);
      setLocationId("");
    }
  }, [customerId]);

  useEffect(() => {
    if (locationId) {
      supabase.from("assets").select("id, name").eq("location_id", locationId).order("name").then(({ data }) => setAssets(data || []));
    } else {
      setAssets([]);
      setAssetId("");
    }
  }, [locationId]);

  useEffect(() => {
    if (typeId) {
      const t = obligationTypes.find(ot => ot.id === typeId);
      if (t) {
        setDomain(t.domain);
        if (t.default_periodicity_months && !periodicityMonths) {
          setPeriodicityMonths(String(t.default_periodicity_months));
        }
      }
    }
  }, [typeId]);

  const createCustomer = async () => {
    if (!newCustName.trim()) return;
    const { data, error } = await supabase.from("customers").insert({ name: newCustName.trim() }).select("id, name").single();
    if (data) {
      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomerId(data.id);
      setNewCustOpen(false);
      setNewCustName("");
    }
  };

  const createLocation = async () => {
    if (!newLocName.trim() || !customerId) return;
    const { data } = await supabase.from("locations").insert({
      name: newLocName.trim(),
      customer_id: customerId,
      address_line: newLocAddress || null,
      city: newLocCity || null,
    }).select("id, name").single();
    if (data) {
      setLocations(prev => [...prev, data]);
      setLocationId(data.id);
      setNewLocOpen(false);
      setNewLocName("");
      setNewLocAddress("");
      setNewLocCity("");
    }
  };

  const filteredTypes = domain
    ? obligationTypes.filter(t => t.domain === domain)
    : obligationTypes;

  const canNext = () => {
    if (step === 0) return customerId && locationId;
    if (step === 1) return typeId && domain;
    return true;
  };

  const selectedType = obligationTypes.find(t => t.id === typeId);
  const autoTitle = selectedType
    ? `${selectedType.name}${locations.find(l => l.id === locationId)?.name ? ` – ${locations.find(l => l.id === locationId)?.name}` : ""}`
    : "";

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: ob, error } = await supabase.from("obligations").insert({
        customer_id: customerId,
        location_id: locationId,
        asset_id: assetId || null,
        domain: domain as any,
        obligation_type_id: typeId,
        title: autoTitle,
        performed_date: performedDate || null,
        periodicity_months: periodicityMonths ? parseInt(periodicityMonths) : null,
        next_due_date: nextDueDate || null,
        responsible_user_id: user?.id,
        technician_name: technicianName || null,
        findings_summary: findingsSummary || null,
        status: "DRAFT",
      }).select("id").single();

      if (error) throw error;

      // Upload file if present
      if (file && ob) {
        const filePath = `${ob.id}/${Date.now()}_${file.name}`;
        await supabase.storage.from("documents").upload(filePath, file);
        await supabase.from("documents").insert({
          obligation_id: ob.id,
          file_url: filePath,
          file_name: file.name,
          file_type: file.type,
          uploaded_by_user_id: user?.id,
          doc_kind: file.type === "application/pdf" ? "REVIZNI_ZPRAVA" : "JINE",
        });
      }

      toast({ title: "Povinnost vytvořena" });
      navigate(`/obligations/${ob?.id}`);
    } catch (error: any) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/obligations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">Nová povinnost</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors",
              i === step ? "bg-primary text-primary-foreground" :
              i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn("text-sm hidden sm:block", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Customer & Location */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Odběratel & Lokace</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Odběratel *</Label>
              <div className="flex gap-2">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Vyberte odběratele" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
                  <DialogTrigger asChild><Button variant="outline" size="icon"><Plus className="w-4 h-4" /></Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nový odběratel</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Název" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
                      <Button onClick={createCustomer} className="w-full">Vytvořit</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lokace *</Label>
              <div className="flex gap-2">
                <Select value={locationId} onValueChange={setLocationId} disabled={!customerId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={customerId ? "Vyberte lokaci" : "Nejdříve vyberte odběratele"} /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Dialog open={newLocOpen} onOpenChange={setNewLocOpen}>
                  <DialogTrigger asChild><Button variant="outline" size="icon" disabled={!customerId}><Plus className="w-4 h-4" /></Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nová lokace</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Název" value={newLocName} onChange={e => setNewLocName(e.target.value)} />
                      <Input placeholder="Adresa" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)} />
                      <Input placeholder="Město" value={newLocCity} onChange={e => setNewLocCity(e.target.value)} />
                      <Button onClick={createLocation} className="w-full">Vytvořit</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {locationId && assets.length > 0 && (
              <div className="space-y-2">
                <Label>Zařízení (volitelně)</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger><SelectValue placeholder="Vyberte zařízení" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Žádné</SelectItem>
                    {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Domain & Type */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Typ povinnosti</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Doména *</Label>
              <Select value={domain} onValueChange={(v) => { setDomain(v); setTypeId(""); }}>
                <SelectTrigger><SelectValue placeholder="Vyberte doménu" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVIZE">Revize</SelectItem>
                  <SelectItem value="BOZP">BOZP</SelectItem>
                  <SelectItem value="PO">PO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Typ *</Label>
              <Select value={typeId} onValueChange={setTypeId} disabled={!domain}>
                <SelectTrigger><SelectValue placeholder="Vyberte typ" /></SelectTrigger>
                <SelectContent>
                  {filteredTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} – {t.name} {t.default_periodicity_months ? `(${t.default_periodicity_months} měs.)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Dates & Document */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Termíny & Dokument</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Název povinnosti</Label>
              <Input value={autoTitle} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datum provedení</Label>
                <Input type="date" value={performedDate} onChange={e => setPerformedDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Periodicita (měsíce)</Label>
                <Input type="number" value={periodicityMonths} onChange={e => setPeriodicityMonths(e.target.value)} placeholder="12" />
              </div>
              <div className="space-y-2">
                <Label>Příští termín (nepovinné)</Label>
                <Input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">Pokud nevyplníte, dopočítá se z data provedení + periodicita</p>
              </div>
              <div className="space-y-2">
                <Label>Technik</Label>
                <Input value={technicianName} onChange={e => setTechnicianName(e.target.value)} placeholder="Jméno technika" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Shrnutí závad / doporučení</Label>
              <Textarea value={findingsSummary} onChange={e => setFindingsSummary(e.target.value)} placeholder="Stručný popis..." />
            </div>
            <div className="space-y-2">
              <Label>Revizní zpráva (PDF/JPG/PNG)</Label>
              <div className="flex items-center gap-3">
                <Label htmlFor="wizard-file" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
                    <Upload className="w-4 h-4" />
                    {file ? file.name : "Vybrat soubor"}
                  </div>
                </Label>
                <input id="wizard-file" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate("/obligations")} >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 0 ? "Zpět" : "Předchozí"}
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Další <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving || !canNext()}>
            <Check className="w-4 h-4 mr-2" />
            {saving ? "Ukládání..." : "Vytvořit povinnost"}
          </Button>
        )}
      </div>
    </div>
  );
}
