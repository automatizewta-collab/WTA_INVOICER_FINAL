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

/** Shared box style */
const BOX = "padding:10px 14px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;background:#fafafa;";

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
  const showWeights = isPackingList || isProforma;

  const typeLabels: Record<string, Record<string, string>> = {
    proforma: { en: "PROFORMA INVOICE", es: "FACTURA PROFORMA" },
    invoice: { en: "COMMERCIAL INVOICE", es: "FACTURA COMERCIAL" },
    packing_list: { en: "PACKING LIST", es: "LISTA DE EMBALAJE" },
  };
  const label = typeLabels[docType]?.[isEs ? "es" : "en"] || docType.toUpperCase();
  const isDraft = doc.status === "draft";
  const dateStr = new Date(doc.date as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const htsusTitle = esc(doc.htsusColumnTitle || "HTSUS");

  // ── Recipient info overrides (shipping address) ──
  const ri = safeParse<Record<string, string>>(doc.recipientInfo, {});
  const hasShippingOverride = !!(ri.address || ri.city || ri.state || ri.country);

  // ── Sender info text ──
  let senderLines = "";
  if (sender) {
    senderLines =
      "<strong>" + esc(sender.name) + "</strong><br>" +
      esc(sender.address || "") + "<br>" +
      esc(sender.city || "") + (sender.state ? " " + esc(sender.state) : "") + (sender.postalCode ? " " + esc(sender.postalCode) : "") + "<br>" +
      esc(sender.country || "") +
      (sender.cnpj ? "<br>CNPJ: " + esc(sender.cnpj) : "");
  }

  // ── Billing Address (recipient) ──
  let billingLines = "";
  if (recipient) {
    billingLines =
      "<strong>" + esc(recipient.name) + "</strong><br>" +
      esc(recipient.address || "") + "<br>" +
      esc(recipient.city || "") + (recipient.state ? " " + esc(recipient.state) : "") + (recipient.postalCode ? " " + esc(recipient.postalCode) : "") + "<br>" +
      esc(recipient.country || "") +
      (doc.contactName ? "<br>Contact: " + esc(doc.contactName) : "") +
      (doc.contactPhone ? " | Tel: " + esc(doc.contactPhone) : "") +
      (recipient.email ? "<br>" + esc(recipient.email) : "");
  }

  // ── Shipping Address (overrides) ──
  let shippingLines = "";
  if (hasShippingOverride) {
    shippingLines =
      (ri.name ? "<strong>" + esc(ri.name) + "</strong><br>" : (recipient ? "<strong>" + esc(recipient.name) + "</strong><br>" : "")) +
      esc(ri.address || "") + "<br>" +
      esc(ri.city || "") + (ri.state ? " " + esc(ri.state) : "") + (ri.postalCode ? " " + esc(ri.postalCode) : "") + "<br>" +
      esc(ri.country || "") +
      (ri.email ? "<br>" + esc(ri.email) : "");
  }

  // ── Order Information box content ──
  let orderInfoLines = "";
  if (doc.orderNumber || doc.purpose || doc.paymentTerms) {
    if (doc.orderNumber) orderInfoLines += "<strong>Order Reference:</strong> " + esc(doc.orderNumber) + "<br>";
    if (doc.purpose) orderInfoLines += "<strong>Purpose:</strong> " + esc(doc.purpose) + "<br>";
    if (doc.paymentTerms) orderInfoLines += "<strong>Payment Terms:</strong> " + String(doc.paymentTerms).split("\n").map((l: string) => esc(l)).join("<br>") + "<br>";
    if (doc.dollarExchangeRate) orderInfoLines += "<strong>Exchange Rate:</strong> $1 = R$ " + Number(doc.dollarExchangeRate).toFixed(4);
  }

  // ── Build the party / info grid ──
  let partyGrid = "";
  if (logoDataUri && sender) {
    const senderBox = '<div style="' + BOX + 'flex:1;min-width:0"><strong>' + (isEs ? "De" : "From") + ":</strong><br>" + senderLines + "</div>";
    const billingBox = '<div style="' + BOX + 'flex:1;min-width:0"><strong>' + (isEs ? "Endere\u00e7o de Cobran\u00e7a" : "Billing Address") + ":</strong><br>" + billingLines + "</div>";

    let row2Left = "";
    let row2Right = "";
    if (hasShippingOverride) {
      row2Left = '<div style="' + BOX + 'flex:1;min-width:0"><strong>' + (isEs ? "Endere\u00e7o de Entrega" : "Shipping Address") + ":</strong><br>" + shippingLines + "</div>";
    }
    if (orderInfoLines) {
      row2Right = '<div style="' + BOX + 'flex:1;min-width:0"><strong>' + (isEs ? "Informa\u00e7\u00f5es do Pedido" : "Order Information") + ":</strong><br>" + orderInfoLines + "</div>";
    }

    partyGrid =
      '<div style="display:flex;gap:16px;margin-bottom:20px">' + senderBox + billingBox + "</div>" +
      (row2Left || row2Right
        ? '<div style="display:flex;gap:16px;margin-bottom:20px">' + (row2Left || '<div style="flex:1"></div>') + (row2Right || '<div style="flex:1"></div>') + "</div>"
        : "");
  } else {
    // No logo: sender info in header, only billing address below
    if (recipient) {
      partyGrid = '<div style="margin-bottom:20px"><div style="' + BOX + '"><strong>' + (isEs ? "Endere\u00e7o de Cobran\u00e7a" : "Billing Address") + ":</strong><br>" + billingLines + "</div></div>";
      if (hasShippingOverride) {
        partyGrid += '<div style="margin-bottom:20px"><div style="' + BOX + '"><strong>' + (isEs ? "Endere\u00e7o de Entrega" : "Shipping Address") + ":</strong><br>" + shippingLines + "</div></div>";
      }
    }
    if (orderInfoLines) {
      partyGrid += '<div style="margin-bottom:20px"><div style="' + BOX + '"><strong>' + (isEs ? "Informa\u00e7\u00f5es do Pedido" : "Order Information") + ":</strong><br>" + orderInfoLines + "</div></div>";
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

    let row = '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + esc(item.code || "") + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + esc(name) + "</td>";

    if (isProforma && doc.showEndUseColumn) {
      row += '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + esc(endUse) + "</td>";
    }
    row += '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + esc(item.htsus_code) + "</td>";
    if (showPrices) {
      row +=
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + qty + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">$' + price.toFixed(2) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + disc + "%</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">$' + lineTotal.toFixed(2) + "</td>";
    } else {
      // Packing list: show qty without price
      row += '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + qty + "</td>";
    }
    if (showWeights) {
      row +=
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + gw.toFixed(3) + "</td>" +
        '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + nw.toFixed(3) + "</td>";
    }
    rows.push("<tr>" + row + "</tr>");
  }

  // Totals row for packing list
  if (isPackingList && items.length > 0) {
    rows.push(
      '<tr style="font-weight:700;background:#f9fafb;border-top:2px solid #111">' +
      '<td colspan="4" style="padding:6px 8px">TOTAL</td>' +
      '<td style="padding:6px 8px;text-align:center">' + (items as Record<string, unknown>[]).reduce((s, i) => s + Number(i.quantity || 0), 0) + "</td>" +
      '<td style="padding:6px 8px;text-align:right">' + totalGw.toFixed(3) + "</td>" +
      '<td style="padding:6px 8px;text-align:right">' + totalNw.toFixed(3) + "</td>" +
      "</tr>"
    );
  }

  const subtotal = (items as Record<string, unknown>[]).reduce((s, item) =>
    s + calcLineTotal({ quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), discount: Number(item.discount || 0) }), 0);

  // ── Table headers ──
  let thead = "<th>" + (isEs ? "C\u00f3digo" : "Product Code") + "</th>" +
    "<th>" + (isEs ? "Descripci\u00f3n" : "Description") + "</th>";
  if (isProforma && doc.showEndUseColumn) {
    thead += "<th>" + (isEs ? "Uso Final" : "End Use") + "</th>";
  }
  thead += "<th>" + htsusTitle + "</th>";
  if (showPrices) {
    thead +=
      '<th style="text-align:center">Qty</th>' +
      '<th style="text-align:right">Unit Price</th>' +
      '<th style="text-align:center">Disc.</th>' +
      '<th style="text-align:right">Line Total</th>';
  } else {
    thead += '<th style="text-align:center">Qty</th>';
  }
  if (showWeights) {
    thead +=
      '<th style="text-align:right">G.W. (kg)</th>' +
      '<th style="text-align:right">N.W. (kg)</th>';
  }

  const tableHtml = '<table style="font-size:11px"><thead><tr>' + thead + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>";

  // ── Financial summary (Proforma & Invoice only) ──
  let financialHtml = "";
  if (showFinancial) {
    const fd = (doc.financialDetails || {}) as Record<string, number>;
    const total = fd.total_value || subtotal;
    financialHtml =
      '<div style="margin-top:20px;display:flex;justify-content:flex-end">' +
        '<div style="' + BOX + 'width:300px;background:#fff">' +
        '<div style="font-size:12px;font-weight:700;margin-bottom:8px;border-bottom:2px solid #111;padding-bottom:4px">' + (isEs ? "Resumen Financiero" : "Financial Summary") + "</div>" +
        '<table style="width:100%;font-size:12px">' +
        '<tr><td style="padding:3px 0">Subtotal</td><td style="padding:3px 0;text-align:right;font-weight:600">$' + subtotal.toFixed(2) + "</td></tr>" +
        (fd.discount ? '<tr><td style="padding:3px 0">Discount (' + fd.discount + "%)</td><td style=\"padding:3px 0;text-align:right\">-$" + (subtotal * fd.discount / 100).toFixed(2) + "</td></tr>" : "") +
        (fd.shipping_cost ? '<tr><td style="padding:3px 0">Freight</td><td style="padding:3px 0;text-align:right">$' + Number(fd.shipping_cost).toFixed(2) + "</td></tr>" : "") +
        (fd.insurance ? '<tr><td style="padding:3px 0">Insurance</td><td style="padding:3px 0;text-align:right">$' + Number(fd.insurance).toFixed(2) + "</td></tr>" : "") +
        (fd.bank_fees ? '<tr><td style="padding:3px 0">Bank Fees</td><td style="padding:3px 0;text-align:right">$' + Number(fd.bank_fees).toFixed(2) + "</td></tr>" : "") +
        '<tr style="border-top:2px solid #111"><td style="padding:6px 0;font-weight:700;font-size:14px">TOTAL</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:14px">$' + total.toFixed(2) + "</td></tr>" +
        '</table></div></div>';
  }

  // ── Shipment Details box (Proforma & Packing List only) ──
  let shipmentHtml = "";
  if (showShipment) {
    const sd = (doc.shipmentDetails || {}) as Record<string, unknown>;
    const hasShipmentData = sd.carrier || sd.incoterms || sd.origin_port || sd.destination_port || sd.awb || sd.shipment_date;
    if (hasShipmentData) {
      let inner = "";
      if (sd.carrier) inner += "<strong>Carrier:</strong> " + esc(sd.carrier) + "<br>";
      if (sd.incoterms) inner += "<strong>Incoterms:</strong> " + esc(sd.incoterms) + "<br>";
      if (sd.origin_port) inner += "<strong>" + (isEs ? "Origen" : "Origin") + ":</strong> " + esc(sd.origin_port) + "<br>";
      if (sd.destination_port) inner += "<strong>" + (isEs ? "Destino" : "Destination") + ":</strong> " + esc(sd.destination_port) + "<br>";
      if (sd.awb) inner += "<strong>AWB / BL:</strong> " + esc(sd.awb) + "<br>";
      if (sd.shipment_date) inner += "<strong>" + (isEs ? "Fecha" : "Shipment Date") + ":</strong> " + esc(sd.shipment_date) + "<br>";
      // Boxes info
      const boxes = (sd.boxes || []) as Record<string, unknown>[];
      if (boxes.length > 0) {
        inner += "<strong>Packages:</strong> ";
        inner += boxes.map((b) => {
          const parts: string[] = [];
          if (b.quantity) parts.push(b.quantity + "x");
          if (b.type) parts.push(esc(b.type));
          if (b.dimensions) parts.push(esc(b.dimensions));
          return parts.join(" ");
        }).join(", ");
        inner += "<br>";
      }
      // Weight totals for packing list
      if (isPackingList && items.length > 0) {
        const sdGw = Number(sd.gross_weight || 0);
        const sdNw = Number(sd.net_weight || 0);
        inner += "<br><strong>Total Gross Weight:</strong> " + (sdGw || totalGw).toFixed(3) + " kg<br>";
        inner += "<strong>Total Net Weight:</strong> " + (sdNw || totalNw).toFixed(3) + " kg";
      }
      shipmentHtml =
        '<div style="margin-top:20px"><div style="' + BOX + '"><strong>' + (isEs ? "Detalles del Embarque" : "Shipment Details") + "</strong><br><br>" +
        inner + "</div></div>";
    }
  }

  // ── Bank Details box (Proforma only) ──
  let bankHtml = "";
  if (isProforma && sender?.bankDetails) {
    bankHtml =
      '<div style="margin-top:20px"><div style="' + BOX + '"><strong>' + (isEs ? "Detalles Bancarios" : "Bank Details") + "</strong><br><br>" +
      esc(sender.bankDetails).replace(/\n/g, "<br>") +
      "</div></div>";
  }

  // ── Notes ──
  const notes = (doc.notes || []) as string[];
  let notesHtml = "";
  if (notes.length > 0) {
    notesHtml =
      '<div style="margin-top:20px"><div style="' + BOX + '"><strong>' + (isEs ? "Notas" : "Notes") + "</strong><br><br>" +
      notes.map(n => '<p style="margin:2px 0">\u2022 ' + esc(n) + "</p>").join("") +
      "</div></div>";
  }

  // ── Logo header ──
  let headerHtml: string;
  if (logoDataUri) {
    headerHtml =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<img src="' + logoDataUri + '" alt="Logo" style="height:56px;width:auto;max-width:250px;object-fit:contain" />' +
        '<div><h1 style="font-size:20px;font-weight:800;color:#111;text-align:right">' + label + '</h1>' +
        '<p style="font-size:12px;color:#666;margin-top:2px;text-align:right">' + esc(doc.number) + " | " + dateStr + "</p></div>" +
        "</div>";
  } else {
    headerHtml =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        '<div><h1 style="font-size:20px;font-weight:800;color:#111">' + label + '</h1>' +
        '<p style="font-size:12px;color:#666;margin-top:2px">' + esc(doc.number) + " | " + dateStr + "</p></div>" +
        '<div style="text-align:right;font-size:11px">' + senderLines + "</div></div>";
  }

  // ── Assemble final HTML ──
  return "<!DOCTYPE html>" +
    '<html lang="' + (isEs ? "es" : "en") + '">' +
    '<head><meta charset="utf-8"><title>' + label + ' - ' + esc(doc.number) + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 15mm; }' +
    '* { margin: 0; padding: 0; box-sizing: border-box; }' +
    'body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; color: #111; font-size: 11px; line-height: 1.5; }' +
    '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(255,0,0,0.12); font-weight: 900; z-index: 0; pointer-events: none; }' +
    '.content { position: relative; z-index: 1; }' +
    'table { border-collapse: collapse; width: 100%; }' +
    'th { background: #f3f4f6; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #111; }' +
    '.separator { border: none; border-top: 1.5px solid #111; margin: 12px 0; }' +
    '</style></head><body>' +
    (isDraft ? '<div class="watermark">DRAFT</div>' : '') +
    '<div class="content">' +
    headerHtml +
    '<hr class="separator">' +
    partyGrid +
    tableHtml +
    financialHtml +
    shipmentHtml +
    bankHtml +
    notesHtml +
    '<div style="margin-top:16px;text-align:center;font-size:9px;color:#999">Generated by Invoicer | ' + new Date().toISOString() + '</div>' +
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
