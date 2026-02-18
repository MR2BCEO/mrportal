import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";

interface ImportResult {
  assetsCreated: number;
  assetsUpdated: number;
  obligationsCreated: number;
  obligationsSkipped: number;
  errors: string[];
}

interface Props {
  locationId: string;
  customerId: string;
  onComplete: () => void;
}

// Parse Czech date format dd.mm.yyyy
function parseCzechDate(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  // dd.mm.yyyy
  const match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try Excel serial date number
  if (!isNaN(Number(s))) {
    const excelDate = new Date((Number(s) - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) {
      return excelDate.toISOString().split("T")[0];
    }
  }
  return null;
}

export default function DMRevizeImport({ locationId, customerId, onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", codepage: 1250 });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        toast({ title: "Prázdný soubor", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Find RS-SPOT service
      const { data: rsSpot } = await supabase.from("service_catalog")
        .select("id").eq("code", "RS-SPOT").single();
      
      if (!rsSpot) {
        toast({ title: "Služba RS-SPOT nenalezena v katalogu", variant: "destructive" });
        setImporting(false);
        return;
      }

      const res: ImportResult = { assetsCreated: 0, assetsUpdated: 0, obligationsCreated: 0, obligationsSkipped: 0, errors: [] };

      // Header mapping (case-insensitive search)
      const findCol = (row: any, ...keys: string[]) => {
        for (const key of Object.keys(row)) {
          const k = key.toUpperCase().trim();
          for (const search of keys) {
            if (k === search.toUpperCase() || k.includes(search.toUpperCase())) return row[key];
          }
        }
        return "";
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const externalId = String(findCol(row, "ID") || "").trim();
          const name = String(findCol(row, "NÁZEV", "NAZEV") || "").trim();
          const nextDueDateRaw = findCol(row, "DAT.PŘÍŠTÍ", "DAT.PRISTI", "PŘÍŠTÍ", "PRISTI");
          const performedDateRaw = findCol(row, "DAT.MĚŘENÍ", "DAT.MERENI", "MĚŘENÍ", "MERENI");

          if (!name && !externalId) {
            res.errors.push(`Řádek ${i + 2}: chybí název i ID, přeskočeno`);
            continue;
          }

          const nextDueDate = parseCzechDate(nextDueDateRaw);
          const performedDate = parseCzechDate(performedDateRaw);

          // Upsert asset
          let assetId: string;
          if (externalId) {
            const { data: existing } = await supabase.from("assets")
              .select("id").eq("external_id", externalId).eq("location_id", locationId).maybeSingle();

            const assetData = {
              location_id: locationId,
              external_id: externalId || null,
              name: name || `Spotřebič ${externalId}`,
              room: String(findCol(row, "MÍSTNOST", "MISTNOST") || "").trim() || null,
              inventory_no: String(findCol(row, "INV.ČÍSLO", "INV.CISLO", "INV") || "").trim() || null,
              manufacturer: String(findCol(row, "VÝROBCE", "VYROBCE") || "").trim() || null,
              model: String(findCol(row, "TYPOVÉ OZN", "TYPOVE OZN", "TYP") || "").trim() || null,
              serial_number: String(findCol(row, "VÝROBNÍ ČÍSLO", "VYROBNI CISLO") || "").trim() || null,
              year: String(findCol(row, "ROK VÝROBY", "ROK VYROBY") || "").trim() || null,
              extra_json: row,
            };

            if (existing) {
              await supabase.from("assets").update(assetData as any).eq("id", existing.id);
              assetId = existing.id;
              res.assetsUpdated++;
            } else {
              const { data: newAsset } = await supabase.from("assets").insert(assetData as any).select("id").single();
              if (!newAsset) { res.errors.push(`Řádek ${i + 2}: chyba vytvoření assetu`); continue; }
              assetId = newAsset.id;
              res.assetsCreated++;
            }
          } else {
            const { data: newAsset } = await supabase.from("assets").insert({
              location_id: locationId,
              name: name,
              extra_json: row,
            } as any).select("id").single();
            if (!newAsset) { res.errors.push(`Řádek ${i + 2}: chyba vytvoření assetu`); continue; }
            assetId = newAsset.id;
            res.assetsCreated++;
          }

          // Check dedupe for obligation
          if (nextDueDate) {
            const { data: existingOb } = await supabase.from("obligations")
              .select("id").eq("service_id", rsSpot.id).eq("asset_id", assetId)
              .eq("next_due_date", nextDueDate)
              .not("status", "in", '("ARCHIVED","DONE")')
              .maybeSingle();

            if (existingOb) {
              res.obligationsSkipped++;
              continue;
            }
          }

          // Create obligation
          await supabase.from("obligations").insert({
            customer_id: customerId,
            location_id: locationId,
            asset_id: assetId,
            domain: "REVIZE" as any,
            obligation_type_id: rsSpot.id,
            service_id: rsSpot.id,
            title: `RS-SPOT – ${name}`,
            performed_date: performedDate,
            next_due_date: nextDueDate,
            responsible_user_id: user?.id,
            status: nextDueDate ? "PLANNED" : "NEEDS_INFO",
          } as any);
          res.obligationsCreated++;

        } catch (err: any) {
          res.errors.push(`Řádek ${i + 2}: ${err.message}`);
        }
      }

      setResult(res);
      toast({ title: `Import dokončen: ${res.assetsCreated + res.assetsUpdated} assetů, ${res.obligationsCreated} povinností` });
      onComplete();
    } catch (err: any) {
      toast({ title: "Chyba importu", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Import spotřebičů (DM Revize)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Nahrajte XLSX/CSV export z DM Revize. Mapuje se podle hlaviček sloupců (ID, NÁZEV, DAT.PŘÍŠTÍ, DAT.MĚŘENÍ atd.).
          CSV: encoding cp1250, delimiter ';'.
        </p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <div className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
              <Upload className="w-4 h-4" />
              {importing ? "Importování..." : "Vybrat soubor"}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
        </div>

        {result && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-done))]" />
              <span>Assety vytvořeny: <b>{result.assetsCreated}</b>, aktualizovány: <b>{result.assetsUpdated}</b></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-done))]" />
              <span>Povinnosti vytvořeny: <b>{result.obligationsCreated}</b>, přeskočeny (duplicity): <b>{result.obligationsSkipped}</b></span>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--status-overdue))]">
                  <XCircle className="w-4 h-4" />
                  <span>Chyby: {result.errors.length}</span>
                </div>
                <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
                  {result.errors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
