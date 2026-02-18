import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, DivisionBadge } from "@/components/StatusBadge";
import { ArrowLeft, FileText, History, Upload, Info, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function ObligationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [obligation, setObligation] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data: ob } = await supabase.from("obligations")
      .select("*, customers(name), locations(name), assets(name), service_catalog(code, name, division, group_name), profiles!obligations_responsible_user_id_fkey(name, email)")
      .eq("id", id).single();
    setObligation(ob);

    const { data: docs } = await supabase.from("documents")
      .select("*").eq("obligation_id", id!).order("created_at", { ascending: false });
    setDocuments(docs || []);

    const { data: hist } = await supabase.from("obligation_history")
      .select("*, profiles(name)").eq("obligation_id", id!).order("created_at", { ascending: false });
    setHistory(hist || []);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);

    const filePath = `${id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Chyba nahrávání", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    await supabase.from("documents").insert({
      obligation_id: id,
      file_url: filePath,
      file_name: file.name,
      file_type: file.type,
      uploaded_by_user_id: user?.id,
      doc_kind: file.type === "application/pdf" ? "REVIZNI_ZPRAVA" : "JINE",
    });

    toast({ title: "Dokument nahrán" });
    setUploading(false);
    fetchData();
  };

  const markDone = async () => {
    if (!id) return;
    await supabase.from("obligations").update({ status: "DONE" as any }).eq("id", id);
    toast({ title: "Označeno jako Hotovo" });
    fetchData();
  };

  const markArchived = async () => {
    if (!id) return;
    await supabase.from("obligations").update({ status: "ARCHIVED" as any }).eq("id", id);
    toast({ title: "Archivováno" });
    fetchData();
  };

  const getDocDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!obligation) return <div className="p-8 text-center text-muted-foreground">Načítání...</div>;

  const actionLabel: Record<string, string> = {
    CREATED: "Vytvořeno",
    UPDATED: "Aktualizováno",
    STATUS_CHANGED: "Změna statusu",
    DOCUMENT_ADDED: "Přidán dokument",
    IMPORTED: "Importováno",
    COMMENT: "Komentář",
  };

  const service = obligation.service_catalog as any;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/obligations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{obligation.title}</h1>
            {service?.division && <DivisionBadge division={service.division} />}
            <StatusBadge status={obligation.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {(obligation.customers as any)?.name} · {(obligation.locations as any)?.name}
            {(obligation.assets as any)?.name ? ` · ${(obligation.assets as any).name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {obligation.status !== "DONE" && obligation.status !== "ARCHIVED" && (
            <Button variant="outline" size="sm" onClick={markDone}>
              <CheckCircle2 className="w-4 h-4 mr-1" />Hotovo
            </Button>
          )}
          {obligation.status === "DONE" && (
            <Button variant="ghost" size="sm" onClick={markArchived}>Archivovat</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Služba</p>
            <p className="font-semibold">{service?.code} – {service?.name || "—"}</p>
            <p className="text-xs text-muted-foreground">{service?.group_name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Datum provedení</p>
            <p className="font-semibold">{obligation.performed_date ? format(new Date(obligation.performed_date), "d. M. yyyy", { locale: cs }) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Expirace / příští termín</p>
            <p className="font-semibold">{obligation.next_due_date ? format(new Date(obligation.next_due_date), "d. M. yyyy", { locale: cs }) : "—"}</p>
            {obligation.quantity && <p className="text-xs text-muted-foreground">Počet: {obligation.quantity} ks</p>}
          </CardContent>
        </Card>
      </div>

      {obligation.findings_summary && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Poznámka</p>
            <p className="text-sm">{obligation.findings_summary}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1.5" />Dokumenty ({documents.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1.5" />Historie ({history.length})</TabsTrigger>
          <TabsTrigger value="info"><Info className="w-3.5 h-3.5 mr-1.5" />Info</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
                <Upload className="w-4 h-4" />
                {uploading ? "Nahrávání..." : "Nahrát dokument"}
              </div>
            </Label>
            <input id="file-upload" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} />
          </div>
          {documents.map(doc => (
            <Card key={doc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => getDocDownloadUrl(doc.file_url)}>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "d. M. yyyy HH:mm", { locale: cs })}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {documents.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádné dokumenty</p>}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-2">
          {history.map(h => (
            <div key={h.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{actionLabel[h.action] || h.action}</p>
                {h.action === "STATUS_CHANGED" && h.payload && (
                  <p className="text-xs text-muted-foreground">{h.payload.old_status} → {h.payload.new_status}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {(h.profiles as any)?.name} · {format(new Date(h.created_at), "d. M. yyyy HH:mm", { locale: cs })}
                </p>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-muted-foreground py-4">Žádná historie</p>}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Odpovědný:</span> <span className="font-medium">{(obligation.profiles as any)?.name || "—"}</span></div>
                <div><span className="text-muted-foreground">Technik:</span> <span className="font-medium">{obligation.technician_name || "—"}</span></div>
                <div><span className="text-muted-foreground">Firma technika:</span> <span className="font-medium">{obligation.technician_company || "—"}</span></div>
                <div><span className="text-muted-foreground">Tel. technik:</span> <span className="font-medium">{obligation.technician_phone || "—"}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
