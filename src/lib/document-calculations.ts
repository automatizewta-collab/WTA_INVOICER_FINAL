// ============================================
// INVOICER - Shared Financial Calculations
// Single source of truth for all money math.
// Used by: API routes, FinancialSummary, DocumentItemsTable, Views
// ============================================

/** Line-level total: qty × price × (1 - discount%) */
export function calcLineTotal(item: {
  quantity: number;
  unit_price: number;
  discount: number;
}): number {
  return item.quantity * item.unit_price * (1 - item.discount / 100);
}

/** Sum of all line totals before document-level discounts/fees */
export function calcSubtotal(
  items: { quantity: number; unit_price: number; discount: number }[],
): number {
  return items.reduce((sum, item) => sum + calcLineTotal(item), 0);
}

/**
 * Grand total after document-level discount + shipping + insurance + bank fees.
 * This is the same formula used in both frontend forms and PDF generation.
 */
export function calcTotal(
  items: { quantity: number; unit_price: number; discount: number }[],
  financial: {
    discount?: number | null;
    shipping_cost?: number | null;
    insurance?: number | null;
    bank_fees?: number | null;
  },
): number {
  const subtotal = calcSubtotal(items);
  const discountAmt = subtotal * ((financial.discount || 0) / 100);
  const afterDiscount = subtotal - discountAmt;
  return (
    afterDiscount +
    (financial.shipping_cost || 0) +
    (financial.insurance || 0) +
    (financial.bank_fees || 0)
  );
}

/** Document-level discount amount in USD */
export function calcDiscountAmount(
  items: { quantity: number; unit_price: number; discount: number }[],
  discountPercent: number,
): number {
  return calcSubtotal(items) * (discountPercent / 100);
}

/** Convert USD to BRL */
export function calcBrl(usdValue: number, rate: number): number {
  return usdValue * rate;
}

/** Format a number as BRL currency string */
export function fmtBrl(value: number): string {
  return (
    "R$ " +
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
