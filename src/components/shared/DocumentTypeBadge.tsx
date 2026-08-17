"use client";

import { Badge } from "@/components/ui/badge";
import { FileText, Receipt, Package } from "lucide-react";
import type { DocumentType } from "@/lib/types";

const config: Record<
  DocumentType,
  { label: string; className: string; Icon: React.ElementType }
> = {
  proforma: {
    label: "Proforma",
    className:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    Icon: FileText,
  },
  invoice: {
    label: "Invoice",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    Icon: Receipt,
  },
  packing_list: {
    label: "Packing List",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    Icon: Package,
  },
};

export function DocumentTypeBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const cfg = config[type as DocumentType];
  if (!cfg)
    return (
      <Badge variant="secondary" className={className}>
        {type}
      </Badge>
    );

  return (
    <Badge
      variant="outline"
      className={`${cfg.className} ${className || ""}`}
    >
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
