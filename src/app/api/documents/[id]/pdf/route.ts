import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { calcLineTotal } from "@/lib/document-calculations";

/** HTML-escape */
function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Safe JSON parse: handles both string (SQLite) and object (MySQL) */
function safeParse<T = unknown>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val as T;
  try { return JSON.parse(String(val)) as T; } catch { return fallback; }
}

/** Format weight: 1.234 → "1,234" (comma decimal) */
function fmtWt(val: number): string {
  return val.toFixed(3).replace(".", ",");
}

/** Read a logo file and return a base64 data URI */
async function getLogoBase64(sender: Record<string, unknown> | null): Promise<string | null> {
  const paths = [
    sender?.logoUrl
      ? join(process.cwd(), "public", String(sender.logoUrl).replace(/^\//, ""))
      : null,
    join(process.cwd(), "public", "logos", "wta-logo.png"),
  ].filter(Boolean) as string[];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const buf = await readFile(p);
        return "data:image/png;base64," + buf.toString("base64");
      } catch { /* skip */ }
    }
  }
  return null;
}

/** Professional box style — rounded, slightly thicker border */
const BOX = "padding:14px 18px;border:1.5px solid #c8cdd3;border-radius:10px;font-size:11px;background:#fafbfc;line-height:1.65;";
const BOX_HEADER = "font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:8px;border-bottom:1.5px solid #e2e5ea;padding-bottom:6px;";

/** Parse bank details text into labeled rows */
function formatBankDetails(raw: string): string {
  const lines = raw.split(/[\n|;]+/).map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    if (/^[\w\s]+:/i.test(line)) {
      const [label, ...rest] = line.split(/:\s*/);
      return "<strong>" + esc(label.trim()) + ":</strong> " + esc(rest.join(": "));
    }
    return esc(line);
  }).join("<br>");
}

// ─────────────────────────────────────────────────
function buildPdfHtml(
  doc: Record<string, unknown>,
  items: unknown[],
  sender: Record<string, unknown> | null,
  recipient: Record<string, unknown> | null,
  logoDataUri: string | null,
): string {
  const isEs = doc.language === "es";
  const docType = String(doc.documentType || "proforma");
  const isProforma = docType === "proforma";
  const isInvoice = docType === "invoice";
  const isPackingList = docType === "packing_list";

  const showFinancial = isProforma || isInvoice;
  const showShipment = isProforma || isPackingList;
  const showPrices = isProforma || isInvoice;
  const showWeights = isPackingList;
  const showBankDetails = isProforma;

  const typeLabels: Record<string, Record<string, string>> = {
    proforma: { en: "PROFORMA INVOICE", es: "FACTURA PROFORMA" },
    invoice:  { en: "COMMERCIAL INVOICE", es: "FACTURA COMERCIAL" },
    packing_list: { en: "PACKING LIST", es: "LISTA DE EMBALAJE" },
  };
  const label = typeLabels[docType]?.[isEs ? "es" : "en"] || docType.toUpperCase();
  const isDraft = doc.status === "draft";
  const dateStr = new Date(doc.date as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const htsusTitle = esc(doc.htsusColumnTitle || "HTSUS");
  const currency = String(doc.currency || "USD").toUpperCase();
  const curSym = currency === "EUR" ? "\u20ac" : "$";

  // ── Recipient info overrides (shipping address) ──
  const ri = safeParse<Record<string, string>>(doc.recipientInfo, {});
  const shippingAddr = (ri.address || "").trim().toLowerCase();
  const shippingCity = (ri.city || "").trim().toLowerCase();
  const billingAddr = (recipient?.address || "").trim().toLowerCase();
  const billingCity = (recipient?.city || "").trim().toLowerCase();
  const isShippingDifferent = !!(shippingAddr && shippingAddr !== billingAddr) ||
    !!(shippingCity && shippingCity !== billingCity);

  // ── Sender info text ──
  let senderLines = "";
  if (sender) {
    senderLines =
      "<strong style=\"font-size:12px\">" + esc(sender.name) + "</strong><br>" +
      esc(sender.address || "") + "<br>" +
      esc(sender.city || "") + (sender.state ? " - " + esc(sender.state) : "") + (sender.postalCode ? " - " + esc(sender.postalCode) : "") + "<br>" +
      esc(sender.country || "") +
      (sender.cnpj ? "<br><span style=\"color:#6b7280;font-size:10px\">CNPJ: " + esc(sender.cnpj) + "</span>" : "");
  }

  // ── Billing Address (recipient) ──
  let billingLines = "";
  if (recipient) {
    billingLines =
      "<strong style=\"font-size:12px\">" + esc(recipient.name) + "</strong><br>" +
      esc(recipient.address || "") + "<br>" +
      esc(recipient.city || "") + (recipient.state ? " - " + esc(recipient.state) : "") + (recipient.postalCode ? " - " + esc(recipient.postalCode) : "") + "<br>" +
      esc(recipient.country || "") +
      (doc.contactName ? "<br><span style=\"color:#6b7280;font-size:10px\">Contact: " + esc(doc.contactName) + "</span>" : "") +
      (doc.contactPhone ? " <span style=\"color:#6b7280;font-size:10px\">| Tel: " + esc(doc.contactPhone) + "</span>" : "") +
      (recipient.email ? "<br><span style=\"color:#6b7280;font-size:10px\">" + esc(recipient.email) + "</span>" : "");
  }

  // ── Shipping Address (only when different from billing) ──
  let shippingLines = "";
  if (isShippingDifferent) {
    shippingLines =
      (recipient ? "<strong style=\"font-size:12px\">" + esc(recipient.name) + "</strong><br>" : "") +
      esc(ri.address || "") + "<br>" +
      esc(ri.city || "") + (ri.state ? " - " + esc(ri.state) : "") + (ri.postalCode ? " - " + esc(ri.postalCode) : "") + "<br>" +
      esc(ri.country || "") +
      (ri.email ? "<br><span style=\"color:#6b7280;font-size:10px\">" + esc(ri.email) + "</span>" : "");
  }

  // ── Order Information box content ──
  let orderInfoLines = "";
  if (doc.orderNumber || doc.purpose || doc.paymentTerms) {
    if (doc.orderNumber) orderInfoLines += "<strong>Order Reference:</strong> " + esc(doc.orderNumber) + "<br>";
    if (doc.purpose) orderInfoLines += "<strong>Purpose:</strong> " + esc(doc.purpose) + "<br>";
    if (doc.paymentTerms) orderInfoLines += "<strong>Payment Terms:</strong> " + String(doc.paymentTerms).split("\n").map((l: string) => esc(l)).join("<br>") + "<br>";

  }

  // ── Build the party / info grid ──
  let partyGrid = "";
  if (logoDataUri && sender) {
    // Row 1: Sender | Billing Address (side by side)
    const senderBox = '<div style="' + BOX + 'flex:1;min-width:0"><div style="' + BOX_HEADER + '">' + (isEs ? "Remetente" : "From") + '</div>' + senderLines + "</div>";
    const billingBox = '<div style="' + BOX + 'flex:1;min-width:0;background:#f0f4ff;border-color:#c7d5f5"><div style="' + BOX_HEADER + '">Billing Address</div>' + billingLines + "</div>";

    // Row 2: Order Information (left) | Shipping Address (right, always shown)
    let row2 = "";
    const shippingContent = isShippingDifferent
      ? shippingLines
      : '<span style="color:#9ca3af;font-style:italic">' + (isEs ? "Mismo destino que facturaci\u00f3n" : "Same as Billing Address") + "</span>";
    const orderBox = orderInfoLines
      ? '<div style="' + BOX + 'flex:1;min-width:0"><div style="' + BOX_HEADER + '">Order Information</div>' + orderInfoLines + "</div>"
      : '<div style="' + BOX + 'flex:1;min-width:0"><div style="' + BOX_HEADER + '">Order Information</div><span style="color:#9ca3af">&mdash;</span></div>';
    const shippingBox = '<div style="' + BOX + 'flex:1;min-width:0;background:#f0f4ff;border-color:#c7d5f5"><div style="' + BOX_HEADER + '">Shipping Address</div>' + shippingContent + "</div>";
    row2 = '<div style="display:flex;gap:16px;margin-bottom:20px">' + orderBox + shippingBox + "</div>";

    partyGrid =
      '<div style="display:flex;gap:16px;margin-bottom:20px">' + senderBox + billingBox + "</div>" +
      row2;
  } else {
    if (sender) {
      partyGrid = '<div style="margin-bottom:20px"><div style="' + BOX + '"><div style="' + BOX_HEADER + '">' + (isEs ? "Remetente" : "From") + "</div>" + senderLines + "</div></div>";
    }
    if (recipient) {
      partyGrid += '<div style="margin-bottom:20px"><div style="' + BOX + 'background:#f0f4ff;border-color:#c7d5f5"><div style="' + BOX_HEADER + '">Billing Address</div>' + billingLines + "</div></div>";
    }
    if (isShippingDifferent) {
      partyGrid += '<div style="margin-bottom:20px"><div style="' + BOX + 'background:#f0f4ff;border-color:#c7d5f5"><div style="' + BOX_HEADER + '">Shipping Address</div>' + shippingLines + "</div></div>";
    }
    if (orderInfoLines) {
      partyGrid += '<div style="margin-bottom:20px"><div style="' + BOX + '"><div style="' + BOX_HEADER + '">Order Information</div>' + orderInfoLines + "</div></div>";
    }
  }

  // ── Items table ──
  const rows: string[] = [];
  let totalGw = 0;
  let totalNw = 0;
  for (const rawItem of items) {
    const item = rawItem as Record<string, unknown>;
    const name = isEs ? (item.name_es || item.name_en || item.name_pt || "") : (item.name_en || item.name_pt || "");
    const endUse = isEs ? (item.end_use_es || item.end_use || "") : (item.end_use || "");
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const disc = Number(item.discount || 0);
    const lineTotal = calcLineTotal({ quantity: qty, unit_price: price, discount: disc });
    const gw = Number(item.gross_weight || 0);
    const nw = Number(item.net_weight || 0);
    totalGw += gw * qty;
    totalNw += nw * qty;
    const bg = rows.length % 2 === 1 ? "background:#f7f8fa;" : "";

    let row = '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px">' + esc(item.code || "") + "</td>" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px">' + esc(name) + "</td>";

    if (isProforma && doc.showEndUseColumn) {
      row += '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + esc(endUse) + "</td>";
    }
    row += '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px">' + esc(item.htsus_code) + "</td>";
    if (showPrices) {
      row +=
        '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + qty + "</td>" +
        '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right">' + curSym + price.toFixed(2) + "</td>" +
        '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + disc + "%</td>" +
        '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right;font-weight:600">' + curSym + lineTotal.toFixed(2) + "</td>";
    } else {
      row += '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + qty + "</td>";
    }
    if (showWeights) {
      row +=
        '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right">' + fmtWt(gw) + "</td>" +
        '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right">' + fmtWt(nw) + "</td>";
    }
    rows.push("<tr style=\"" + bg + "\">" + row + "</tr>");
  }

  // Totals row for packing list — columns: Code, Description, HTSUS, Qty, G.W., N.W. = 6 cols
  if (isPackingList && items.length > 0) {
    const totalQty = (items as Record<string, unknown>[]).reduce((s, i) => s + Number(i.quantity || 0), 0);
    rows.push(
      '<tr style="font-weight:700;background:#f3f4f6;border-top:2px solid #111">' +
      '<td colspan="3" style="padding:8px 8px;border-bottom:1.5px solid #111">TOTAL</td>' +
      '<td style="padding:8px 8px;text-align:center;border-bottom:1.5px solid #111">' + totalQty + "</td>" +
      '<td style="padding:8px 8px;text-align:right;border-bottom:1.5px solid #111">' + fmtWt(totalGw) + "</td>" +
      '<td style="padding:8px 8px;text-align:right;border-bottom:1.5px solid #111">' + fmtWt(totalNw) + "</td>" +
      "</tr>"
    );
  }

  const subtotal = (items as Record<string, unknown>[]).reduce((s, item) =>
    s + calcLineTotal({ quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), discount: Number(item.discount || 0) }), 0);

  // ── Table headers (dark style) ──
  const thStyle = "background:#1e293b;color:#fff;padding:9px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em";
  const thStyleR = thStyle + ";text-align:right";
  const thStyleC = thStyle + ";text-align:center";

  let thead = '<th style="' + thStyle + '">' + (isEs ? "C\u00f3digo" : "Product Code") + "</th>" +
    '<th style="' + thStyle + '">' + (isEs ? "Descripci\u00f3n" : "Description") + "</th>";
  if (isProforma && doc.showEndUseColumn) {
    thead += '<th style="' + thStyleC + '">' + (isEs ? "Uso Final" : "End Use") + "</th>";
  }
  thead += '<th style="' + thStyle + '">' + htsusTitle + "</th>";
  if (showPrices) {
    thead +=
      '<th style="' + thStyleC + '">Qty</th>' +
      '<th style="' + thStyleR + '">Unit Price</th>' +
      '<th style="' + thStyleC + '">Disc.</th>' +
      '<th style="' + thStyleR + '">Line Total</th>';
  } else {
    thead += '<th style="' + thStyleC + '">Qty</th>';
  }
  if (showWeights) {
    thead +=
      '<th style="' + thStyleR + '">G.W. (kg)</th>' +
      '<th style="' + thStyleR + '">N.W. (kg)</th>';
  }

  const tableHtml = '<table style="font-size:11px"><thead><tr>' + thead + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>";

  // ── Financial summary (Proforma & Invoice) — with BRL column ──
  let financialHtml = "";
  if (showFinancial) {
    const fd = (doc.financialDetails || {}) as Record<string, number>;
    const total = fd.total_value || subtotal;
    const discAmt = fd.discount ? subtotal * fd.discount / 100 : 0;
    const rate = Number(doc.dollarExchangeRate || 0);
    const hasBrl = rate > 0;

    financialHtml =
      '<div style="margin-top:24px;display:flex;justify-content:flex-end">' +
        '<div style="' + BOX + 'width:' + (hasBrl ? '380px' : '300px') + ';background:#fff"><div style="' + BOX_HEADER + '">' + (isEs ? "Resumen Financiero" : "Financial Summary") + "</div>" +
        '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
        '<tr><td style="padding:4px 0;color:#6b7280">Subtotal</td><td style="padding:4px 0;text-align:right">' + curSym + subtotal.toFixed(2) + "</td>" +
        (hasBrl ? '<td style="padding:4px 0;text-align:right;color:#6b7280">R$ ' + (subtotal * rate).toFixed(2) + "</td>" : "") +
        "</tr>" +
        (discAmt > 0 ? '<tr><td style="padding:4px 0;color:#6b7280">Discount (' + fd.discount + "%)</td><td style=\"padding:4px 0;text-align:right;color:#dc2626\">-" + curSym + discAmt.toFixed(2) + "</td>" +
        (hasBrl ? '<td style="padding:4px 0;text-align:right;color:#dc2626">-R$ ' + (discAmt * rate).toFixed(2) + "</td>" : "") +
        "</tr>" : "") +
        (fd.shipping_cost ? '<tr><td style="padding:4px 0;color:#6b7280">' + (isEs ? "Flete" : "Freight") + '</td><td style="padding:4px 0;text-align:right">' + curSym + Number(fd.shipping_cost).toFixed(2) + "</td>" +
        (hasBrl ? '<td style="padding:4px 0;text-align:right;color:#6b7280">R$ ' + (Number(fd.shipping_cost) * rate).toFixed(2) + "</td>" : "") +
        "</tr>" : "") +
        (fd.insurance ? '<tr><td style="padding:4px 0;color:#6b7280">' + (isEs ? "Seguro" : "Insurance") + '</td><td style="padding:4px 0;text-align:right">' + curSym + Number(fd.insurance).toFixed(2) + "</td>" +
        (hasBrl ? '<td style="padding:4px 0;text-align:right;color:#6b7280">R$ ' + (Number(fd.insurance) * rate).toFixed(2) + "</td>" : "") +
        "</tr>" : "") +
        (fd.bank_fees ? '<tr><td style="padding:4px 0;color:#6b7280">' + (isEs ? "Tarifas Bancarias" : "Bank Fees") + '</td><td style="padding:4px 0;text-align:right">' + curSym + Number(fd.bank_fees).toFixed(2) + "</td>" +
        (hasBrl ? '<td style="padding:4px 0;text-align:right;color:#6b7280">R$ ' + (Number(fd.bank_fees) * rate).toFixed(2) + "</td>" : "") +
        "</tr>" : "") +
        '<tr style="border-top:2.5px solid #111"><td style="padding:8px 0 4px;font-weight:700;font-size:14px;color:#111">TOTAL</td><td style="padding:8px 0 4px;text-align:right;font-weight:700;font-size:14px;color:#111">' + curSym + total.toFixed(2) + "</td>" +
        (hasBrl ? '<td style="padding:8px 0 4px;text-align:right;font-weight:700;font-size:14px;color:#111">R$ ' + (total * rate).toFixed(2) + "</td>" : "") +
        "</tr>" +
        '</table></div></div>';
  }

  // ── Shipment Details (2-column grid) — Proforma & Packing List ──
  let shipmentInner = "";
  if (showShipment) {
    const sd = (doc.shipmentDetails || {}) as Record<string, unknown>;
    const shipFields: string[] = [];
    if (sd.carrier) shipFields.push("<strong>" + (isEs ? "Transportadora" : "Carrier") + ":</strong> " + esc(sd.carrier));
    if (sd.incoterms) shipFields.push("<strong>Incoterms:</strong> " + esc(sd.incoterms));
    if (sd.origin_port) shipFields.push("<strong>" + (isEs ? "Puerto Origen" : "Origin Port") + ":</strong> " + esc(sd.origin_port));
    if (sd.destination_port) shipFields.push("<strong>" + (isEs ? "Puerto Destino" : "Destination Port") + ":</strong> " + esc(sd.destination_port));
    if (sd.awb) shipFields.push("<strong>AWB / MAWB:</strong> " + esc(sd.awb));
    if (sd.shipment_date) shipFields.push("<strong>" + (isEs ? "Fecha Embarque" : "Shipment Date") + ":</strong> " + esc(sd.shipment_date));

    if (shipFields.length > 0) {
      shipmentInner = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11px">' +
        shipFields.map(f => '<div>' + f + '</div>').join("") +
        '</div>';

      const boxes = (sd.boxes || []) as Record<string, unknown>[];
      if (boxes.length > 0) {
        shipmentInner += '<div style="margin-top:6px;font-size:11px"><strong>' + (isEs ? "Cajas" : "Packages") + ':</strong> ';
        shipmentInner += boxes.map((b) => {
          const parts: string[] = [];
          if (b.quantity) parts.push(b.quantity + "x");
          if (b.type) parts.push(esc(b.type));
          if (b.dimensions) parts.push(esc(b.dimensions));
          return parts.join(" ");
        }).join(", ");
        shipmentInner += "</div>";
      }
    }

    if (isPackingList && items.length > 0) {
      const sdGw = Number((sd as Record<string, number>).gross_weight || 0);
      const sdNw = Number((sd as Record<string, number>).net_weight || 0);
      shipmentInner += (shipmentInner ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">' : '<div>') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11px">' +
        '<div><strong>Total G.W.:</strong> ' + fmtWt(sdGw || totalGw) + ' kg</div>' +
        '<div><strong>Total N.W.:</strong> ' + fmtWt(sdNw || totalNw) + ' kg</div>' +
        '</div></div>';
    }
  }

  // ── Bank Details (Proforma only) ──
  let bankInner = "";
  if (showBankDetails && sender?.bankDetails) {
    bankInner = formatBankDetails(String(sender.bankDetails));
  }

  // ── Combine Bank + Shipment boxes ──
  let bottomSectionHtml = "";
  if (isProforma && (bankInner || shipmentInner)) {
    const bankBox = bankInner
      ? '<div style="' + BOX + 'flex:1;min-width:0"><div style="' + BOX_HEADER + '">Bank Details</div>' + bankInner + "</div>"
      : "";
    const shipBox = shipmentInner
      ? '<div style="' + BOX + 'flex:1;min-width:0;background:#f9fafb;border-color:#e5e7eb"><div style="' + BOX_HEADER + '">' + (isEs ? "Detalles del Embarque" : "Shipment Details") + "</div>" + shipmentInner + "</div>"
      : "";
    if (bankBox && shipBox) {
      bottomSectionHtml = '<div style="margin-top:24px;display:flex;gap:16px">' + bankBox + shipBox + "</div>";
    } else if (bankBox) {
      bottomSectionHtml = '<div style="margin-top:24px">' + bankBox + "</div>";
    } else if (shipBox) {
      bottomSectionHtml = '<div style="margin-top:24px">' + shipBox + "</div>";
    }
  } else if (isPackingList && shipmentInner) {
    bottomSectionHtml =
      '<div style="margin-top:24px"><div style="' + BOX + 'background:#f9fafb;border-color:#e5e7eb"><div style="' + BOX_HEADER + '">' + (isEs ? "Detalles del Embarque" : "Shipment Details") + "</div>" + shipmentInner + "</div></div>";
  }

  // ── Notes (amber themed) ──
  const notes = (doc.notes || []) as string[];
  let notesHtml = "";
  if (notes.length > 0) {
    notesHtml =
      '<div style="margin-top:20px;background:#fffbf0;border-left:4px solid #f59e0b;padding:12px 16px;font-size:11px;border-radius:0 10px 10px 0">' +
      '<p style="font-weight:700;margin-bottom:6px;color:#92400e">' + (isEs ? "Notas" : "Notes") + "</p>" +
      notes.map(n => '<p style="margin:3px 0;color:#78350f">\u2022 ' + esc(n) + "</p>").join("") +
      "</div>";
  }

  // ── Logo header ──
  let headerHtml: string;
  if (logoDataUri) {
    headerHtml =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<img src="' + logoDataUri + '" alt="Logo" style="height:60px;width:auto;max-width:260px;object-fit:contain" />' +
        '<div style="text-align:right">' +
          '<h1 style="font-size:22px;font-weight:800;color:#111;letter-spacing:0.5px">' + label + "</h1>" +
          '<div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:4px">' +
            '<span style="font-size:12px;color:#374151;font-weight:600;font-family:monospace">' + esc(doc.number) + "</span>" +
            '<span style="font-size:11px;color:#9ca3af">|</span>' +
            '<span style="font-size:11px;color:#6b7280">' + dateStr + "</span>" +
          "</div>" +
          (isDraft ? '<span style="display:inline-block;margin-top:6px;padding:2px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.5px">DRAFT</span>' : "") +
        "</div>" +
      "</div>";
  } else {
    headerHtml =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
        "<div>" +
          '<h1 style="font-size:22px;font-weight:800;color:#111;letter-spacing:0.5px">' + label + "</h1>" +
          '<div style="display:flex;align-items:center;gap:12px;margin-top:4px">' +
            '<span style="font-size:12px;color:#374151;font-weight:600;font-family:monospace">' + esc(doc.number) + "</span>" +
            '<span style="font-size:11px;color:#9ca3af">|</span>' +
            '<span style="font-size:11px;color:#6b7280">' + dateStr + "</span>" +
          "</div>" +
        "</div>" +
        '<div style="text-align:right;font-size:11px">' + senderLines + "</div>" +
      "</div>";
  }

  // ── Assemble final HTML ──
  return "<!DOCTYPE html>" +
    '<html lang="' + (isEs ? "es" : "en") + '">' +
    '<head><meta charset="utf-8"><title>' + label + ' - ' + esc(doc.number) + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 12mm 15mm; }' +
    '* { margin: 0; padding: 0; box-sizing: border-box; }' +
    'body { font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.5; }' +
    '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(220,38,38,0.08); font-weight: 900; z-index: 0; pointer-events: none; letter-spacing: 10px; }' +
    '.content { position: relative; z-index: 1; }' +
    'table { border-collapse: collapse; width: 100%; }' +
    'table th:first-child { border-radius: 6px 0 0 0; }' +
    'table th:last-child { border-radius: 0 6px 0 0; }' +
    '.separator { border: none; border-top: 2px solid #1e293b; margin: 0; }' +
    '</style></head><body>' +
    (isDraft ? '<div class="watermark">DRAFT</div>' : '') +
    '<div class="content">' +
    headerHtml +
    '<hr class="separator">' +
    partyGrid +
    tableHtml +
    financialHtml +
    bottomSectionHtml +
    notesHtml +
    '<div style="margin-top:20px;text-align:center;font-size:9px;color:#c0c4cc;letter-spacing:0.3px">Generated by Invoicer \u00b7 ' + new Date().toISOString().slice(0, 10) + "</div>" +
    '</div></body></html>';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await db.document.findUnique({
      where: { id },
      include: { sender: true, recipient: true },
    });
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Parse items and enrich with catalog data
    let items: Record<string, unknown>[] = safeParse(document.items, []);
    if (items.length > 0) {
      const catalogItems = await db.item.findMany();
      const catalogMap = new Map(catalogItems.map(ci => [ci.id, ci as unknown as Record<string, unknown>]));
      items = items.map(item => {
        const catalog = catalogMap.get(String(item.item_id || ""));
        if (catalog) {
          return { ...item, code: catalog.code || item.code || "", name_pt: catalog.namePt, name_en: catalog.nameEn, name_es: catalog.nameEs || catalog.nameEn, end_use: catalog.endUse, end_use_es: catalog.endUseEs || catalog.endUse, htsus_code: catalog.htsusCode || item.htsus_code };
        }
        return { ...item, code: item.code || "" };
      });
    }

    const docForTemplate: Record<string, unknown> = {
      documentType: document.documentType, status: document.status, language: document.language,
      number: document.number, date: document.date, htsusColumnTitle: document.htsusColumnTitle,
      dollarExchangeRate: document.dollarExchangeRate,
      notes: safeParse<string[]>(document.notes, []),
      shipmentDetails: safeParse(document.shipmentDetails, {}),
      financialDetails: safeParse(document.financialDetails, {}),
      contactName: document.contactName, contactPhone: document.contactPhone,
      recipientInfo: safeParse(document.recipientInfo, {}),
      showEndUseColumn: document.showEndUseColumn, showSterileColumn: document.showSterileColumn,
      orderNumber: document.orderNumber, purpose: document.purpose, paymentTerms: document.paymentTerms,
      currency: document.currency,
    };

    const logoDataUri = await getLogoBase64(document.sender as unknown as Record<string, unknown> | null);
    const html = buildPdfHtml(docForTemplate, items, document.sender as unknown as Record<string, unknown> | null, document.recipient as unknown as Record<string, unknown> | null, logoDataUri);

    // Save HTML to disk
    const pdfDir = join(process.cwd(), "db", "pdfs");
    await mkdir(pdfDir, { recursive: true });
    await writeFile(join(pdfDir, String(document.number) + ".html"), html, "utf-8");

    await db.document.update({ where: { id }, data: { pdfUrl: "/api/documents/" + id + "/pdf" } });
    return NextResponse.json({ success: true, pdfUrl: "/api/documents/" + id + "/pdf", message: "PDF generated successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });
    if (!document || !document.pdfUrl) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    const filepath = join(process.cwd(), "db", "pdfs", String(document.number) + ".html");
    const html = await readFile(filepath, "utf-8");
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline; filename=\"" + document.number + ".html\"" },
    });
  } catch {
    return NextResponse.json({ error: "PDF not found on disk" }, { status: 404 });
  }
}
