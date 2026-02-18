import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [threshold, setThreshold] = useState("30");
  const [services, setServices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("key", "due_soon_threshold_days").single()
      .then(({ data }) => { if (data) setThreshold(String(data.value)); });
    supabase.from("service_catalog").select("*").order("division").order("group_name").order("code")
      .then(({ data }) => setServices(data || []));
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
