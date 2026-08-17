// ============================================
// PDF Template — PROFORMA (Sprint 4)
// Title: "PROFORMA" only
// Balanced layout: pricing + weights, numbered rows
// ============================================

import type { PdfItem, PdfCompany, TemplateContext } from "./shared";
import {
  esc,
  fmtNum,
  fmtUsd,
  fmtKg,
  fmtKgRaw,
  getItemName,
  getEndUse,
  getLogoBase64,
  buildHeader,
  buildSenderInfo,
  buildPartyRow,
  buildShipmentDetails,
  buildNotes,
  buildBankDetails,
  buildWatermark,
  buildFooter,
  wrapHtml,
} from "./shared";
import { calcLineTotal } from "@/lib/document-calculations";

export async function buildProformaHtml(
  doc: TemplateContext,
  items: PdfItem[],
  sender: PdfCompany | null,
  recipient: PdfCompany | null,
): Promise<string> {
  const isEs = doc.language === "es";
  const label = "PROFORMA";
  const htsusTitle = esc(doc.htsusColumnTitle || "HTSUS");

  const logoDataUri = await getLogoBase64(sender);
  const senderInfoHtml = sender ? buildSenderInfo(sender) : "";

  // ── Header + Parties ──
  const headerHtml = buildHeader(label, doc, logoDataUri, senderInfoHtml);
  const partyRowHtml = buildPartyRow(doc, sender, recipient, logoDataUri, senderInfoHtml);

  // ── Items table ──
  // Columns: # | Code | Description | [End Use] | HTSUS | Qty | Unit Price | Disc. | Line Total | G.W./Unit | N.W./Unit | Total G.W. | Total N.W.
  const showEndUse = doc.showEndUseColumn;
  const headers: string[] = [
    '<th style="width:30px;text-align:center">#</th>',
    '<th style="width:70px">Code</th>',
    '<th>' + (isEs ? "Descripci\u00f3n" : "Description") + "</th>",
  ];
  if (showEndUse) {
    headers.push('<th style="width:90px;text-align:center">End Use</th>');
  }
  headers.push(
    '<th style="width:70px">' + htsusTitle + "</th>",
    '<th style="width:40px;text-align:center">Qty</th>',
    '<th style="width:70px;text-align:right">Unit Price</th>',
    '<th style="width:40px;text-align:center">Disc.</th>',
    '<th style="width:80px;text-align:right">Line Total</th>',
    '<th style="width:65px;text-align:right">G.W./Unit</th>',
    '<th style="width:65px;text-align:right">N.W./Unit</th>',
    '<th style="width:75px;text-align:right">Total G.W.</th>',
    '<th style="width:75px;text-align:right">Total N.W.</th>',
  );

  const rows: string[] = [];
  let totalGw = 0;
  let totalNw = 0;
  let subtotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = getItemName(item, isEs);
    const endUse = getEndUse(item, isEs);
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const disc = Number(item.discount || 0);
    const lineTotal = calcLineTotal({ quantity: qty, unit_price: price, discount: disc });
    const gwUnit = Number(item.gross_weight || 0);
    const nwUnit = Number(item.net_weight || 0);
    const itemTotalGw = gwUnit * qty;
    const itemTotalNw = nwUnit * qty;

    totalGw += itemTotalGw;
    totalNw += itemTotalNw;
    subtotal += lineTotal;

    const itemCode = String(item.item_code || item.htsus_code || "");
    const htsusCode = String(item.htsus_code || "");

    rows.push(
      "<tr>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + (i + 1) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px">' + esc(itemCode) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;max-width:220px">' + esc(name) + "</td>" +
        (showEndUse
          ? '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + esc(endUse) + "</td>"
          : "") +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px">' + esc(htsusCode) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + qty + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtUsd(price) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + disc + "%</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtUsd(lineTotal) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKgRaw(gwUnit) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKgRaw(nwUnit) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKg(itemTotalGw) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKg(itemTotalNw) + "</td>" +
      "</tr>"
    );
  }

  // ── Totals row (aligned with columns) ──
  const colCount = showEndUse ? 11 : 10;
  const totalsRow =
    "<tr>" +
      '<td colspan="' + (colCount - 2) + '" style="padding:8px;border-top:2px solid #111;font-weight:700;font-size:11px;text-align:right">TOTAL</td>' +
      '<td style="padding:8px;border-top:2px solid #111;font-weight:700;text-align:right">' + fmtKg(totalGw) + "</td>" +
      '<td style="padding:8px;border-top:2px solid #111;font-weight:700;text-align:right">' + fmtKg(totalNw) + "</td>" +
    "</tr>";

  // ── Financial summary ──
  const fd = doc.financialDetails || {};
  const total = fd.total_value || subtotal;
  const financialHtml =
    '<div style="margin-top:20px;display:flex;justify-content:flex-end">' +
      '<table style="width:280px;font-size:12px">' +
        '<tr><td style="padding:4px 8px">Subtotal</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + fmtUsd(subtotal) + "</td></tr>" +
        (fd.discount
          ? "<tr><td style=\"padding:4px 8px\">Discount (" + fd.discount + "%)</td><td style=\"padding:4px 8px;text-align:right\">-" + fmtUsd(subtotal * fd.discount / 100) + "</td></tr>"
          : "") +
        (fd.shipping_cost
          ? "<tr><td style=\"padding:4px 8px\">Shipping</td><td style=\"padding:4px 8px;text-align:right\">" + fmtUsd(fd.shipping_cost) + "</td></tr>"
          : "") +
        (fd.insurance
          ? "<tr><td style=\"padding:4px 8px\">Insurance</td><td style=\"padding:4px 8px;text-align:right\">" + fmtUsd(fd.insurance) + "</td></tr>"
          : "") +
        (fd.bank_fees
          ? "<tr><td style=\"padding:4px 8px\">Bank Fees</td><td style=\"padding:4px 8px;text-align:right\">" + fmtUsd(fd.bank_fees) + "</td></tr>"
          : "") +
        '<tr style="border-top:2px solid #111"><td style="padding:6px 8px;font-weight:700;font-size:14px">TOTAL</td><td style="padding:6px 8px;text-align:right;font-weight:700;font-size:14px">' + fmtUsd(total) + "</td></tr>" +
      "</table></div>";

  // ── Exchange rate ──
  let exchangeHtml = "";
  if (doc.dollarExchangeRate) {
    exchangeHtml =
      '<div style="margin-top:8px;font-size:10px;color:#666">' +
        (isEs ? "Tipo de cambio" : "Exchange Rate") + ": 1 USD = R$ " + fmtNum(doc.dollarExchangeRate) +
      "</div>";
  }

  // ── Sections ──
  const shipmentHtml = buildShipmentDetails(doc);
  const notesHtml = buildNotes(doc);
  const bankHtml = buildBankDetails(sender);
  const watermarkHtml = buildWatermark(doc.status === "draft");
  const footerHtml = buildFooter();

  // ── Assemble ──
  const body =
    watermarkHtml +
    '<div class="content">' +
      headerHtml +
      '<hr class="separator">' +
      partyRowHtml +
      '<table style="font-size:11px"><thead><tr>' + headers.join("") + "</tr></thead><tbody>" +
        rows.join("") +
        totalsRow +
      "</tbody></table>" +
      financialHtml +
      exchangeHtml +
      shipmentHtml +
      notesHtml +
      bankHtml +
      footerHtml +
    "</div>";

  return wrapHtml(body, isEs, label, doc.number);
}
