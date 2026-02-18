import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check } from "lucide-react";

export function UIExportButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePayload = () => {
    const payload: any = {
      meta: {
        exportedAt: new Date().toISOString(),
        route: location.pathname,
        appName: "Můj Revizák",
      },
      layout: {
        sidebar: {
          items: [
            { label: "Dashboard", path: "/", active: location.pathname === "/" },
            { label: "Zákazníci", path: "/customers", active: location.pathname.startsWith("/customers") },
            { label: "Lokace", path: "/locations", active: location.pathname.startsWith("/locations") },
            { label: "Revize", path: "/obligations", active: location.pathname.startsWith("/obligations") },
            { label: "Nastavení", path: "/settings", active: location.pathname === "/settings" },
          ],
          width: "w-64",
          collapsible: false,
        },
        mainContent: {
          padding: "p-4 lg:p-6",
          background: "bg-background",
        },
      },
      currentPage: {
        route: location.pathname,
        timestamp: new Date().toISOString(),
      },
      designTokens: {
        spacing: { card: "p-3", table: "px-3 py-2", gap: "gap-3" },
        typography: { heading: "text-2xl font-semibold", description: "text-sm text-muted-foreground", body: "text-sm", small: "text-xs" },
        radius: { card: "rounded-lg", button: "rounded-md", badge: "rounded" },
        tableRow: { height: "h-10", padding: "px-3 py-2" },
      },
    };

    // Capture visible DOM structure summary
    const main = document.querySelector("main");
    if (main) {
      const tables = main.querySelectorAll("table");
      if (tables.length > 0) {
        payload.tables = Array.from(tables).map((table, i) => {
          const headers = Array.from(table.querySelectorAll("th")).map(th => th.textContent?.trim() || "");
          const rowCount = table.querySelectorAll("tbody tr").length;
          return { index: i, columns: headers, rowCount };
        });
      }

      const buttons = Array.from(main.querySelectorAll("button, a[role='button']")).slice(0, 20);
      if (buttons.length > 0) {
        payload.buttons = buttons.map(btn => ({
          text: btn.textContent?.trim()?.slice(0, 50) || "",
          tag: btn.tagName.toLowerCase(),
        }));
      }

      const headings = Array.from(main.querySelectorAll("h1, h2, h3")).slice(0, 10);
      if (headings.length > 0) {
        payload.headings = headings.map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.textContent?.trim() || "",
        }));
      }

      const inputs = Array.from(main.querySelectorAll("input, select, textarea")).slice(0, 20);
      if (inputs.length > 0) {
        payload.formFields = inputs.map((el: any) => ({
          type: el.type || el.tagName.toLowerCase(),
          placeholder: el.placeholder || "",
          name: el.name || "",
        }));
      }
    }

    return JSON.stringify(payload, null, 2);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const json = open ? generatePayload() : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Code2 className="w-3.5 h-3.5" />
          Export pro design review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            UI Review Payload
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            JSON popis UI struktury pro analýzu v ChatGPT nebo jiných nástrojích. Obsahuje layout, tabulky, filtry a design tokeny bez osobních dat.
          </p>
        </DialogHeader>
        <div className="relative flex-1 min-h-0">
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 z-10 gap-1.5"
            onClick={() => handleCopy(json)}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Zkopírováno" : "Kopírovat"}
          </Button>
          <pre className="bg-muted/50 rounded-lg p-4 text-xs overflow-auto max-h-[55vh] font-mono leading-relaxed whitespace-pre-wrap">
            {json}
          </pre>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Route: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{location.pathname}</code>
          </span>
          <Button size="sm" className="gap-1.5" onClick={() => handleCopy(json)}>
            <Copy className="w-3.5 h-3.5" />
            Kopírovat JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
