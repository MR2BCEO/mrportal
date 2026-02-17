import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

export default function SettingsPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [threshold, setThreshold] = useState("30");
  const [types, setTypes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("key", "due_soon_threshold_days").single()
      .then(({ data }) => { if (data) setThreshold(String(data.value)); });
    supabase.from("obligation_types").select("*").order("domain").order("code")
      .then(({ data }) => setTypes(data || []));
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

  const toggleType = async (id: string, isActive: boolean) => {
    await supabase.from("obligation_types").update({ is_active: !isActive }).eq("id", id);
    setTypes(prev => prev.map(t => t.id === id ? { ...t, is_active: !isActive } : t));
  };

  if (userRole !== "admin") {
    return <div className="p-8 text-center text-muted-foreground">Přístup pouze pro administrátory.</div>;
  }

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
        <CardHeader><CardTitle className="text-base">Katalog typů povinností</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {types.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{t.code} – {t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.domain} · {t.default_periodicity_months ? `${t.default_periodicity_months} měs.` : "bez periodicity"}
                  </p>
                </div>
                <Switch checked={t.is_active} onCheckedChange={() => toggleType(t.id, t.is_active)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
