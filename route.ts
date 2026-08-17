import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { calcLineTotal } from "@/lib/document-calculations";
import { safeJsonParse } from "@/lib/utils";

/** HTML-escape: handles &, <, >, ", ' */
function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Helper: financial row */
function finRow(label: string, value: string, brl: string): string {
  const hasBrl = brl.length > 0;
  return "<tr><td style=\"padding:4px 10px;color:#6b7280\">" + label + "</td>" +
    '<td style="padding:4px 10px;text-align:right">' + value + "</td>" +
    (hasBrl ? '<td style="padding:4px 10px;text-align:right;color:#6b7280">' + brl + "</td>" : "") +
    "</tr>";
}

/** Helper: shipment field */
function shipField(label: string, value: string): string {
  return '<div style="margin-bottom:2px"><span style="color:#6b7280">' + label + ":</span> <strong>" + esc(value) + "</strong></div>";
}

/**
 * Read a logo file and return a base64 data URI.
 */
async function getLogoBase64(
  sender: Record<string, unknown> | null,
): Promise<string | null> {
  const logoPaths = [
    sender?.logoUrl
      ? join(process.cwd(), "public", String(sender.logoUrl).replace(/^\//, ""))
      : null,
    join(process.cwd(), "public", "logos", "wta-logo.png"),
  ].filter(Boolean) as string[];

  for (const p of logoPaths) {
    if (existsSync(p)) {
      try {
        const buf = await readFile(p);
        const b64 = buf.toString("base64");
        return "data:image/png;base64," + b64;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

function buildPdfHtml(
  doc: Record<string, unknown>,
  items: unknown[],
  sender: Record<string, unknown> | null,
  recipient: Record<string, unknown> | null,
  logoDataUri: string | null,
): string {
  const isEs = doc.language === "es";
  const docType = String(doc.documentType || "proforma");
  const isDraft = doc.status === "draft";

  const typeLabels: Record<string, Record<string, string>> = {
    proforma: { en: "PROFORMA INVOICE", es: "FACTURA PROFORMA" },
    invoice:  { en: "COMMERCIAL INVOICE", es: "FACTURA COMERCIAL" },
    packing_list: { en: "PACKING LIST", es: "LISTA DE EMBALAJE" },
  };
  const label = typeLabels[docType]?.[isEs ? "es" : "en"] || docType.toUpperCase();
  const dateStr = new Date(doc.date as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const htsusTitle = esc(doc.htsusColumnTitle || "HTSUS");

  // ── Items table rows ──
  const rows: string[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const rawItem = items[idx];
    const item = rawItem as Record<string, unknown>;
    const name = isEs
      ? (item.name_es || item.name_en || item.name_pt || "")
      : (item.name_en || item.name_pt || "");
    const endUse = isEs
      ? (item.end_use_es || item.end_use || "")
      : (item.end_use || "");
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const disc = Number(item.discount || 0);
    const lineTotal = calcLineTotal({ quantity: qty, unit_price: price, discount: disc });
    const gw = Number(item.gross_weight || 0);
    const nw = Number(item.net_weight || 0);
    const isSterile = String(item.sterile_at_import || "NO").toUpperCase() === "YES";
    const bg = idx % 2 === 0 ? "" : "background:#f7f8fa;";

    rows.push(
      "<tr style=\"" + bg + "\">" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px">' + esc(item.code || "") + "</td>" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;max-width:220px">' + esc(name) + "</td>" +
      (doc.showEndUseColumn ? '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + esc(endUse) + "</td>" : "") +
      (doc.showSterileColumn ? '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + (isSterile ? '<span style="color:#16a34a;font-weight:600">YES</span>' : '<span style="color:#9ca3af">NO</span>') + "</td>" : "") +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px">' + esc(item.htsus_code) + "</td>" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + qty + "</td>" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right">$' + price.toFixed(2) + "</td>" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:center">' + disc + "%</td>" +
      '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right;font-weight:600">$' + lineTotal.toFixed(2) + "</td>" +
      (docType === "packing_list"
        ? '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right">' + gw + "</td>" +
          '<td style="padding:7px 8px;border-bottom:1px solid #e2e4e8;font-size:10px;text-align:right">' + nw + "</td>"
        : "") +
      "</tr>"
    );
  }

  const subtotal = (items as Record<string, unknown>[]).reduce((s, item) => {
    return s + calcLineTotal({ quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), discount: Number(item.discount || 0) });
  }, 0);

  // ── Financial summary ──
  let financialHtml = "";
  if (docType !== "packing_list") {
    const fd = (doc.financialDetails || {}) as Record<string, number>;
    const discAmt = fd.discount ? subtotal * fd.discount / 100 : 0;
    const total = fd.total_value || subtotal;
    const rate = Number(doc.dollarExchangeRate || 0);
    const brlTotal = rate > 0 ? total * rate : 0;

    const finRows: string[] = [];
    finRows.push(finRow("Subtotal", "$" + subtotal.toFixed(2), rate > 0 ? "R$ " + (subtotal * rate).toFixed(2) : ""));
    if (fd.discount) finRows.push(finRow("Discount (" + fd.discount + "%)", "-$" + discAmt.toFixed(2), rate > 0 ? "-R$ " + (discAmt * rate).toFixed(2) : ""));
    if (fd.shipping_cost) finRows.push(finRow(isEs ? "Flete" : "Shipping", "$" + (fd.shipping_cost as number).toFixed(2), rate > 0 ? "R$ " + (fd.shipping_cost * rate).toFixed(2) : ""));
    if (fd.insurance) finRows.push(finRow(isEs ? "Seguro" : "Insurance", "$" + (fd.insurance as number).toFixed(2), rate > 0 ? "R$ " + (fd.insurance * rate).toFixed(2) : ""));
    if (fd.bank_fees) finRows.push(finRow(isEs ? "Tarifas Bancarias" : "Bank Fees", "$" + (fd.bank_fees as number).toFixed(2), rate > 0 ? "R$ " + (fd.bank_fees * rate).toFixed(2) : ""));

    financialHtml =
      '<div style="margin-top:24px;display:flex;justify-content:flex-end">' +
        '<table style="width:340px;font-size:11px;border-collapse:collapse">' +
        "<tbody>" + finRows.join("") +
        '<tr style="border-top:2.5px solid #111">' +
        '<td style="padding:8px 10px;font-weight:700;font-size:14px;color:#111">TOTAL</td>' +
        '<td style="padding:8px 10px;text-align:right;font-weight:700;font-size:14px;color:#111">$' + total.toFixed(2) + "</td>" +
        (rate > 0 ? '<td style="padding:8px 10px;text-align:right;font-weight:700;font-size:14px;color:#111">R$ ' + brlTotal.toFixed(2) + "</td>" : "") +
        "</tr>" +
        (rate > 0 ? '<tr><td colspan="3" style="padding:2px 10px 0;font-size:9px;color:#888;text-align:right">Exchange rate: 1 USD = ' + rate.toFixed(4) + " BRL</td></tr>" : "") +
        "</tbody></table></div>";
  } else {
    // Packing list: weight totals
    const totalGw = (items as Record<string, unknown>[]).reduce((s, item) => s + Number(item.gross_weight || 0), 0);
    const totalNw = (items as Record<string, unknown>[]).reduce((s, item) => s + Number(item.net_weight || 0), 0);
    const totalQty = (items as Record<string, unknown>[]).reduce((s, item) => s + Number(item.quantity || 0), 0);
    financialHtml =
      '<div style="margin-top:24px;display:flex;justify-content:flex-end">' +
        '<table style="width:220px;font-size:11px;border-collapse:collapse">' +
        '<tr><td style="padding:4px 10px;color:#555">Total Items</td><td style="padding:4px 10px;text-align:right;font-weight:600">' + items.length + "</td></tr>" +
        '<tr><td style="padding:4px 10px;color:#555">Total Qty</td><td style="padding:4px 10px;text-align:right;font-weight:600">' + totalQty + "</td></tr>" +
        '<tr style="border-top:2px solid #111"><td style="padding:6px 10px;font-weight:700;font-size:13px">Total G.W.</td><td style="padding:6px 10px;text-align:right;font-weight:700;font-size:13px">' + totalGw.toFixed(2) + " kg</td></tr>" +
        '<tr><td style="padding:6px 10px;font-weight:700;font-size:13px">Total N.W.</td><td style="padding:6px 10px;text-align:right;font-weight:700;font-size:13px">' + totalNw.toFixed(2) + " kg</td></tr>" +
        "</table></div>";
  }

  // ── Shipment details ──
  const sd = (doc.shipmentDetails || {}) as Record<string, unknown>;
  let shipmentHtml = "";
  if (sd.carrier) {
    const shipFields: string[] = [];
    shipFields.push(shipField(isEs ? "Transportadora" : "Carrier", String(sd.carrier)));
    if (sd.incoterms) shipFields.push(shipField("Incoterms", String(sd.incoterms)));
    if (sd.origin_port) shipFields.push(shipField(isEs ? "Puerto Origen" : "Origin Port", String(sd.origin_port)));
    if (sd.destination_port) shipFields.push(shipField(isEs ? "Puerto Destino" : "Destination Port", String(sd.destination_port)));
    if (sd.awb) shipFields.push(shipField("AWB / MAWB", String(sd.awb)));
    if (sd.shipment_date) shipFields.push(shipField(isEs ? "Fecha Embarque" : "Shipment Date", String(sd.shipment_date)));
    const boxes = Array.isArray(sd.boxes) ? sd.boxes : [];
    if (boxes.length > 0) shipFields.push(shipField(isEs ? "Cajas" : "Boxes", String(boxes.length)));

    shipmentHtml =
      '<div style="margin-top:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;font-size:11px">' +
      '<p style="font-weight:700;font-size:12px;margin-bottom:8px;color:#374151">' + (isEs ? "Detalles del Embarque" : "Shipment Details") + "</p>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 24px">' +
      shipFields.join("") +
      "</div></div>";
  }

  // ── Notes ──
  const notes = (doc.notes || []) as string[];
  let notesHtml = "";
  if (notes.length > 0) {
    notesHtml =
      '<div style="margin-top:20px;background:#fffbf0;border-left:4px solid #f59e0b;padding:12px 16px;font-size:11px;border-radius:0 6px 6px 0">' +
      '<p style="font-weight:700;margin-bottom:6px;color:#92400e">' + (isEs ? "Notas" : "Notes") + "</p>" +
      notes.map(n => '<p style="margin:3px 0;color:#78350f">\u2022 ' + esc(n) + "</p>").join("") +
      "</div>";
  }

  // ── Sender info block ──
  let senderInfoHtml = "";
  if (sender) {
    senderInfoHtml =
      '<strong style="font-size:12px">' + esc(sender.name) + "</strong><br>" +
      (sender.address ? esc(String(sender.address)) + "<br>" : "") +
      esc(sender.city || "") + ", " + esc(sender.state || "") + " " + esc(sender.postalCode || "") + "<br>" +
      esc(sender.country || "") +
      (sender.cnpj ? '<br><span style="font-size:10px;color:#666">CNPJ: ' + esc(sender.cnpj) + "</span>" : "");
  }

  // Recipient info overrides
  let recipientOverrides: Record<string, string> = {};
  if (doc.recipientInfo && typeof doc.recipientInfo === "object") {
    recipientOverrides = doc.recipientInfo as Record<string, string>;
  }

  const rEmail = recipientOverrides.email || (recipient?.email || "");
  const rAddress = recipientOverrides.address || (recipient?.address || "");
  const rCity = recipientOverrides.city || (recipient?.city || "");
  const rState = recipientOverrides.state || (recipient?.state || "");
  const rPostalCode = recipientOverrides.postalCode || (recipient?.postalCode || "");
  const rCountry = recipientOverrides.country || (recipient?.country || "");

  // ── Recipient block ──
  let recipientHtml = "";
  if (recipient) {
    recipientHtml =
      '<div style="background:#f0f4ff;border:1px solid #c7d5f5;border-radius:8px;padding:14px 18px;font-size:11px">' +
      '<p style="font-weight:700;font-size:12px;color:#1e40af;margin-bottom:6px">' + (isEs ? "Destinatario" : "Ship To") + "</p>" +
      '<p style="font-weight:600">' + esc(recipient.name) + "</p>" +
      (rAddress ? "<p>" + esc(rAddress) + "</p>" : "") +
      "<p>" + esc(rCity) + (rState ? ", " + esc(rState) : "") + " " + esc(rPostalCode) + "</p>" +
      "<p>" + esc(rCountry) + "</p>" +
      (doc.contactName ? '<p style="margin-top:4px;color:#555">' + (isEs ? "Contacto" : "Contact") + ": " + esc(doc.contactName) + (doc.contactPhone ? " | " + esc(doc.contactPhone) : "") + "</p>" : "") +
      (rEmail ? '<p style="color:#555">' + esc(rEmail) + "</p>" : "") +
      "</div>";
  }

  // ── Bank details ──
  let bankHtml = "";
  if (sender?.bankDetails) {
    bankHtml =
      '<div style="margin-top:24px;border-top:1px solid #d1d5db;padding-top:14px;font-size:10px;color:#555">' +
      '<p style="font-weight:700;font-size:11px;color:#374151;margin-bottom:4px">' + (isEs ? "Detalles Bancarios" : "Bank Details") + "</p>" +
      '<p>' + esc(sender.bankDetails) + "</p>" +
      "</div>";
  }

  // ── Header ──
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
        '<div style="text-align:right;font-size:11px">' + senderInfoHtml + "</div>" +
      "</div>";
  }

  // ── Sender / Recipient row ──
  let partyRowHtml = "";
  if (logoDataUri && sender) {
    partyRowHtml =
      '<div style="margin-top:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px">' +
        '<div style="font-size:11px;flex:1">' +
          '<p style="font-weight:700;font-size:12px;color:#374151;margin-bottom:4px">' + (isEs ? "Remetente" : "From") + "</p>" +
          senderInfoHtml +
        "</div>" +
        '<div style="flex:1">' + recipientHtml + "</div>" +
      "</div>";
  } else {
    partyRowHtml = '<div style="margin-top:16px">' + recipientHtml + "</div>";
  }

  // ── Table headers ──
  const thStyle = "background:#1e293b;color:#fff;padding:9px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em";
  const thStyleR = thStyle + ";text-align:right";
  const thStyleC = thStyle + ";text-align:center";

  let tableHeaders =
    '<th style="' + thStyle + '">' + (isEs ? "Codigo" : "Code") + "</th>" +
    '<th style="' + thStyle + '">' + (isEs ? "Descripcion" : "Description") + "</th>";
  if (doc.showEndUseColumn) tableHeaders += '<th style="' + thStyleC + '">' + (isEs ? "Uso Final" : "End Use") + "</th>";
  if (doc.showSterileColumn) tableHeaders += '<th style="' + thStyleC + '">Sterile</th>';
  tableHeaders +=
    '<th style="' + thStyle + '">' + htsusTitle + "</th>" +
    '<th style="' + thStyleC + '">Qty</th>' +
    '<th style="' + thStyleR + '">Unit Price</th>' +
    '<th style="' + thStyleC + '">Disc.</th>' +
    '<th style="' + thStyleR + '">Line Total</th>';
  if (docType === "packing_list") {
    tableHeaders +=
      '<th style="' + thStyleR + '">G.W. (kg)</th>' +
      '<th style="' + thStyleR + '">N.W. (kg)</th>';
  }

  // ── Assemble final HTML ──
  return "<!DOCTYPE html>" +
    '<html lang="' + (isEs ? "es" : "en") + '">' +
    '<head><meta charset="utf-8"><title>' + label + ' - ' + esc(doc.number) + '</title>' +
    '<style>' +
    "@page { size: A4; margin: 12mm 15mm; }" +
    "* { margin: 0; padding: 0; box-sizing: border-box; }" +
    "body { font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.5; }" +
    ".watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(220,38,38,0.08); font-weight: 900; z-index: 0; pointer-events: none; letter-spacing: 10px; }" +
    ".content { position: relative; z-index: 1; }" +
    "table { border-collapse: collapse; width: 100%; }" +
    "table th:first-child { border-radius: 6px 0 0 0; }" +
    "table th:last-child { border-radius: 0 6px 0 0; }" +
    ".separator { border: none; border-top: 2px solid #1e293b; margin: 0; }" +
    "</style></head><body>" +
    (isDraft ? '<div class="watermark">DRAFT</div>' : '') +
    '<div class="content">' +
    headerHtml +
    '<hr class="separator">' +
    partyRowHtml +
    '<table style="margin-top:20px;font-size:11px"><thead><tr>' +
    tableHeaders +
    "</tr></thead><tbody>" + rows.join("") + "</tbody>" +
    (items.length > 0 && docType !== "packing_list"
      ? '<tfoot><tr style="border-top:2px solid #1e293b"><td colspan="6" style="padding:8px 10px;font-weight:700;text-align:right;font-size:12px">Subtotal</td><td style="padding:8px 10px;font-weight:700;text-align:right;font-size:12px">$' + subtotal.toFixed(2) + "</td></tr></tfoot>"
      : "") +
    "</table>" +
    financialHtml + shipmentHtml + notesHtml + bankHtml +
    '<div style="margin-top:20px;text-align:center;font-size:9px;color:#c0c4cc;letter-spacing:0.3px">Generated by Invoicer \u00b7 ' + new Date().toISOString().slice(0, 10) + "</div>" +
    "</div></body></html>";
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
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Parse items and enrich with catalog data
    let items: Record<string, unknown>[] = (safeJsonParse(document.items) as Record<string, unknown>[]) || [];

    if (items.length > 0) {
      const catalogItems = await db.item.findMany();
      const catalogMap: Record<string, Record<string, unknown>> = {};
      for (const ci of catalogItems) {
        catalogMap[ci.id] = ci as unknown as Record<string, unknown>;
      }

      items = items.map((item) => {
        const catalog = catalogMap[String(item.item_id || "")];
        if (catalog) {
          return {
            ...item,
            code: catalog.code || item.code || "",
            name_pt: catalog.namePt,
            name_en: catalog.nameEn,
            name_es: catalog.nameEs || catalog.nameEn,
            end_use: catalog.endUse,
            end_use_es: catalog.endUseEs || catalog.endUse,
            htsus_code: catalog.htsusCode || item.htsus_code,
          };
        }
        return { ...item, code: item.code || "" };
      });
    }

    const parsedNotes: string[] = (safeJsonParse(document.notes) as string[]) || [];
    const parsedShipment: Record<string, unknown> = (safeJsonParse(document.shipmentDetails) as Record<string, unknown>) || {};
    const parsedFinancial: Record<string, number> = (safeJsonParse(document.financialDetails) as Record<string, number>) || {};
    const parsedRecipientInfo: Record<string, unknown> = (safeJsonParse(document.recipientInfo) as Record<string, unknown>) || {};

    const docForTemplate: Record<string, unknown> = {
      documentType: document.documentType,
      status: document.status,
      language: document.language,
      number: document.number,
      date: document.date,
      htsusColumnTitle: document.htsusColumnTitle,
      dollarExchangeRate: document.dollarExchangeRate,
      notes: parsedNotes,
      shipmentDetails: parsedShipment,
      financialDetails: parsedFinancial,
      contactName: document.contactName,
      contactPhone: document.contactPhone,
      recipientInfo: parsedRecipientInfo,
      showEndUseColumn: document.showEndUseColumn,
      showSterileColumn: document.showSterileColumn,
    };

    const logoDataUri = await getLogoBase64(
      document.sender as unknown as Record<string, unknown> | null,
    );

    const html = buildPdfHtml(
      docForTemplate,
      items,
      document.sender as unknown as Record<string, unknown> | null,
      document.recipient as unknown as Record<string, unknown> | null,
      logoDataUri,
    );

    const { writeFile, mkdir } = await import("fs/promises");
    const pdfDir = join(process.cwd(), "db", "pdfs");
    await mkdir(pdfDir, { recursive: true });

    const filename = String(document.number) + ".html";
    const filepath = join(pdfDir, filename);
    await writeFile(filepath, html, "utf-8");

    const pdfUrl = "/api/documents/" + id + "/pdf";

    await db.document.update({
      where: { id },
      data: { pdfUrl },
    });

    return NextResponse.json({ success: true, pdfUrl, message: "PDF generated successfully" });
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
    if (!document || !document.pdfUrl) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const filepath = join(process.cwd(), "db", "pdfs", String(document.number) + ".html");
    const html = await readFile(filepath, "utf-8");

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": "inline; filename=\"" + document.number + ".html\"",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF not found on disk" }, { status: 404 });
  }
}
