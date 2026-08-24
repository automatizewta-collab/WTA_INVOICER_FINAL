"use client";

import type { DocumentItem, FinancialDetails, Currency } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { calcSubtotal, calcDiscountAmount, calcBrl, fmtBrl } from "@/lib/document-calculations";

interface FinancialSummaryProps {
  items: DocumentItem[];
  financial: FinancialDetails;
  currency: Currency;
  dollarExchangeRate?: number | null;
}

function fmt(value: number, curr: string): string {
  return curr + " " + value.toFixed(2);
}

export function FinancialSummary({ items, financial, currency, dollarExchangeRate }: FinancialSummaryProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const lineSubtotal = calcSubtotal(safeItems);
  const discountAmt = calcDiscountAmount(safeItems, financial.discount || 0);
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
          <div key={row.label}>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular-nums">{fmt(row.usd, currency)}</span>
            </div>
            {showBrl && row.usd !== 0 && (
              <p className="text-[11px] text-muted-foreground text-right -mt-0.5">
                BRL: {fmtBrl(calcBrl(row.usd, rate))}
              </p>
            )}
          </div>
        ))}
        <Separator className="my-1" />
        <div className="flex justify-between">
          <span className="text-base font-bold">Total</span>
          <span className="text-xl font-bold tabular-nums">{fmt(total, currency)}</span>
        </div>
        {showBrl && (
          <p className="text-xs font-medium text-muted-foreground text-right mt-0.5">
            Total BRL: {fmtBrl(calcBrl(total, rate))}
            <span className="text-[10px] ml-1">(cotação: {rate})</span>
          </p>
        )}
      </div>
    </div>
  );
}
