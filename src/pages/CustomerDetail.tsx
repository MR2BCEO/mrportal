import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, DivisionBadge } from "@/components/StatusBadge";
import { ArrowLeft, MapPin, ClipboardCheck, Users, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("customers").select("*").eq("id", id).single().then(({ data }) => {
      setCustomer(data);
      if (data) setForm(data);
    });
    supabase.from("locations").select("*").eq("customer_id", id).order("name").then(({ data }) => setLocations(data || []));
    supabase.from("obligations").select("id, title, status, next_due_date, service_catalog(code, name, division), locations(name)").eq("customer_id", id).order("next_due_date").then(({ data }) => setObligations(data || []));
    supabase.from("contacts").select("*").eq("customer_id", id).order("is_primary", { ascending: false }).then(({ data }) => setContacts(data || []));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("customers").update({
      name: form.name,
      ico: form.ico || null,
      dic: form.dic || null,
      type: form.type,
      address_line: form.address_line || null,
      city: form.city || null,
      zip: form.zip || null,
      country: form.country || "CZ",
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      note: form.note || null,
    }).eq("id", id);
    setSaving(false);

    if (error) {
      toast({ title: "Chyba při ukládání", description: error.message, variant: "destructive" });
      return;
    }
    setCustomer(form);
    setEditing(false);
    toast({ title: "Odběratel uložen" });
  };

  const f = (field: string) => ({
    value: form[field] || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev: any) => ({ ...prev, [field]: e.target.value })),
  });

  if (!customer) return <div className="p-8 text-center text-muted-foreground">Načítání...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.ico ? `IČO: ${customer.ico}` : customer.type}</p>
          </div>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => { setForm(customer); setEditing(true); }}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Upravit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5 mr-1.5" />Zrušit
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Ukládání..." : "Uložit"}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Název *</Label>
                <Input {...f("name")} required />
              </div>
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={form.type || "firma"} onValueChange={v => setForm((prev: any) => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firma">Právnická osoba</SelectItem>
                    <SelectItem value="fo">Fyzická osoba</SelectItem>
                    <SelectItem value="instituce">Instituce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>IČO</Label>
                <Input {...f("ico")} />
              </div>
              <div className="space-y-1.5">
                <Label>DIČ</Label>
                <Input {...f("dic")} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_100px_1fr] gap-4">
              <div className="space-y-1.5">
                <Label>Ulice</Label>
                <Input {...f("address_line")} />
              </div>
              <div className="space-y-1.5">
                <Label>PSČ</Label>
                <Input {...f("zip")} />
              </div>
              <div className="space-y-1.5">
                <Label>Město</Label>
                <Input {...f("city")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input {...f("email")} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input {...f("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label>Web</Label>
                <Input {...f("website")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Poznámka</Label>
              <Textarea {...f("note")} rows={3} />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations"><MapPin className="w-3.5 h-3.5 mr-1.5" />Lokace ({locations.length})</TabsTrigger>
          <TabsTrigger value="obligations"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />Povinnosti ({obligations.length})</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" />Kontakty ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-4 space-y-3">
          {locations.map(loc => (
            <Card key={loc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/locations/${loc.id}`)}>
              <CardContent className="p-4">
                <p className="font-semibold">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{[loc.address_line, loc.city, loc.zip].filter(Boolean).join(", ")}</p>
              </CardContent>
            </Card>
          ))}
          {locations.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádné lokace</p>}
        </TabsContent>

        <TabsContent value="obligations" className="mt-4 space-y-3">
          {obligations.map((ob: any) => (
            <Card key={ob.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/obligations/${ob.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{ob.title}</p>
                  <p className="text-xs text-muted-foreground">{(ob.locations as any)?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(ob.service_catalog as any)?.division && <DivisionBadge division={(ob.service_catalog as any).division} />}
                  <StatusBadge status={ob.status} />
                </div>
              </CardContent>
            </Card>
          ))}
          {obligations.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádné povinnosti</p>}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-3">
          {contacts.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <p className="font-semibold">{c.name} {c.is_primary && <span className="text-xs text-primary">(primární)</span>}</p>
                <p className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              </CardContent>
            </Card>
          ))}
          {contacts.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádné kontakty</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
