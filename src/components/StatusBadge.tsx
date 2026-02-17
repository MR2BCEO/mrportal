import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; class: string }> = {
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

const domainConfig: Record<string, { label: string; class: string }> = {
  REVIZE: { label: "Revize", class: "domain-badge-revize" },
  BOZP: { label: "BOZP", class: "domain-badge-bozp" },
  PO: { label: "PO", class: "domain-badge-po" },
};

export function DomainBadge({ domain }: { domain: string }) {
  const config = domainConfig[domain] || { label: domain, class: "domain-badge-revize" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold", config.class)}>
      {config.label}
    </span>
  );
}
