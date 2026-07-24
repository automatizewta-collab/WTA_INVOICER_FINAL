"use client";

import type { DocumentItem, FinancialDetails, Currency } from "@/lib/types";
import { Separator } from "@/components/ui/separator";

interface FinancialSummaryProps {
  items: DocumentItem[];
  financial: FinancialDetails;
  currency: Currency;
  dollarExchangeRate?: number | null;
}

function fmt(value: number, curr: string): string {
  return curr + " " + value.toFixed(2);
}

function fmtBrl(value: number): string {
  return "R$ " + value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinancialSummary({ items, financial, currency, dollarExchangeRate }: FinancialSummaryProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const lineSubtotal = safeItems.reduce((s, i) => s + i.quantity * i.unit_price * (1 - i.discount / 100), 0);
  const discountAmt = lineSubtotal * (financial.discount || 0) / 100;
  const afterDiscount = lineSubtotal - discountAmt;
  const shipping = financial.shipping_cost || 0;
  const insurance = financial.insurance || 0;
  const bankFees = financial.bank_fees || 0;
  const total = afterDiscount + shipping + insurance + bankFees;
  const showBrl = !!dollarExchangeRate && dollarExchangeRate > 0;
  const rate = dollarExchangeRate || 1;

  const rows: { label: string; usd: number; highlight?: boolean }[] = [
    { label: "Subtotal Itens", usd: lineSubtotal },
    financial.discount ? { label: `Desconto (${financial.discount}%)`, usd: -discountAmt } : { label: "Desconto", usd: 0 },
    { label: "Frete", usd: shipping },
    { label: "Seguro", usd: insurance },
    { label: "Taxas Bancárias", usd: bankFees },
  ];

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-sm space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums">{fmt(row.usd, currency)}</span>
          </div>
        ))}
        <Separator className="my-1" />
        <div className="flex justify-between">
          <span className="text-base font-bold">Total</span>
          <span className="text-xl font-bold tabular-nums">{fmt(total, currency)}</span>
        </div>
        {showBrl && (
          <>
            <Separator className="my-2" />
            <p className="text-xs font-medium text-muted-foreground mb-1">Valores em BRL (cotação: {rate})</p>
            {rows.map((row) => (
              <div key={row.label + "-brl"} className="flex justify-between text-xs text-muted-foreground">
                <span>{row.label}</span>
                <span className="tabular-nums">{fmtBrl(row.usd * rate)}</span>
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex justify-between text-sm">
              <span className="font-medium text-foreground">Total BRL</span>
              <span className="font-bold tabular-nums">{fmtBrl(total * rate)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
