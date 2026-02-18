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
import { Plus, Search, ArrowUpDown } from "lucide-react";
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

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", ico: "", type: "firma" as string, note: "", billing_address: "", dic: "" });
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
    const { error } = await supabase.from("customers").insert({
      name: form.name,
      ico: form.ico || null,
      dic: form.dic || null,
      type: form.type as any,
      note: form.note || null,
      billing_address: form.billing_address || null,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Zákazník vytvořen" });
      setForm({ name: "", ico: "", type: "firma", note: "", billing_address: "", dic: "" });
      setDialogOpen(false);
      fetchData();
    }
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
      const matchPhone = !filterPhone || con?.phone?.includes(filterPhone);
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

  return (
    <div className="flex gap-0 animate-fade-in h-[calc(100vh-4rem)]">
      {/* Main table area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Zákazníci</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Hledat..."
                className="pl-8 h-8 w-48 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8"><Plus className="w-3.5 h-3.5 mr-1.5" />Nový zákazník</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nový zákazník</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Název *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IČO</Label>
                      <Input value={form.ico} onChange={e => setForm(f => ({ ...f, ico: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>DIČ</Label>
                      <Input value={form.dic} onChange={e => setForm(f => ({ ...f, dic: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Typ</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="firma">Firma</SelectItem>
                        <SelectItem value="instituce">Instituce</SelectItem>
                        <SelectItem value="fo">Fyzická osoba</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fakturační adresa</Label>
                    <Input value={form.billing_address} onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Poznámka</Label>
                    <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                  </div>
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
                <TableHead className="w-10 px-3">
                  <Checkbox disabled />
                </TableHead>
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
                return (
                  <TableRow
                    key={c.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedId(isSelected ? null : c.id)}
                    onDoubleClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <TableCell className="px-3">
                      <Checkbox checked={isSelected} />
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.ico || "—"}</TableCell>
                    <TableCell className="text-sm">{con?.phone || "—"}</TableCell>
                    <TableCell className="text-sm">{con?.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.billing_address || "—"}</TableCell>
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

      {/* Right sidebar - filters & detail */}
      <div className="w-72 border-l bg-muted/20 flex flex-col shrink-0 overflow-auto">
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Hledat</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Fulltextové hledání..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Filter checkboxes */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fn"
                  checked={!!filterName}
                  onCheckedChange={(v) => { if (!v) setFilterName(""); }}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="fn" className="text-sm font-medium">Název</Label>
              </div>
              <Input placeholder="Filtr podle názvu..." className="h-7 text-xs" value={filterName} onChange={e => setFilterName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fi"
                  checked={!!filterIco}
                  onCheckedChange={(v) => { if (!v) setFilterIco(""); }}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="fi" className="text-sm font-medium">IČO</Label>
              </div>
              <Input placeholder="Filtr podle IČO..." className="h-7 text-xs" value={filterIco} onChange={e => setFilterIco(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fp"
                  checked={!!filterPhone}
                  onCheckedChange={(v) => { if (!v) setFilterPhone(""); }}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="fp" className="text-sm font-medium">Telefon</Label>
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

        {/* Selected detail */}
        {selected && (
          <div className="border-t p-4 space-y-3 mt-auto">
            <h3 className="font-semibold text-sm">{selected.name}</h3>
            <div className="space-y-1.5 text-xs">
              {selected.ico && <p><span className="text-muted-foreground">IČO:</span> {selected.ico}</p>}
              {selected.dic && <p><span className="text-muted-foreground">DIČ:</span> {selected.dic}</p>}
              {selectedContact?.phone && <p><span className="text-muted-foreground">Tel:</span> {selectedContact.phone}</p>}
              {selectedContact?.email && <p><span className="text-muted-foreground">Email:</span> {selectedContact.email}</p>}
              {selected.billing_address && <p><span className="text-muted-foreground">Adresa:</span> {selected.billing_address}</p>}
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
