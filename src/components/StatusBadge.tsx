import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; class: string }> = {
  DONE: { label: "Platná", class: "bg-green-50 text-green-700 border border-green-200" },
  ACTIVE: { label: "Platná", class: "bg-green-50 text-green-700 border border-green-200" },
  PLANNED: { label: "Platná", class: "bg-green-50 text-green-700 border border-green-200" },
  DUE_SOON: { label: "Brzy expiruje", class: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  OVERDUE: { label: "Expirovaná", class: "bg-red-50 text-red-700 border border-red-200" },
  NEEDS_INFO: { label: "Chybí údaje", class: "bg-gray-50 text-gray-600 border border-gray-200" },
  ARCHIVED: { label: "Archiv", class: "bg-gray-50 text-gray-500 border border-gray-200" },
  DRAFT: { label: "Koncept", class: "bg-gray-50 text-gray-500 border border-gray-200" },
  IN_PROGRESS: { label: "Probíhá", class: "bg-blue-50 text-blue-700 border border-blue-200" },
};

const statusIcons: Record<string, string> = {
  DONE: "✓",
  ACTIVE: "✓",
  PLANNED: "✓",
  DUE_SOON: "⏳",
  OVERDUE: "⚠",
  NEEDS_INFO: "?",
  ARCHIVED: "▪",
  DRAFT: "▪",
  IN_PROGRESS: "→",
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, class: "bg-gray-50 text-gray-500 border border-gray-200" };
  const icon = statusIcons[status] || "";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap", config.class)}>
      {icon && <span>{icon}</span>}
      {config.label}
    </span>
  );
}

const divisionConfig: Record<string, { label: string; class: string }> = {
  "Revize a inspekce": { label: "Revize", class: "division-badge-revize" },
  "BOZP a požární ochrana": { label: "BOZP/PO", class: "division-badge-bozp" },
  "Školení a certifikace": { label: "Školení", class: "division-badge-skoleni" },
  "Technická správa budov": { label: "TSB", class: "division-badge-tsb" },
  "REVIZE": { label: "Revize", class: "division-badge-revize" },
  "BOZP": { label: "BOZP", class: "division-badge-bozp" },
  "PO": { label: "PO", class: "division-badge-po" },
};

export function DivisionBadge({ division }: { division: string }) {
  const config = divisionConfig[division] || { label: division, class: "division-badge-revize" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold", config.class)}>
      {config.label}
    </span>
  );
}

export const DomainBadge = DivisionBadge;
