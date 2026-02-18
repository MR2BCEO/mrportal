import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ArrowUpDown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  type: string;
  note: string | null;
  billing_address: string | null;
  address_line: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  created_at: string;
}

interface Contact {
  customer_id: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

type SortField = "name" | "ico";
type SortDir = "asc" | "desc";

const emptyForm = {
  name: "", ico: "", dic: "", type: "firma",
  address_line: "", city: "", zip: "", country: "CZ",
  email: "", phone: "", website: "", note: "",
  // Contact tab
  contact_name: "", contact_role: "", contact_email: "", contact_phone: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterIco, setFilterIco] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: cData }, { data: conData }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("contacts").select("customer_id, phone, email, is_primary").eq("is_primary", true),
    ]);
    if (cData) setCustomers(cData);
    if (conData) setContacts(conData);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: customer, error } = await supabase.from("customers").insert({
      name: form.name,
      ico: form.ico || null,
      dic: form.dic || null,
      type: form.type as any,
      address_line: form.address_line || null,
      city: form.city || null,
      zip: form.zip || null,
      country: form.country || "CZ",
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      note: form.note || null,
    }).select("id").single();

    if (error) {
      setLoading(false);
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    // Create primary contact if name provided
    if (customer && form.contact_name) {
      await supabase.from("contacts").insert({
        customer_id: customer.id,
        name: form.contact_name,
        role_title: form.contact_role || null,
        email: form.contact_email || null,
        phone: form.contact_phone || null,
        is_primary: true,
      });
    }

    setLoading(false);
    toast({ title: "Zákazník vytvořen" });
    setForm({ ...emptyForm });
    setDialogOpen(false);
    fetchData();
  };

  const getContact = (customerId: string) => contacts.find(c => c.customer_id === customerId);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = customers
    .filter(c => {
      const con = getContact(c.id);
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.ico?.includes(search);
      const matchName = !filterName || c.name.toLowerCase().includes(filterName.toLowerCase());
      const matchIco = !filterIco || c.ico?.includes(filterIco);
      const matchPhone = !filterPhone || con?.phone?.includes(filterPhone) || c.phone?.includes(filterPhone);
      return matchSearch && matchName && matchIco && matchPhone;
    })
    .sort((a, b) => {
      const valA = (a[sortField] || "").toLowerCase();
      const valB = (b[sortField] || "").toLowerCase();
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

  const selected = selectedId ? customers.find(c => c.id === selectedId) : null;
  const selectedContact = selectedId ? getContact(selectedId) : null;
  const hasActiveFilters = filterName || filterIco || filterPhone;

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  return (
    <div className="flex gap-0 animate-fade-in h-[calc(100vh-4rem)]">
      {/* Main table area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Zákazníci</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Hledat..." className="pl-8 h-8 w-48 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8"><Plus className="w-3.5 h-3.5 mr-1.5" />Nový zákazník</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Vytvořit zákazníka</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  {/* Name at top */}
                  <div className="space-y-1.5">
                    <Label>Název *</Label>
                    <Input {...f("name")} required placeholder="Název firmy / jméno" />
                  </div>

                  <Tabs defaultValue="zakladni" className="w-full">
                    <TabsList className="w-full">
                      <TabsTrigger value="zakladni" className="flex-1">Základní</TabsTrigger>
                      <TabsTrigger value="kontakty" className="flex-1">Kontakty</TabsTrigger>
                      <TabsTrigger value="popis" className="flex-1">Popis</TabsTrigger>
                    </TabsList>

                    <TabsContent value="zakladni" className="space-y-4 mt-4">
                      {/* IČO / DIČ */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>IČO</Label>
                          <Input {...f("ico")} placeholder="12345678" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>DIČ</Label>
                          <Input {...f("dic")} placeholder="CZ12345678" />
                        </div>
                      </div>

                      {/* Type */}
                      <div className="space-y-1.5">
                        <Label>Typ subjektu</Label>
                        <div className="flex items-center gap-4">
                          {[
                            { value: "firma", label: "Právnická osoba" },
                            { value: "fo", label: "Fyzická osoba" },
                            { value: "instituce", label: "Instituce" },
                          ].map(opt => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={form.type === opt.value}
                                onCheckedChange={() => setForm(prev => ({ ...prev, type: opt.value }))}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className="text-sm">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Address */}
                      <div className="grid grid-cols-[1fr_100px_1fr] gap-3">
                        <div className="space-y-1.5">
                          <Label>Ulice</Label>
                          <Input {...f("address_line")} placeholder="Hlavní 123" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>PSČ</Label>
                          <Input {...f("zip")} placeholder="73801" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Město</Label>
                          <Input {...f("city")} placeholder="Frýdek-Místek" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Země</Label>
                        <Select value={form.country} onValueChange={v => setForm(prev => ({ ...prev, country: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CZ">Česko</SelectItem>
                            <SelectItem value="SK">Slovensko</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Direct contact */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label>E-mail</Label>
                          <Input {...f("email")} type="email" placeholder="info@firma.cz" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Telefon</Label>
                          <Input {...f("phone")} placeholder="+420 123 456 789" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Web</Label>
                          <Input {...f("website")} placeholder="www.firma.cz" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="kontakty" className="space-y-4 mt-4">
                      <p className="text-xs text-muted-foreground">Přidejte primární kontaktní osobu</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Jméno / Název *</Label>
                          <Input {...f("contact_name")} placeholder="Jan Novák" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Pozice / typ kontaktu</Label>
                          <Input {...f("contact_role")} placeholder="Jednatel" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>E-mail</Label>
                          <Input {...f("contact_email")} type="email" placeholder="jan@firma.cz" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Telefon</Label>
                          <Input {...f("contact_phone")} placeholder="+420 123 456 789" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="popis" className="space-y-4 mt-4">
                      <div className="space-y-1.5">
                        <Label>Poznámka</Label>
                        <Textarea {...f("note")} placeholder="Interní poznámka k zákazníkovi..." rows={4} />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Ukládání..." : "Vytvořit zákazníka"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 px-3"><Checkbox disabled /></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center gap-1">Název <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("ico")}>
                  <span className="inline-flex items-center gap-1">IČO <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Adresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const con = getContact(c.id);
                const isSelected = selectedId === c.id;
                const addr = [c.address_line, c.city, c.zip].filter(Boolean).join(", ") || c.billing_address || "—";
                return (
                  <TableRow
                    key={c.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedId(isSelected ? null : c.id)}
                    onDoubleClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <TableCell className="px-3"><Checkbox checked={isSelected} /></TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.ico || "—"}</TableCell>
                    <TableCell className="text-sm">{con?.phone || c.phone || "—"}</TableCell>
                    <TableCell className="text-sm">{con?.email || c.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{addr}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    Žádní zákazníci {search ? "nenalezeni" : ""}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-72 border-l bg-muted/20 flex flex-col shrink-0 overflow-auto">
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Hledat</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Fulltextové hledání..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!filterName} onCheckedChange={(v) => { if (!v) setFilterName(""); }} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                <Label className="text-sm font-medium">Název</Label>
              </div>
              <Input placeholder="Filtr podle názvu..." className="h-7 text-xs" value={filterName} onChange={e => setFilterName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!filterIco} onCheckedChange={(v) => { if (!v) setFilterIco(""); }} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                <Label className="text-sm font-medium">IČO</Label>
              </div>
              <Input placeholder="Filtr podle IČO..." className="h-7 text-xs" value={filterIco} onChange={e => setFilterIco(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!filterPhone} onCheckedChange={(v) => { if (!v) setFilterPhone(""); }} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                <Label className="text-sm font-medium">Telefon</Label>
              </div>
              <Input placeholder="Filtr podle telefonu..." className="h-7 text-xs" value={filterPhone} onChange={e => setFilterPhone(e.target.value)} />
            </div>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterName(""); setFilterIco(""); setFilterPhone(""); }}>
              Zrušit filtry
            </Button>
          )}
        </div>

        {selected && (
          <div className="border-t p-4 space-y-3 mt-auto">
            <h3 className="font-semibold text-sm">{selected.name}</h3>
            <div className="space-y-1.5 text-xs">
              {selected.ico && <p><span className="text-muted-foreground">IČO:</span> {selected.ico}</p>}
              {selected.dic && <p><span className="text-muted-foreground">DIČ:</span> {selected.dic}</p>}
              {(selectedContact?.phone || selected.phone) && <p><span className="text-muted-foreground">Tel:</span> {selectedContact?.phone || selected.phone}</p>}
              {(selectedContact?.email || selected.email) && <p><span className="text-muted-foreground">Email:</span> {selectedContact?.email || selected.email}</p>}
              {(selected.address_line || selected.city) && (
                <p><span className="text-muted-foreground">Adresa:</span> {[selected.address_line, selected.city, selected.zip].filter(Boolean).join(", ")}</p>
              )}
              {selected.website && <p><span className="text-muted-foreground">Web:</span> {selected.website}</p>}
            </div>
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate(`/customers/${selected.id}`)}>
              Otevřít detail
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
