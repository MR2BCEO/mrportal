import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, DivisionBadge } from "@/components/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Box, ClipboardCheck, FileSpreadsheet, Pencil, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DMRevizeImport from "@/components/DMRevizeImport";

export default function LocationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [location, setLocation] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", address_line: "", city: "", zip: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = () => {
    supabase.from("locations").select("*, customers(name, id)").eq("id", id!).single().then(({ data }) => {
      setLocation(data);
      if (data) setForm({ name: data.name, address_line: data.address_line || "", city: data.city || "", zip: data.zip || "", note: data.note || "" });
    });
    supabase.from("assets").select("*").eq("location_id", id!).order("name").then(({ data }) => setAssets(data || []));
    supabase.from("obligations").select("id, title, status, next_due_date, service_catalog(code, name, division)").eq("location_id", id!).order("next_due_date").then(({ data }) => setObligations(data || []));
  };

  const handleSave = async () => {
    if (form.name.trim().length < 3) {
      toast({ title: "Chyba", description: "Název musí mít alespoň 3 znaky.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("locations").update({
      name: form.name.trim(),
      address_line: form.address_line.trim() || null,
      city: form.city.trim() || null,
      zip: form.zip.trim() || null,
      note: form.note.trim() || null,
    }).eq("id", id!);
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo" });
    setEditing(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (obligations.length > 0 || assets.length > 0) {
      toast({ title: "Nelze smazat", description: "Lokace má přiřazené povinnosti nebo zařízení.", variant: "destructive" });
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("locations").delete().eq("id", id!);
    setDeleting(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lokace smazána" });
    navigate("/locations");
  };

  if (!location) return <div className="p-8 text-center text-muted-foreground">Načítání...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/locations")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{location.name}</h1>
            <p className="text-sm text-muted-foreground">{(location.customers as any)?.name} · {[location.address_line, location.city, location.zip].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Upravit
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Smazat
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Smazat lokaci?</AlertDialogTitle>
                <AlertDialogDescription>
                  {obligations.length > 0 || assets.length > 0
                    ? `Tato lokace má ${obligations.length} povinností a ${assets.length} zařízení. Nejdříve je odstraňte.`
                    : "Tato akce je nevratná. Lokace bude trvale odstraněna."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting || obligations.length > 0 || assets.length > 0}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Mazání..." : "Smazat"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {editing && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Název *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Ulice</Label><Input value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} /></div>
              <div><Label>Město</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>PSČ</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            </div>
            <div><Label>Poznámka</Label><Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} /></div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}><Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Ukládání..." : "Uložit"}</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setForm({ name: location.name, address_line: location.address_line || "", city: location.city || "", zip: location.zip || "", note: location.note || "" }); }}>
                <X className="w-3.5 h-3.5 mr-1.5" />Zrušit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="obligations">
        <TabsList>
          <TabsTrigger value="obligations"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />Povinnosti ({obligations.length})</TabsTrigger>
          <TabsTrigger value="assets"><Box className="w-3.5 h-3.5 mr-1.5" />Zařízení ({assets.length})</TabsTrigger>
          <TabsTrigger value="import"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />Import</TabsTrigger>
        </TabsList>

        <TabsContent value="obligations" className="mt-4 space-y-3">
          {obligations.map((ob: any) => (
            <Card key={ob.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/obligations/${ob.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <p className="font-semibold">{ob.title}</p>
                <div className="flex items-center gap-2">
                  {(ob.service_catalog as any)?.division && <DivisionBadge division={(ob.service_catalog as any).division} />}
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
                <p className="text-xs text-muted-foreground">
                  {[a.room && `Místnost: ${a.room}`, a.manufacturer, a.serial_number, a.inventory_no && `Inv: ${a.inventory_no}`].filter(Boolean).join(" · ")}
                </p>
              </CardContent>
            </Card>
          ))}
          {assets.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádná zařízení</p>}
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <DMRevizeImport
            locationId={id!}
            customerId={(location.customers as any)?.id}
            onComplete={fetchData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
