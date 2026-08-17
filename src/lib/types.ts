// ============================================
// INVOICER - Shared Types
// ============================================

export type DocumentType = "proforma" | "invoice" | "packing_list";
export type DocumentStatus = "draft" | "issued";
export type DocumentLanguage = "en" | "es";
export type Currency = "USD" | "EUR";
export type CompanyType = "sender" | "recipient";
export type UserRole = "admin" | "editor" | "viewer";

export type ViewName =
  | "login"
  | "dashboard"
  | "documents"
  | "new-document"
  | "edit-document"
  | "items"
  | "companies"
  | "settings";

export interface DocumentItem {
  item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_number: number;
  gross_weight: number;
  net_weight: number;
  htsus_code: string;
  sterile_at_import: "YES" | "NO";
}

export interface ShipmentBox {
  quantity: number;
  type: string;
  dimensions: string;
}

export interface ShipmentDetails {
  carrier: string;
  incoterms: string;
  origin_port: string;
  destination_port: string;
  shipment_date: string;
  awb: string;
  boxes: ShipmentBox[];
  gross_weight: number;
  net_weight: number;
}

export interface FinancialDetails {
  discount: number;
  shipping_cost: number;
  insurance: number;
  bank_fees: number;
  total_value: number;
}

export interface RecipientInfo {
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface DocumentWithRelations {
  id: string;
  documentType: DocumentType;
  status: DocumentStatus;
  language: DocumentLanguage;
  number: string;
  date: string;
  senderId: string;
  recipientId: string | null;
  items: DocumentItem[];
  dollarExchangeRate: number | null;
  currency: Currency;
  htsusColumnTitle: string | null;
  showSterileColumn: boolean;
  showEndUseColumn: boolean;
  originProformaId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  recipientInfo: RecipientInfo | null;
  orderNumber: string | null;
  shipmentDetails: ShipmentDetails | null;
  financialDetails: FinancialDetails | null;
  notes: string[];
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: Company | null;
  recipient?: Company | null;
}

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  contactName: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  isDefault: boolean;
  logoUrl: string | null;
  bankDetails: string | null;
  midCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  code: string;
  namePt: string;
  nameEn: string;
  nameEs: string | null;
  unitValueUsd: number;
  grossWeight: number;
  netWeight: number;
  htsusCode: string | null;
  endUse: string | null;
  endUseEs: string | null;
  sterileAtImport: string;
  createdAt: string;
  updatedAt: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  proforma: "Proforma",
  invoice: "Invoice",
  packing_list: "Packing List",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  issued: "Issued",
};