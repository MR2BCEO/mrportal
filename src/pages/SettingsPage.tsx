import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Technician {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  is_active: boolean;
}

export default function SettingsPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [threshold, setThreshold] = useState("30");
  const [services, setServices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Technicians
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techDialogOpen, setTechDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [techForm, setTechForm] = useState({ name: "", company: "", phone: "", email: "", note: "" });
  const [savingTech, setSavingTech] = useState(false);

  const fetchTechnicians = () => {
    supabase.from("technicians").select("*").order("name")
      .then(({ data }) => setTechnicians((data as unknown as Technician[]) || []));
  };

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("key", "due_soon_threshold_days").single()
      .then(({ data }) => { if (data) setThreshold(String(data.value)); });
    supabase.from("service_catalog").select("*").order("division").order("group_name").order("code")
      .then(({ data }) => setServices(data || []));
    fetchTechnicians();
  }, []);

  const saveThreshold = async () => {
    setSaving(true);
    const val = parseInt(threshold);
    if (isNaN(val) || val < 1) {
      toast({ title: "Neplatná hodnota", variant: "destructive" });
      setSaving(false);
      return;
    }
    await supabase.from("app_settings").update({ value: val as any }).eq("key", "due_soon_threshold_days");
    toast({ title: "Uloženo" });
    setSaving(false);
  };

  const toggleService = async (id: string, isActive: boolean) => {
    await supabase.from("service_catalog").update({ is_active: !isActive } as any).eq("id", id);
    setServices(prev => prev.map(s => s.id === id ? { ...s, is_active: !isActive } : s));
  };

  const openNewTech = () => {
    setEditingTech(null);
    setTechForm({ name: "", company: "", phone: "", email: "", note: "" });
    setTechDialogOpen(true);
  };

  const openEditTech = (t: Technician) => {
    setEditingTech(t);
    setTechForm({ name: t.name, company: t.company || "", phone: t.phone || "", email: t.email || "", note: t.note || "" });
    setTechDialogOpen(true);
  };

  const saveTechnician = async () => {
    if (!techForm.name.trim()) return;
    setSavingTech(true);
    const payload = {
      name: techForm.name.trim(),
      company: techForm.company.trim() || null,
      phone: techForm.phone.trim() || null,
      email: techForm.email.trim() || null,
      note: techForm.note.trim() || null,
    };
    if (editingTech) {
      await supabase.from("technicians").update(payload as any).eq("id", editingTech.id);
    } else {
      await supabase.from("technicians").insert(payload as any);
    }
    toast({ title: editingTech ? "Technik upraven" : "Technik přidán" });
    setTechDialogOpen(false);
    setSavingTech(false);
    fetchTechnicians();
  };

  const deleteTechnician = async (id: string) => {
    if (!confirm("Opravdu smazat tohoto technika?")) return;
    await supabase.from("technicians").delete().eq("id", id);
    toast({ title: "Technik smazán" });
    fetchTechnicians();
  };

  const toggleTechActive = async (t: Technician) => {
    await supabase.from("technicians").update({ is_active: !t.is_active } as any).eq("id", t.id);
    setTechnicians(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x));
  };

  if (userRole !== "admin") {
    return <div className="p-8 text-center text-muted-foreground">Přístup pouze pro administrátory.</div>;
  }

  // Group services by division > group_name
  const grouped: Record<string, Record<string, any[]>> = {};
  services.forEach(s => {
    if (!grouped[s.division]) grouped[s.division] = {};
    if (!grouped[s.division][s.group_name]) grouped[s.division][s.group_name] = [];
    grouped[s.division][s.group_name].push(s);
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Nastavení</h1>
        <p className="text-muted-foreground text-sm">Konfigurace systému</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Práh "brzy vyprší"</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} className="w-24" min={1} />
            <span className="text-sm text-muted-foreground">dní</span>
            <Button size="sm" onClick={saveThreshold} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />Uložit
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Povinnosti s termínem do tohoto počtu dní budou označeny jako "brzy vyprší".</p>
        </CardContent>
      </Card>

      {/* Technicians */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Revizní technici</CardTitle>
            <Button size="sm" onClick={openNewTech}><Plus className="w-3.5 h-3.5 mr-1" />Přidat</Button>
          </div>
        </CardHeader>
        <CardContent>
          {technicians.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Zatím žádní technici. Klikněte Přidat.</p>
          ) : (
            <div className="space-y-2">
              {technicians.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[t.company, t.phone, t.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleTechActive(t)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTech(t)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTechnician(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technician dialog */}
      <Dialog open={techDialogOpen} onOpenChange={setTechDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTech ? "Upravit technika" : "Nový technik"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Jméno *</Label>
              <Input value={techForm.name} onChange={e => setTechForm(f => ({ ...f, name: e.target.value }))} placeholder="Jiří Štěrba" />
            </div>
            <div className="space-y-1.5">
              <Label>Firma</Label>
              <Input value={techForm.company} onChange={e => setTechForm(f => ({ ...f, company: e.target.value }))} placeholder="Revize s.r.o." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input value={techForm.phone} onChange={e => setTechForm(f => ({ ...f, phone: e.target.value }))} placeholder="+420..." />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={techForm.email} onChange={e => setTechForm(f => ({ ...f, email: e.target.value }))} placeholder="technik@firma.cz" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Poznámka</Label>
              <Input value={techForm.note} onChange={e => setTechForm(f => ({ ...f, note: e.target.value }))} placeholder="Specialista na elektro..." />
            </div>
            <Button onClick={saveTechnician} className="w-full" disabled={!techForm.name.trim() || savingTech}>
              {savingTech ? "Ukládání..." : editingTech ? "Uložit změny" : "Přidat technika"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="text-base">Katalog služeb</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(grouped).map(([division, groups]) => (
              <div key={division}>
                <h3 className="font-semibold text-sm mb-3 text-primary">{division}</h3>
                {Object.entries(groups).map(([group, items]) => (
                  <div key={group} className="mb-4">
                    <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">{group}</p>
                    <div className="space-y-2">
                      {items.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{s.code} – {s.name}</p>
                          </div>
                          <Switch checked={s.is_active} onCheckedChange={() => toggleService(s.id, s.is_active)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
