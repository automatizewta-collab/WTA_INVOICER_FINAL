import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Read a logo file and return a base64 data URI.
 * Searches: 1) company logoUrl (relative to public/), 2) default logos dir.
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

  const typeLabels: Record<string, Record<string, string>> = {
    proforma: { en: "PROFORMA INVOICE", es: "FACTURA PROFORMA" },
    invoice: { en: "COMMERCIAL INVOICE", es: "FACTURA COMERCIAL" },
    packing_list: { en: "PACKING LIST", es: "LISTA DE EMBALAJE" },
  };
  const label = typeLabels[docType]?.[isEs ? "es" : "en"] || docType.toUpperCase();
  const isDraft = doc.status === "draft";

  // ── Items table rows ──
  const rows: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;
    const name = isEs
      ? (item.name_es || item.name_en || item.name_pt || "")
      : (item.name_en || item.name_pt || "");
    const endUse = isEs
      ? (item.end_use_es || item.end_use || "")
      : (item.end_use || "");
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const disc = Number(item.discount || 0);
    const lineTotal = qty * price * (1 - disc / 100);
    const exchangeRate = Number(doc.dollarExchangeRate || 1);
    const lineTotalBrl = lineTotal * exchangeRate;
    const gw = Number(item.gross_weight || 0);
    const nw = Number(item.net_weight || 0);

    rows.push(
      "<tr>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + (i + 1) + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + esc(item.htsus_code) + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + esc(name) + "</td>" +
      (doc.showEndUseColumn ? '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + esc(endUse) + "</td>" : '') +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + qty + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">$' + price.toFixed(2) + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + disc + "%</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">$' + lineTotal.toFixed(2) + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#555">R$ ' + lineTotalBrl.toFixed(2) + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + gw + "</td>" +
      '<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + nw + "</td>" +
      "</tr>"
    );
  }

  const subtotal = (items as Record<string, unknown>[]).reduce((s, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const disc = Number(item.discount || 0);
    return s + qty * price * (1 - disc / 100);
  }, 0);

  // ── Financial summary ──
  let financialHtml = "";
  if (docType !== "packing_list") {
    const fd = (doc.financialDetails || {}) as Record<string, number>;
    const total = fd.total_value || subtotal;
    financialHtml =
      '<div style="margin-top:20px;display:flex;justify-content:flex-end">' +
        '<table style="width:280px;font-size:12px">' +
        "<tr><td style=\"padding:4px 8px\">Subtotal</td><td style=\"padding:4px 8px;text-align:right;font-weight:600\">$" + subtotal.toFixed(2) + "</td></tr>" +
        (fd.discount ? "<tr><td style=\"padding:4px 8px\">Discount (" + fd.discount + "%)</td><td style=\"padding:4px 8px;text-align:right\">-$" + (subtotal * fd.discount / 100).toFixed(2) + "</td></tr>" : "") +
        (fd.shipping_cost ? "<tr><td style=\"padding:4px 8px\">Shipping</td><td style=\"padding:4px 8px;text-align:right\">$" + (fd.shipping_cost as number).toFixed(2) + "</td></tr>" : "") +
        (fd.insurance ? "<tr><td style=\"padding:4px 8px\">Insurance</td><td style=\"padding:4px 8px;text-align:right\">$" + (fd.insurance as number).toFixed(2) + "</td></tr>" : "") +
        (fd.bank_fees ? "<tr><td style=\"padding:4px 8px\">Bank Fees</td><td style=\"padding:4px 8px;text-align:right\">$" + (fd.bank_fees as number).toFixed(2) + "</td></tr>" : "") +
        '<tr style="border-top:2px solid #111"><td style="padding:6px 8px;font-weight:700;font-size:14px">TOTAL</td><td style="padding:6px 8px;text-align:right;font-weight:700;font-size:14px">$' + total.toFixed(2) + "</td></tr>" +
        "</table></div>";
  }

  // ── Shipment details ──
  const sd = (doc.shipmentDetails || {}) as Record<string, string>;
  let shipmentHtml = "";
  if (sd.carrier) {
    const parts: string[] = [];
    parts.push((isEs ? "Transportadora" : "Carrier") + ": " + sd.carrier);
    if (sd.incoterms) parts.push("Incoterms: " + sd.incoterms);
    if (sd.origin_port) parts.push((isEs ? "Origen" : "Origin") + ": " + sd.origin_port);
    if (sd.destination_port) parts.push(" \u2192 " + sd.destination_port);
    if (sd.awb) parts.push("AWB: " + sd.awb);
    if (sd.shipment_date) parts.push((isEs ? "Fecha" : "Date") + ": " + sd.shipment_date);

    shipmentHtml =
      '<div style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px">' +
      "<strong>" + (isEs ? "Detalles del Embarque" : "Shipment Details") + "</strong><br>" +
      parts.join(" | ") +
      "</div>";
  }

  // ── Notes ──
  const notes = (doc.notes || []) as string[];
  let notesHtml = "";
  if (notes.length > 0) {
    const noteLines = notes.map(n => '<p style="margin:2px 0">\u2022 ' + esc(n) + "</p>").join("");
    notesHtml =
      '<div style="margin-top:16px;font-size:11px">' +
      "<strong>" + (isEs ? "Notas" : "Notes") + ":</strong>" +
      noteLines +
      "</div>";
  }

  // ── Sender info block ──
  let senderInfoHtml = "";
  if (sender) {
    senderInfoHtml =
      "<strong>" + esc(sender.name) + "</strong><br>" +
      esc(sender.address || "") + "<br>" +
      esc(sender.city || "") + " " + esc(sender.state || "") + " " + esc(sender.postalCode || "") + "<br>" +
      esc(sender.country || "");
    if (sender.cnpj) senderInfoHtml += "<br>CNPJ: " + esc(sender.cnpj);
  }

  // Parse recipientInfo overrides
  let recipientOverrides: Record<string, string> = {};
  try { recipientOverrides = JSON.parse(String(document.recipientInfo || "{}")); } catch { /* empty */ }

  // ── Recipient block ──
  let recipientHtml = "";
  const rEmail = recipientOverrides.email || (recipient?.email || "");
  const rAddress = recipientOverrides.address || (recipient?.address || "");
  const rCity = recipientOverrides.city || (recipient?.city || "");
  const rState = recipientOverrides.state || (recipient?.state || "");
  const rPostalCode = recipientOverrides.postalCode || (recipient?.postalCode || "");
  const rCountry = recipientOverrides.country || (recipient?.country || "");

  if (recipient) {
    recipientHtml =
      '<div style="padding:10px 14px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px">' +
      "<strong>" + (isEs ? "Destinatario" : "Ship To") + ":</strong><br>" +
      esc(recipient.name) + "<br>" +
      esc(rAddress) + "<br>" +
      esc(rCity) + " " + esc(rState) + " " + esc(rPostalCode) + "<br>" +
      esc(rCountry) +
      (doc.contactName ? "<br>Contact: " + esc(doc.contactName) : "") +
      (doc.contactPhone ? " | " + esc(doc.contactPhone) : "") +
      (rEmail ? "<br>" + esc(rEmail) : "") +
      "</div>";
  }

  // ── Bank details ──
  let bankHtml = "";
  if (sender?.bankDetails) {
    bankHtml =
      '<div style="margin-top:24px;padding:10px 14px;border-top:1px solid #e5e7eb;font-size:10px;color:#555">' +
      "<strong>" + (isEs ? "Detalles Bancarios" : "Bank Details") + ":</strong><br>" +
      esc(sender.bankDetails) +
      "</div>";
  }

  // ── Logo header ──
  const dateStr = new Date(doc.date as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const htsusTitle = esc(doc.htsusColumnTitle || "HTSUS");

  // Build the logo + title header row
  let headerHtml: string;
  if (logoDataUri) {
    headerHtml =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<img src="' + logoDataUri + '" alt="Logo" style="height:56px;width:auto;max-width:250px;object-fit:contain" />' +
        "<div>" +
          '<h1 style="font-size:20px;font-weight:800;color:#111;text-align:right">' + label + "</h1>" +
          '<p style="font-size:12px;color:#666;margin-top:2px;text-align:right">' + esc(doc.number) + " | " + dateStr + "</p>" +
        "</div>" +
      "</div>";
  } else {
    headerHtml =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        "<div>" +
          '<h1 style="font-size:20px;font-weight:800;color:#111">' + label + "</h1>" +
          '<p style="font-size:12px;color:#666;margin-top:2px">' + esc(doc.number) + " | " + dateStr + "</p>" +
        "</div>" +
        '<div style="text-align:right;font-size:11px">' + senderInfoHtml + "</div>" +
      "</div>";
  }

  // Build the sender / recipient row (only when logo is present, otherwise sender is in the header)
  let partyRowHtml = "";
  if (logoDataUri && sender) {
    partyRowHtml =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;gap:24px">' +
        '<div style="font-size:11px">' +
          "<strong>" + (isEs ? "Remetente" : "From") + ":</strong><br>" +
          senderInfoHtml +
        "</div>" +
        recipientHtml +
      "</div>";
  } else {
    partyRowHtml = '<div style="margin-bottom:20px">' + recipientHtml + "</div>";
  }

  // ── Assemble final HTML ──
  return "<!DOCTYPE html>" +
    '<html lang="' + (isEs ? "es" : "en") + '">' +
    "<head><meta charset=\"utf-8\"><title>" + label + " - " + esc(doc.number) + "</title>" +
    "<style>" +
    "@page { size: A4; margin: 15mm; }" +
    "* { margin: 0; padding: 0; box-sizing: border-box; }" +
    "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; font-size: 11px; line-height: 1.4; }" +
    ".watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(255,0,0,0.15); font-weight: 900; z-index: 0; pointer-events: none; }" +
    ".content { position: relative; z-index: 1; }" +
    "table { border-collapse: collapse; width: 100%; }" +
    "th { background: #f9fafb; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #111; }" +
    ".separator { border: none; border-top: 1.5px solid #111; margin: 12px 0; }" +
    "</style></head><body>" +
    (isDraft ? '<div class="watermark">DRAFT</div>' : "") +
    '<div class="content">' +
    headerHtml +
    '<hr class="separator">' +
    partyRowHtml +
    '<table style="font-size:11px"><thead><tr>' +
    "<th>#</th><th>" + htsusTitle + "</th>" +
    "<th>" + (isEs ? "Descripci\u00f3n" : "Description") + "</th>" +
    (doc.showEndUseColumn ? "<th>" + (isEs ? "Uso Final" : "End Use") + "</th>" : "") +
    '<th style="text-align:center">Qty</th>' +
    '<th style="text-align:right">Unit Price</th>' +
    '<th style="text-align:center">Disc.</th>' +
    '<th style="text-align:right">Line Total</th>' +
    '<th style="text-align:right;color:#555">Valor R$</th>' +
    '<th style="text-align:right">G.W. (kg)</th>' +
    '<th style="text-align:right">N.W. (kg)</th>' +
    "</tr></thead><tbody>" + rows.join("") + "</tbody></table>" +
    financialHtml + shipmentHtml + notesHtml + bankHtml +
    '<div style="margin-top:12px;text-align:center;font-size:9px;color:#999">Generated by Invoicer | ' + new Date().toISOString() + "</div>" +
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
    let items: Record<string, unknown>[];
    try {
      items = JSON.parse(document.items as string);
    } catch {
      items = [];
    }

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
            name_pt: catalog.namePt,
            name_en: catalog.nameEn,
            name_es: catalog.nameEs || catalog.nameEn,
            end_use: catalog.endUse,
            end_use_es: catalog.endUseEs || catalog.endUse,
            htsus_code: catalog.htsusCode || item.htsus_code,
          };
        }
        return item;
      });
    }

    // Parse JSON string fields from SQLite into proper objects for the template
    let parsedNotes: string[] = [];
    try { parsedNotes = JSON.parse(String(document.notes || "[]")); } catch { /* empty */ }

    let parsedShipment: Record<string, string> = {};
    try { parsedShipment = JSON.parse(String(document.shipmentDetails || "{}")); } catch { /* empty */ }

    let parsedFinancial: Record<string, number> = {};
    try { parsedFinancial = JSON.parse(String(document.financialDetails || "{}")); } catch { /* empty */ }

    // Build a clean doc object with parsed fields
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
      recipientInfo: document.recipientInfo ? JSON.parse(String(document.recipientInfo)) : {},
      showEndUseColumn: document.showEndUseColumn,
      showSterileColumn: document.showSterileColumn,
    };

    // Resolve logo (company-specific or default WTA)
    const logoDataUri = await getLogoBase64(
      document.sender as unknown as Record<string, unknown> | null,
    );
    console.log("[PDF] Logo resolved:", logoDataUri ? "embedded (" + Math.round(logoDataUri.length / 1024) + " KB base64)" : "none");

    const html = buildPdfHtml(
      docForTemplate,
      items,
      document.sender as unknown as Record<string, unknown> | null,
      document.recipient as unknown as Record<string, unknown> | null,
      logoDataUri,
    );

    // Save HTML to disk
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
  } catch (error) {
    console.error("POST /api/documents/[id]/pdf error:", error);
    return NextResponse.json({ error: "Failed to generate PDF", details: String(error) }, { status: 500 });
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