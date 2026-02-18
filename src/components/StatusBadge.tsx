import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; class: string }> = {
  PLANNED: { label: "Plánováno", class: "status-badge-planned" },
  IN_PROGRESS: { label: "Probíhá", class: "status-badge-in-progress" },
  DRAFT: { label: "Koncept", class: "status-badge-draft" },
  ACTIVE: { label: "Aktivní", class: "status-badge-active" },
  DUE_SOON: { label: "Brzy", class: "status-badge-due-soon" },
  OVERDUE: { label: "Po termínu", class: "status-badge-overdue" },
  DONE: { label: "Hotovo", class: "status-badge-done" },
  NEEDS_INFO: { label: "Chybí údaje", class: "status-badge-needs-info" },
  ARCHIVED: { label: "Archiv", class: "status-badge-archived" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, class: "status-badge-draft" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", config.class)}>
      {config.label}
    </span>
  );
}

const divisionConfig: Record<string, { label: string; class: string }> = {
  "Revize a inspekce": { label: "Revize", class: "division-badge-revize" },
  "BOZP a požární ochrana": { label: "BOZP/PO", class: "division-badge-bozp" },
  "Školení a certifikace": { label: "Školení", class: "division-badge-skoleni" },
  "Technická správa budov": { label: "TSB", class: "division-badge-tsb" },
  // Legacy support
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

// Keep backward compat
export const DomainBadge = DivisionBadge;
