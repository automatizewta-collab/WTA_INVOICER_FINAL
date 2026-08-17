// ============================================
// PDF Template — PACKING LIST (Sprint 5)
// Cargo/weight focused, NO pricing
// - Comma decimal separator
// - kg suffix on total weight cells
// - Box descriptions as text lines (not table)
// - Totals = Items + Packaging
// - Totals row aligned with table columns
// ============================================

import type { PdfItem, PdfBox, PdfCompany, TemplateContext } from "./shared";
import {
  esc,
  fmtKg,
  fmtKgRaw,
  fmtNum,
  getItemName,
  getEndUse,
  getLogoBase64,
  buildHeader,
  buildSenderInfo,
  buildPartyRow,
  buildShipmentDetails,
  buildNotes,
  buildWatermark,
  buildFooter,
  wrapHtml,
} from "./shared";

export async function buildPackingListHtml(
  doc: TemplateContext,
  items: PdfItem[],
  sender: PdfCompany | null,
  recipient: PdfCompany | null,
): Promise<string> {
  const isEs = doc.language === "es";
  const label = isEs ? "LISTA DE EMBALAJE" : "PACKING LIST";
  const htsusTitle = esc(doc.htsusColumnTitle || "HTSUS");

  const logoDataUri = await getLogoBase64(sender);
  const senderInfoHtml = sender ? buildSenderInfo(sender) : "";

  // ── Header + Parties ──
  const headerHtml = buildHeader(label, doc, logoDataUri, senderInfoHtml);
  const partyRowHtml = buildPartyRow(doc, sender, recipient, logoDataUri, senderInfoHtml);

  // ── Prominent Shipment Box ──
  const sd = doc.shipmentDetails || {};
  const shipmentBoxHtml = buildPackingShipmentSection(doc, sd);

  // ── Items table (NO pricing) ──
  // Columns: # | Code | Description | [End Use] | HTSUS | Qty | G.W./Unit | N.W./Unit | Total G.W. | Total N.W.
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
    '<th style="width:70px;text-align:right">G.W./Unit</th>',
    '<th style="width:70px;text-align:right">N.W./Unit</th>',
    '<th style="width:80px;text-align:right">Total G.W.</th>',
    '<th style="width:80px;text-align:right">Total N.W.</th>',
  );

  const rows: string[] = [];
  let itemsGw = 0;
  let itemsNw = 0;
  let totalQty = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = getItemName(item, isEs);
    const endUse = getEndUse(item, isEs);
    const qty = Number(item.quantity || 0);
    const gwUnit = Number(item.gross_weight || 0);
    const nwUnit = Number(item.net_weight || 0);
    const itemTotalGw = gwUnit * qty;
    const itemTotalNw = nwUnit * qty;

    itemsGw += itemTotalGw;
    itemsNw += itemTotalNw;
    totalQty += qty;

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
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKgRaw(gwUnit) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKgRaw(nwUnit) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKg(itemTotalGw) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + fmtKg(itemTotalNw) + "</td>" +
      "</tr>"
    );
  }

  // ── Packaging weights from shipment details ──
  const packagingGw = Number(sd.gross_weight || 0);
  const packagingNw = Number(sd.net_weight || 0);

  // ── Totals row: aligned with columns (colspan for label, then values in last 2 cols) ──
  const colCount = showEndUse ? 10 : 9;
  const totalsRow =
    "<tr>" +
      '<td colspan="' + (colCount - 2) + '" style="padding:8px;border-top:2px solid #111;font-weight:700;font-size:11px;text-align:right">' +
        (isEs ? "PESO TOTAL ITEMS" : "ITEMS WEIGHT TOTAL") +
      "</td>" +
      '<td style="padding:8px;border-top:2px solid #111;font-weight:700;text-align:right">' + fmtKg(itemsGw) + "</td>" +
      '<td style="padding:8px;border-top:2px solid #111;font-weight:700;text-align:right">' + fmtKg(itemsNw) + "</td>" +
    "</tr>";

  // ── Boxes description (text lines, not table) ──
  const boxesHtml = buildBoxTextLines(sd.boxes || []);

  // ── Cargo Summary ──
  // TOTAL G.W. = Items G.W. + Packaging G.W.
  // TOTAL N.W. = Items N.W. only (packaging has no net weight)
  const totalGw = itemsGw + packagingGw;
  const totalNw = itemsNw;
  const cargoSummaryHtml = buildCargoSummary({
    lineItems: items.length,
    totalQty,
    boxes: sd.boxes || [],
    itemsGw,
    itemsNw,
    packagingGw,
    packagingNw,
    totalGw,
    totalNw,
    isEs,
  });

  // ── Sections ──
  const notesHtml = buildNotes(doc);
  const watermarkHtml = buildWatermark(doc.status === "draft");
  const footerHtml = buildFooter();

  // ── Assemble ──
  const body =
    watermarkHtml +
    '<div class="content">' +
      headerHtml +
      '<hr class="separator">' +
      partyRowHtml +
      shipmentBoxHtml +
      '<table style="font-size:11px"><thead><tr>' + headers.join("") + "</tr></thead><tbody>" +
        rows.join("") +
        totalsRow +
      "</tbody></table>" +
      boxesHtml +
      cargoSummaryHtml +
      notesHtml +
      footerHtml +
    "</div>";

  return wrapHtml(body, isEs, label, doc.number);
}

// ── Sub-builders ──

function buildPackingShipmentSection(
  doc: TemplateContext,
  sd: Record<string, unknown>,
): string {
  const isEs = doc.language === "es";
  if (!sd.carrier) return "";

  const leftParts: string[] = [];
  leftParts.push("<strong>" + (isEs ? "Transportadora" : "Carrier") + ":</strong> " + esc(String(sd.carrier)));
  if (sd.incoterms) leftParts.push("<strong>Incoterms:</strong> " + esc(String(sd.incoterms)));
  if (sd.awb) leftParts.push("<strong>AWB:</strong> " + esc(String(sd.awb)));

  const rightParts: string[] = [];
  rightParts.push("<strong>" + (isEs ? "Origen" : "Origin") + ":</strong> " + esc(String(sd.origin_port || "")));
  if (sd.destination_port) rightParts.push("<strong>" + (isEs ? "Destino" : "Destination") + ":</strong> " + esc(String(sd.destination_port)));
  if (sd.shipment_date) rightParts.push("<strong>" + (isEs ? "Fecha" : "Date") + ":</strong> " + esc(String(sd.shipment_date)));

  return (
    '<div style="margin-bottom:20px;padding:14px 18px;border:2px solid #111;border-radius:4px;font-size:11px">' +
      '<div style="display:flex;justify-content:space-between;gap:24px">' +
        '<div>' + leftParts.join("<br>") + '</div>' +
        '<div style="text-align:right">' + rightParts.join("<br>") + '</div>' +
      '</div>' +
    '</div>'
  );
}

function buildBoxTextLines(boxes: unknown[]): string {
  if (!Array.isArray(boxes) || boxes.length === 0) return "";

  const lines: string[] = [];
  for (const box of boxes) {
    const b = box as Record<string, unknown>;
    const qty = Number(b.quantity || 1);
    const type = String(b.type || "BOX").toUpperCase();
    const dims = String(b.dimensions || "");
    const qtyStr = String(qty).padStart(2, "0");
    lines.push(
      '<tr>' +
        '<td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;width:40px;text-align:right;font-weight:600;font-size:11px">' + qtyStr + '</td>' +
        '<td style="padding:5px 6px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:11px;letter-spacing:0.04em">' + esc(type) + '</td>' +
        '<td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:10px;color:#444">' +
          (dims ? esc(dims) : '<span style="color:#bbb">—</span>') +
        '</td>' +
      "</tr>"
    );
  }

  return (
    '<div style="margin-top:18px">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#666;margin-bottom:8px">' +
        "PACKAGING DETAILS" +
      "</div>" +
      '<table style="border:1px solid #e0e0e0;border-radius:4px;overflow:hidden">' +
        lines.join("") +
      "</table>" +
    "</div>"
  );
}

interface CargoSummaryData {
  lineItems: number;
  totalQty: number;
  boxes: unknown[];
  itemsGw: number;
  itemsNw: number;
  packagingGw: number;
  packagingNw: number;
  totalGw: number;
  totalNw: number;
  isEs: boolean;
}

function buildCargoSummary(data: CargoSummaryData): string {
  const { lineItems, totalQty, boxes, itemsGw, itemsNw, packagingGw, packagingNw, totalGw, totalNw, isEs } = data;

  // Count boxes
  const safeBoxes = Array.isArray(boxes) ? boxes : [];
  let totalBoxes = 0;
  for (const box of safeBoxes) {
    totalBoxes += Number((box as Record<string, unknown>).quantity || 1);
  }
  const packageTypes = safeBoxes.length;

  // Info row helper
  const infoCell = (label: string, value: string) =>
    '<td style="padding:5px 14px;font-size:11px">' +
      '<span style="color:#888;font-size:10px">' + label + '</span><br>' +
      '<span style="font-weight:600">' + value + '</span>' +
    '</td>';

  // Weight row helper (nwDash = true shows "—" in N.W. column)
  const weightRow = (label: string, gw: number, nw: number, isTotal = false, nwDash = false) => {
    const bg = isTotal ? "background:#111;color:#fff;" : "";
    const fw = isTotal ? "font-weight:700;" : "font-weight:500;";
    const fs = isTotal ? "font-size:11px;" : "font-size:11px;";
    const radius = isTotal ? "border-radius:0 0 4px 4px;" : "";
    const nwCell = nwDash
      ? '<td style="padding:7px 14px;text-align:right;color:#aaa">—</td>'
      : '<td style="padding:7px 14px;text-align:right;' + fw + fs + '">' + fmtKg(nw) + '</td>';
    return (
      '<tr style="' + bg + radius + '">' +
        '<td style="padding:7px 14px;' + fw + fs + 'letter-spacing:0.03em">' + label + '</td>' +
        '<td style="padding:7px 14px;text-align:right;' + fw + fs + '">' + fmtKg(gw) + '</td>' +
        nwCell +
      "</tr>"
    );
  };

  return (
    '<div style="margin-top:22px">' +
      // Title bar
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#fff;background:#111;padding:7px 14px;border-radius:4px 4px 0 0">' +
        "CARGO SUMMARY" +
      "</div>" +
      // Info strip
      '<table style="width:100%;border:1px solid #111;border-top:none;border-collapse:collapse">' +
        '<tr style="background:#f9fafb">' +
          infoCell(isEs ? "Itens" : "Line Items", String(lineItems)) +
          infoCell(isEs ? "Qtd. Total" : "Total Qty", String(totalQty)) +
          infoCell(isEs ? "Embalagens" : "Packages", packageTypes + " (" + totalBoxes + " units)") +
        '</tr>' +
      "</table>" +
      // Weight breakdown table
      '<table style="width:100%;border:1px solid #111;border-top:none;border-collapse:collapse">' +
        '<tr style="background:#f3f3f3">' +
          '<th style="padding:6px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">' + (isEs ? "Descrição" : "Description") + '</th>' +
          '<th style="padding:6px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">G.W.</th>' +
          '<th style="padding:6px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">N.W.</th>' +
        '</tr>' +
        weightRow(isEs ? "Itens" : "Items", itemsGw, itemsNw) +
        weightRow(isEs ? "Embalagem" : "Packaging", packagingGw, 0, false, true) +
        weightRow(isEs ? "TOTAL" : "TOTAL", totalGw, totalNw, true) +
      "</table>" +
    "</div>"
  );
}
