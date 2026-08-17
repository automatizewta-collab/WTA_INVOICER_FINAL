// ============================================
// PDF Templates — Shared Utilities & Types
// ============================================

import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// ── Types ──

export interface PdfItem {
  item_id?: string;
  item_code?: string;
  code?: string;
  name_pt?: string;
  name_en?: string;
  name_es?: string;
  end_use?: string;
  end_use_es?: string;
  htsus_code?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  gross_weight: number;
  net_weight: number;
  [key: string]: unknown;
}

export interface PdfBox {
  quantity: number;
  type: string;
  dimensions: string;
  gross_weight?: number;
  net_weight?: number;
}

export interface PdfCompany {
  id?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  cnpj?: string | null;
  stateRegistration?: string | null;
  logoUrl?: string | null;
  bankDetails?: string | null;
}

export interface ShipmentData {
  carrier?: string;
  incoterms?: string;
  origin_port?: string;
  destination_port?: string;
  shipment_date?: string;
  awb?: string;
  boxes?: PdfBox[];
  gross_weight?: number;
  net_weight?: number;
}

export interface TemplateContext {
  documentType: string;
  status: string;
  language: string;
  number: string;
  date: string;
  htsusColumnTitle?: string;
  dollarExchangeRate?: number | null;
  showEndUseColumn?: boolean;
  showSterileColumn?: boolean;
  originProformaId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  recipientInfo?: Record<string, unknown> | null;
  notes: string[];
  shipmentDetails: ShipmentData;
  financialDetails: Record<string, number>;
}

// ── Helpers ──

/** HTML-escape */
export function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Format number with comma as decimal separator */
export function fmtNum(val: number, decimals = 2): string {
  return val.toFixed(decimals).replace(".", ",");
}

/** Format USD with comma decimal */
export function fmtUsd(val: number): string {
  return "$" + fmtNum(val);
}

/** Format kg with comma decimal */
export function fmtKg(val: number): string {
  return fmtNum(val) + " kg";
}

/** Format kg without suffix */
export function fmtKgRaw(val: number): string {
  return fmtNum(val);
}

/** Get logo as base64 data URI */
export async function getLogoBase64(sender: PdfCompany | null): Promise<string | null> {
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

// ── i18n helpers ──

export function getItemName(item: PdfItem, isEs: boolean): string {
  if (isEs) return item.name_es || item.name_en || item.name_pt || "";
  return item.name_en || item.name_pt || "";
}

export function getEndUse(item: PdfItem, isEs: boolean): string {
  if (isEs) return item.end_use_es || item.end_use || "";
  return item.end_use || "";
}

// ── Section Builders ──

export function buildHeader(
  label: string,
  doc: TemplateContext,
  logoDataUri: string | null,
  senderInfoHtml: string,
): string {
  const isEs = doc.language === "es";
  const dateStr = new Date(doc.date as string).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (logoDataUri) {
    return (
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<img src="' + logoDataUri + '" alt="Logo" style="height:56px;width:auto;max-width:250px;object-fit:contain" />' +
        "<div>" +
          '<h1 style="font-size:22px;font-weight:800;color:#111;text-align:right;letter-spacing:0.05em">' + label + "</h1>" +
          '<p style="font-size:12px;color:#666;margin-top:2px;text-align:right">' + esc(doc.number) + " | " + dateStr + "</p>" +
        "</div>" +
      "</div>"
    );
  }

  return (
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      "<div>" +
        '<h1 style="font-size:22px;font-weight:800;color:#111;letter-spacing:0.05em">' + label + "</h1>" +
        '<p style="font-size:12px;color:#666;margin-top:2px">' + esc(doc.number) + " | " + dateStr + "</p>" +
      "</div>" +
      '<div style="text-align:right;font-size:11px">' + senderInfoHtml + "</div>" +
    "</div>"
  );
}

export function buildSenderInfo(sender: PdfCompany): string {
  let html =
    "<strong>" + esc(sender.name) + "</strong><br>" +
    esc(sender.address || "") + "<br>" +
    esc(sender.city || "") + " " + esc(sender.state || "") + " " + esc(sender.postalCode || "") + "<br>" +
    esc(sender.country || "");
  if (sender.cnpj) html += "<br>CNPJ: " + esc(sender.cnpj);
  return html;
}

export function buildPartyRow(
  doc: TemplateContext,
  sender: PdfCompany | null,
  recipient: PdfCompany | null,
  logoDataUri: string | null,
  senderInfoHtml: string,
): string {
  const isEs = doc.language === "es";

  // Recipient with overrides from recipientInfo
  const ri = doc.recipientInfo || {};
  const rEmail = (ri.email as string) || recipient?.email || "";
  const rAddress = (ri.address as string) || recipient?.address || "";
  const rCity = (ri.city as string) || recipient?.city || "";
  const rState = (ri.state as string) || recipient?.state || "";
  const rPostalCode = (ri.postalCode as string) || recipient?.postalCode || "";
  const rCountry = (ri.country as string) || recipient?.country || "";

  let recipientHtml = "";
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

  if (logoDataUri && sender) {
    return (
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;gap:24px">' +
        '<div style="font-size:11px">' +
          "<strong>" + (isEs ? "Remetente" : "From") + ":</strong><br>" +
          senderInfoHtml +
        "</div>" +
        recipientHtml +
      "</div>"
    );
  }

  return '<div style="margin-bottom:20px">' + recipientHtml + "</div>";
}

export function buildShipmentDetails(doc: TemplateContext): string {
  const isEs = doc.language === "es";
  const sd = doc.shipmentDetails;
  if (!sd || !sd.carrier) return "";

  const parts: string[] = [];
  parts.push((isEs ? "Transportadora" : "Carrier") + ": " + esc(sd.carrier));
  if (sd.incoterms) parts.push("Incoterms: " + esc(sd.incoterms));
  if (sd.origin_port) parts.push((isEs ? "Origen" : "Origin") + ": " + esc(sd.origin_port));
  if (sd.destination_port) parts.push(" \u2192 " + esc(sd.destination_port));
  if (sd.awb) parts.push("AWB: " + esc(sd.awb));
  if (sd.shipment_date) parts.push((isEs ? "Fecha" : "Date") + ": " + esc(sd.shipment_date));

  return (
    '<div style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px">' +
      "<strong>" + (isEs ? "Detalles del Embarque" : "Shipment Details") + "</strong><br>" +
      parts.join(" | ") +
    "</div>"
  );
}

export function buildNotes(doc: TemplateContext): string {
  const isEs = doc.language === "es";
  const notes = doc.notes || [];
  if (notes.length === 0) return "";

  const noteLines = notes
    .map((n) => '<p style="margin:2px 0">\u2022 ' + esc(n) + "</p>")
    .join("");

  return (
    '<div style="margin-top:16px;font-size:11px">' +
      "<strong>" + (isEs ? "Notas" : "Notes") + ":</strong>" +
      noteLines +
    "</div>"
  );
}

export function buildBankDetails(sender: PdfCompany | null): string {
  if (!sender?.bankDetails) return "";

  return (
    '<div style="margin-top:24px;padding:10px 14px;border-top:1px solid #e5e7eb;font-size:10px;color:#555">' +
      "<strong>Bank Details:</strong><br>" +
      esc(sender.bankDetails) +
    "</div>"
  );
}

export function buildWatermark(isDraft: boolean): string {
  return isDraft
    ? '<div class="watermark">DRAFT</div>'
    : "";
}

export function buildFooter(): string {
  return (
    '<div style="margin-top:12px;text-align:center;font-size:9px;color:#999">' +
      "Generated by Invoicer | " + new Date().toISOString() +
    "</div>"
  );
}

/** Common CSS + HTML wrapper */
export function wrapHtml(body: string, isEs: boolean, label: string, docNumber: string): string {
  return (
    "<!DOCTYPE html>" +
    '<html lang="' + (isEs ? "es" : "en") + '">' +
    "<head><meta charset=\"utf-8\"><title>" + label + " - " + esc(docNumber) + "</title>" +
    "<style>" +
    "@page { size: A4; margin: 15mm; }" +
    "* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
    "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; font-size: 11px; line-height: 1.4; }" +
    ".watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(255,0,0,0.15); font-weight: 900; z-index: 0; pointer-events: none; }" +
    ".content { position: relative; z-index: 1; }" +
    "table { border-collapse: collapse; width: 100%; }" +
    "th { background: #f9fafb; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #111; }" +
    ".separator { border: none; border-top: 1.5px solid #111; margin: 12px 0; }" +
    "</style></head><body>" +
    body +
    "</body></html>"
  );
}
