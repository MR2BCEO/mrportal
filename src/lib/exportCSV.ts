import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export async function exportObligationsCSV(filters?: { customerId?: string; locationId?: string }) {
  let query = supabase.from("obligations")
    .select("id, title, status, performed_date, next_due_date, quantity, technician_name, findings_summary, customers(name), locations(name), service_catalog(code, name, division, group_name), profiles!obligations_responsible_user_id_fkey(name)")
    .order("next_due_date", { ascending: true, nullsFirst: false });

  if (filters?.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters?.locationId) query = query.eq("location_id", filters.locationId);

  const { data } = await query;
  if (!data || data.length === 0) return null;

  const statusLabels: Record<string, string> = {
    PLANNED: "Plánováno", IN_PROGRESS: "Probíhá", DONE: "Hotovo",
    OVERDUE: "Po termínu", DUE_SOON: "Brzy", NEEDS_INFO: "Chybí údaje", ARCHIVED: "Archiv",
  };

  const headers = ["Divize", "Skupina", "Služba", "Název", "Odběratel", "Lokace", "Datum provedení", "Expirace", "Status", "Odpovědný", "Technik", "Počet", "Poznámka"];

  const rows = data.map((ob: any) => [
    ob.service_catalog?.division || "",
    ob.service_catalog?.group_name || "",
    ob.service_catalog ? `${ob.service_catalog.code} – ${ob.service_catalog.name}` : "",
    ob.title,
    ob.customers?.name || "",
    ob.locations?.name || "",
    ob.performed_date ? format(new Date(ob.performed_date), "d.M.yyyy") : "",
    ob.next_due_date ? format(new Date(ob.next_due_date), "d.M.yyyy") : "",
    statusLabels[ob.status] || ob.status,
    ob.profiles?.name || "",
    ob.technician_name || "",
    ob.quantity || "",
    ob.findings_summary || "",
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  // BOM for Excel cp1250 compat
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `povinnosti_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return data.length;
}
