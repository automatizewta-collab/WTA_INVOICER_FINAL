// ============================================
// INVOICER - Zod Validation Schemas for Documents
// Used by: POST /api/documents, PUT /api/documents/[id]
// ============================================

import { z } from "zod";

// ── Sub-schemas ──

export const documentItemSchema = z.object({
  item_id: z.string(),
  quantity: z.number().min(0),
  unit_price: z.number().min(0),
  discount: z.number().min(0).max(100),
  line_number: z.number().int().min(1),
  gross_weight: z.number().min(0),
  net_weight: z.number().min(0),
  htsus_code: z.string().optional().default(""),
  sterile_at_import: z.enum(["YES", "NO"]).optional().default("NO"),
});

export const shipmentBoxSchema = z.object({
  quantity: z.number().int().min(1).optional().default(1),
  type: z.string().optional().default(""),
  dimensions: z.string().optional().default(""),
});

export const shipmentDetailsSchema = z.object({
  carrier: z.string().optional().default(""),
  incoterms: z.string().optional().default(""),
  origin_port: z.string().optional().default(""),
  destination_port: z.string().optional().default(""),
  shipment_date: z.string().optional().default(""),
  awb: z.string().optional().default(""),
  boxes: z.array(shipmentBoxSchema).optional().default([]),
  gross_weight: z.number().min(0).optional().default(0),
  net_weight: z.number().min(0).optional().default(0),
});

export const financialDetailsSchema = z.object({
  discount: z.number().min(0).max(100).optional().default(0),
  shipping_cost: z.number().min(0).optional().default(0),
  insurance: z.number().min(0).optional().default(0),
  bank_fees: z.number().min(0).optional().default(0),
  total_value: z.number().optional().default(0),
});

export const recipientInfoSchema = z.object({
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
}).partial();

// ── Create schema (POST /api/documents) ──

export const documentCreateSchema = z.object({
  documentType: z.enum(["proforma", "invoice", "packing_list"]),
  status: z.enum(["draft", "issued"]).optional().default("draft"),
  language: z.enum(["en", "es"]).optional().default("en"),
  date: z.string().optional(),
  senderId: z.string().min(1),
  recipientId: z.string().optional().nullable(),
  items: z.array(documentItemSchema).optional().default([]),
  dollarExchangeRate: z.number().optional().nullable(),
  currency: z.enum(["USD", "EUR"]).optional().default("USD"),
  htsusColumnTitle: z.string().optional().nullable(),
  showSterileColumn: z.boolean().optional().default(false),
  showEndUseColumn: z.boolean().optional().default(false),
  shipmentDetails: shipmentDetailsSchema.optional().nullable(),
  financialDetails: financialDetailsSchema.optional().nullable(),
  notes: z.array(z.string()).optional().default([]),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  orderNumber: z.string().optional().nullable(),
  recipientInfo: recipientInfoSchema.optional().nullable(),
  priceList: z.enum(["logistics", "commercial"]).optional().default("logistics"),
  // If provided, used as document number (ERP import)
  customNumber: z.string().optional(),
});

// ── Update schema (PUT /api/documents/[id]) ──
// All fields optional — only provided fields are updated.

export const documentUpdateSchema = z.object({
  documentType: z.enum(["proforma", "invoice", "packing_list"]).optional(),
  status: z.enum(["draft", "issued"]).optional(),
  language: z.enum(["en", "es"]).optional(),
  date: z.string().optional(),
  senderId: z.string().optional(),
  recipientId: z.string().optional().nullable(),
  items: z.array(documentItemSchema).optional(),
  dollarExchangeRate: z.number().optional().nullable(),
  currency: z.enum(["USD", "EUR"]).optional(),
  htsusColumnTitle: z.string().optional().nullable(),
  showSterileColumn: z.boolean().optional(),
  showEndUseColumn: z.boolean().optional(),
  shipmentDetails: shipmentDetailsSchema.optional().nullable(),
  financialDetails: financialDetailsSchema.optional().nullable(),
  notes: z.array(z.string()).optional(),
  recipientInfo: recipientInfoSchema.optional().nullable(),
  priceList: z.enum(["logistics", "commercial"]).optional(),
});
