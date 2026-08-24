// ============================================
// INVOICER - Shared Document Serializer
// Single source of truth for converting Prisma rows to API responses.
// Used by: GET/POST /api/documents, PUT /api/documents/[id]
// ============================================

interface SerializedDocument {
  id: string;
  documentType: string;
  status: string;
  language: string;
  number: string;
  date: string;
  senderId: string;
  recipientId: string | null;
  items: unknown[];
  dollarExchangeRate: number | null;
  currency: string;
  htsusColumnTitle: string | null;
  showSterileColumn: boolean;
  showEndUseColumn: boolean;
  originProformaId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  recipientInfo: Record<string, unknown> | null;
  orderNumber: string | null;
  purpose: string | null;
  paymentTerms: string | null;
  shipmentDetails: Record<string, unknown> | null;
  financialDetails: Record<string, unknown> | null;
  notes: string[];
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
  } | null;
  recipient: {
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
  } | null;
}

function safeJsonParse(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === "object") return value; // already parsed
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function extractSender(doc: Record<string, unknown>): SerializedDocument["sender"] {
  const s = doc.sender as Record<string, unknown> | null;
  if (!s) return null;
  return {
    id: String(s.id),
    name: String(s.name),
    type: String(s.type),
    city: s.city ? String(s.city) : null,
    country: s.country ? String(s.country) : null,
  };
}

function extractRecipient(doc: Record<string, unknown>): SerializedDocument["recipient"] {
  const r = doc.recipient as Record<string, unknown> | null;
  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    type: String(r.type),
    city: r.city ? String(r.city) : null,
    country: r.country ? String(r.country) : null,
  };
}

export function serializeDocument(doc: Record<string, unknown>): SerializedDocument {
  return {
    id: String(doc.id),
    documentType: String(doc.documentType),
    status: String(doc.status),
    language: String(doc.language),
    number: String(doc.number),
    date: new Date(doc.date as string).toISOString(),
    senderId: String(doc.senderId),
    recipientId: doc.recipientId ? String(doc.recipientId) : null,
    items: (safeJsonParse(doc.items) as unknown[]) || [],
    dollarExchangeRate: doc.dollarExchangeRate as number | null,
    currency: String(doc.currency),
    htsusColumnTitle: doc.htsusColumnTitle ? String(doc.htsusColumnTitle) : null,
    showSterileColumn: Boolean(doc.showSterileColumn),
    showEndUseColumn: Boolean(doc.showEndUseColumn),
    originProformaId: doc.originProformaId ? String(doc.originProformaId) : null,
    contactName: doc.contactName ? String(doc.contactName) : null,
    contactPhone: doc.contactPhone ? String(doc.contactPhone) : null,
    recipientInfo: safeJsonParse(doc.recipientInfo) as Record<string, unknown> | null,
    orderNumber: doc.orderNumber ? String(doc.orderNumber) : null,
    purpose: doc.purpose ? String(doc.purpose) : null,
    paymentTerms: doc.paymentTerms ? String(doc.paymentTerms) : null,
    shipmentDetails: safeJsonParse(doc.shipmentDetails) as Record<string, unknown> | null,
    financialDetails: safeJsonParse(doc.financialDetails) as Record<string, unknown> | null,
    notes: (safeJsonParse(doc.notes) as string[]) || [],
    pdfUrl: doc.pdfUrl ? String(doc.pdfUrl) : null,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
    sender: extractSender(doc),
    recipient: extractRecipient(doc),
  };
}
