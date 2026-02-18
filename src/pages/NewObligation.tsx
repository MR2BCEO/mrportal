import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Check, Plus, Upload, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const steps = ["Odběratel & Lokace", "Služba", "Termíny & Dokument"];

interface ServiceItem {
  id: string;
  division: string;
  group_name: string;
  code: string;
  name: string;
}

interface CustomerItem {
  id: string;
  name: string;
  ico: string | null;
}

export default function NewObligation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const prefilledCustomer = searchParams.get("customer") || "";
  const prefilledLocation = searchParams.get("location") || "";
  const [step, setStep] = useState(prefilledCustomer && prefilledLocation ? 1 : 0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState(prefilledCustomer);
  const [locationId, setLocationId] = useState(prefilledLocation);
  const [assetId, setAssetId] = useState("");

  // New customer dialog - enhanced quick create
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustIco, setNewCustIco] = useState("");
  const [newCustDic, setNewCustDic] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustCity, setNewCustCity] = useState("");
  const [newCustZip, setNewCustZip] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustNote, setNewCustNote] = useState("");
  const [newCustContactName, setNewCustContactName] = useState("");
  const [newCustIcoDuplicate, setNewCustIcoDuplicate] = useState<CustomerItem | null>(null);

  // New location dialog
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocAddress, setNewLocAddress] = useState("");
  const [newLocCity, setNewLocCity] = useState("");
  const [newLocNameError, setNewLocNameError] = useState<string | null>(null);
  const [newLocCityError, setNewLocCityError] = useState<string | null>(null);

  // Step 2 - Service catalog
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [division, setDivision] = useState("");
  const [groupName, setGroupName] = useState("");
  const [serviceId, setServiceId] = useState("");

  // Step 3
  const [performedDate, setPerformedDate] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.from("customers").select("id, name, ico").order("name").then(({ data }) => setCustomers((data || []) as CustomerItem[]));
    supabase.from("service_catalog").select("*").eq("is_active", true).order("division").order("group_name").order("code")
      .then(({ data }) => setServices((data as any as ServiceItem[]) || []));
  }, []);

  useEffect(() => {
    if (customerId) {
      supabase.from("locations").select("id, name, city, address_line").eq("customer_id", customerId).order("name").then(({ data }) => setLocations(data || []));
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

  // IČO dedup for quick create
  const checkNewCustIco = useCallback(async (ico: string) => {
    if (!ico || ico.length < 4) { setNewCustIcoDuplicate(null); return; }
    const { data } = await supabase.from("customers").select("id, name, ico").eq("ico", ico).limit(1);
    setNewCustIcoDuplicate(data && data.length > 0 ? data[0] as CustomerItem : null);
  }, []);

  const divisions = useMemo(() => [...new Set(services.map(s => s.division))], [services]);
  const groups = useMemo(() => [...new Set(services.filter(s => s.division === division).map(s => s.group_name))], [services, division]);
  const filteredServices = useMemo(() => services.filter(s => s.division === division && s.group_name === groupName), [services, division, groupName]);

  const createCustomer = async () => {
    if (!newCustName.trim()) return;
    if (newCustIcoDuplicate) {
      // Use existing customer
      setCustomerId(newCustIcoDuplicate.id);
      setNewCustOpen(false);
      resetNewCustForm();
      return;
    }
    const { data } = await supabase.from("customers").insert({
      name: newCustName.trim(),
      ico: newCustIco.trim() || null,
      dic: newCustDic.trim() || null,
      address_line: newCustAddress.trim() || null,
      city: newCustCity.trim() || null,
      zip: newCustZip.trim() || null,
      phone: newCustPhone.trim() || null,
      email: newCustEmail.trim() || null,
      note: newCustNote.trim() || null,
    }).select("id, name, ico").single();
    if (data) {
      // Create contact if name provided
      if (newCustContactName.trim()) {
        await supabase.from("contacts").insert({
          customer_id: data.id,
          name: newCustContactName.trim(),
          phone: newCustPhone.trim() || null,
          email: newCustEmail.trim() || null,
          is_primary: true,
        });
      }
      setCustomers(prev => [...prev, data as CustomerItem].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomerId(data.id);
      setNewCustOpen(false);
      resetNewCustForm();
    }
  };

  const resetNewCustForm = () => {
    setNewCustName("");
    setNewCustIco("");
    setNewCustDic("");
    setNewCustAddress("");
    setNewCustCity("");
    setNewCustZip("");
    setNewCustPhone("");
    setNewCustEmail("");
    setNewCustNote("");
    setNewCustContactName("");
    setNewCustIcoDuplicate(null);
  };

  const createLocation = async () => {
    const nameErr = newLocName.trim().length < 3 ? "Název musí mít alespoň 3 znaky" : null;
    const cityErr = newLocCity.trim().length < 2 ? "Město musí mít alespoň 2 znaky" : null;
    setNewLocNameError(nameErr);
    setNewLocCityError(cityErr);
    if (nameErr || cityErr || !customerId) return;

    const { data, error } = await supabase.from("locations").insert({
      name: newLocName.trim(),
      customer_id: customerId,
      address_line: newLocAddress || null,
      city: newLocCity.trim(),
    }).select("id, name, city, address_line").single();
    if (error) {
      toast({ title: "Chyba", description: error.code === "23505" ? "Lokace s tímto názvem a městem již existuje" : "Nepodařilo se vytvořit lokaci", variant: "destructive" });
      return;
    }
    if (data) {
      setLocations(prev => [...prev, data]);
      setLocationId(data.id);
      setNewLocOpen(false);
      setNewLocName("");
      setNewLocAddress("");
      setNewLocCity("");
      setNewLocNameError(null);
      setNewLocCityError(null);
    }
  };

  const canNext = () => {
    if (step === 0) return customerId && locationId;
    if (step === 1) return serviceId;
    if (step === 2) return nextDueDate;
    return true;
  };

  const selectedService = services.find(s => s.id === serviceId);
  const autoTitle = selectedService
    ? `${selectedService.name}${locations.find(l => l.id === locationId)?.name ? ` – ${locations.find(l => l.id === locationId)?.name}` : ""}`
    : "";

  const getDomain = (div: string) => {
    if (div.includes("BOZP") || div.includes("požární")) return "BOZP";
    if (div.includes("Školení")) return "BOZP";
    return "REVIZE";
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const dedupeQuery = supabase.from("obligations")
        .select("id, title, status")
        .eq("service_id", serviceId)
        .eq("location_id", locationId)
        .eq("next_due_date", nextDueDate)
        .not("status", "in", '("ARCHIVED","DONE")');
      
      if (assetId) {
        dedupeQuery.eq("asset_id", assetId);
      } else {
        dedupeQuery.is("asset_id", null);
      }

      const { data: existing } = await dedupeQuery;
      if (existing && existing.length > 0) {
        const goToExisting = confirm(`Povinnost se stejným klíčem již existuje: "${existing[0].title}". Chcete otevřít existující záznam?`);
        if (goToExisting) {
          navigate(`/obligations/${existing[0].id}`);
          return;
        }
        setSaving(false);
        return;
      }

      const { data: ob, error } = await supabase.from("obligations").insert({
        customer_id: customerId,
        location_id: locationId,
        asset_id: assetId || null,
        domain: getDomain(division) as any,
        obligation_type_id: serviceId,
        service_id: serviceId,
        title: autoTitle,
        performed_date: performedDate || null,
        next_due_date: nextDueDate,
        responsible_user_id: user?.id,
        technician_name: technicianName || null,
        quantity: quantity ? parseInt(quantity) : null,
        findings_summary: note || null,
        status: "PLANNED",
      } as any).select("id").single();

      if (error) throw error;

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
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.ico ? ` (IČO: ${c.ico})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={newCustOpen} onOpenChange={(open) => { setNewCustOpen(open); if (!open) resetNewCustForm(); }}>
                  <DialogTrigger asChild><Button variant="outline" size="icon"><Plus className="w-4 h-4" /></Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Rychlé vytvoření odběratele</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Název firmy *</Label>
                        <Input placeholder="Sectron s.r.o." value={newCustName} onChange={e => setNewCustName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>IČO</Label>
                          <Input
                            placeholder="12345678"
                            value={newCustIco}
                            onChange={e => { setNewCustIco(e.target.value); checkNewCustIco(e.target.value.trim()); }}
                            className={newCustIcoDuplicate ? "border-destructive" : ""}
                          />
                          {newCustIcoDuplicate && (
                            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                              <div className="text-xs">
                                <p className="font-medium text-destructive">IČO již existuje: {newCustIcoDuplicate.name}</p>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => {
                                    setCustomerId(newCustIcoDuplicate!.id);
                                    setNewCustOpen(false);
                                    resetNewCustForm();
                                  }}
                                >
                                  Použít existujícího odběratele →
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label>DIČ</Label>
                          <Input placeholder="CZ12345678" value={newCustDic} onChange={e => setNewCustDic(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ulice</Label>
                        <Input placeholder="Josefa Šavla 1271/12" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-[1fr_100px] gap-3">
                        <div className="space-y-1.5">
                          <Label>Město</Label>
                          <Input placeholder="Mariánské Hory a Hulváky" value={newCustCity} onChange={e => setNewCustCity(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>PSČ</Label>
                          <Input placeholder="70900" value={newCustZip} onChange={e => setNewCustZip(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Kontaktní osoba</Label>
                        <Input placeholder="Jan Novák" value={newCustContactName} onChange={e => setNewCustContactName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Telefon</Label>
                          <Input placeholder="+420..." value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>E-mail</Label>
                          <Input placeholder="info@firma.cz" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Poznámka</Label>
                        <Input placeholder="Interní poznámka..." value={newCustNote} onChange={e => setNewCustNote(e.target.value)} />
                      </div>
                      <Button onClick={createCustomer} className="w-full" disabled={!newCustName.trim() || (!!newCustIcoDuplicate)}>
                        {newCustIcoDuplicate ? "Odběratel již existuje" : "Vytvořit"}
                      </Button>
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
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}{l.city ? `, ${l.city}` : ""}{l.address_line ? ` (${l.address_line})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={newLocOpen} onOpenChange={(open) => { setNewLocOpen(open); if (!open) { setNewLocNameError(null); setNewLocCityError(null); } }}>
                  <DialogTrigger asChild><Button variant="outline" size="icon" disabled={!customerId}><Plus className="w-4 h-4" /></Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nová lokace</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Název lokace *</Label>
                        <Input
                          placeholder="např. Provozovna Frýdek"
                          value={newLocName}
                          onChange={e => { setNewLocName(e.target.value); setNewLocNameError(e.target.value.trim().length < 3 ? "Min. 3 znaky" : null); }}
                          className={newLocNameError ? "border-destructive" : ""}
                        />
                        {newLocNameError && <p className="text-xs text-destructive">{newLocNameError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Město *</Label>
                        <Input
                          placeholder="Frýdek-Místek"
                          value={newLocCity}
                          onChange={e => { setNewLocCity(e.target.value); setNewLocCityError(e.target.value.trim().length < 2 ? "Min. 2 znaky" : null); }}
                          className={newLocCityError ? "border-destructive" : ""}
                        />
                        {newLocCityError && <p className="text-xs text-destructive">{newLocCityError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ulice</Label>
                        <Input placeholder="Hlavní 123" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)} />
                      </div>
                      <Button onClick={createLocation} className="w-full" disabled={!!newLocNameError || !!newLocCityError}>Vytvořit lokaci</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {locationId && assets.length > 0 && (
              <div className="space-y-2">
                <Label>Zařízení (volitelně)</Label>
                <Select value={assetId} onValueChange={(v) => setAssetId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Vyberte zařízení" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Žádné</SelectItem>
                    {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Service */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Služba (typ povinnosti)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Divize *</Label>
              <Select value={division} onValueChange={(v) => { setDivision(v); setGroupName(""); setServiceId(""); }}>
                <SelectTrigger><SelectValue placeholder="Vyberte divizi" /></SelectTrigger>
                <SelectContent>
                  {divisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {division && (
              <div className="space-y-2">
                <Label>Skupina *</Label>
                <Select value={groupName} onValueChange={(v) => { setGroupName(v); setServiceId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Vyberte skupinu" /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {groupName && (
              <div className="space-y-2">
                <Label>Služba *</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger><SelectValue placeholder="Vyberte službu" /></SelectTrigger>
                  <SelectContent>
                    {filteredServices.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} – {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <Label>Expirace / příští termín *</Label>
                <Input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">Přesné datum dle revizní zprávy – povinné pole</p>
              </div>
              <div className="space-y-2">
                <Label>Počet kusů</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="např. 45" min={1} />
              </div>
              <div className="space-y-2">
                <Label>Technik</Label>
                <Input value={technicianName} onChange={e => setTechnicianName(e.target.value)} placeholder="Jméno technika" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poznámka</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Stručný popis, poznámka ke zkrácené lhůtě atp." />
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
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate("/obligations")}>
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
