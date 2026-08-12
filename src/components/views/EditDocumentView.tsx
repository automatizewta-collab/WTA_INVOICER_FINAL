"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type {
  DocumentWithRelations,
  DocumentType,
  DocumentLanguage,
  Currency,
  DocumentItem,
  ShipmentDetails,
  FinancialDetails,
  Company,
  Item,
  RecipientInfo,
  PriceList,
} from "@/lib/types";
import { DocumentItemsTable } from "@/components/shared/DocumentItemsTable";
import { ShipmentDetailsForm } from "@/components/shared/ShipmentDetailsForm";
import { NotesForm } from "@/components/shared/NotesForm";
import { apiFetch } from "@/lib/utils";
import { calcTotal, calcBrl, fmtBrl, calcSubtotal } from "@/lib/document-calculations";
import {
  ArrowLeft,
  Save,
  Send,
  FileDown,
  RefreshCw,
} from "lucide-react";

const emptyShipment: ShipmentDetails = {
  carrier: "", incoterms: "", origin_port: "", destination_port: "",
  shipment_date: "", awb: "", boxes: [], gross_weight: 0, net_weight: 0,
};
const emptyFinancial: FinancialDetails = {
  discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
};

export function EditDocumentView() {
  const editDocumentId = useAppStore((s) => s.editDocumentId);
  const navigate = useAppStore((s) => s.navigate);
  const queryClient = useQueryClient();

  const [documentType, setDocumentType] = useState<DocumentType>("proforma");
  const [status, setStatus] = useState<string>("draft");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [language, setLanguage] = useState<DocumentLanguage>("en");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [dollarExchangeRate, setDollarExchangeRate] = useState<number | null>(null);
  const [htsusColumnTitle, setHtsusColumnTitle] = useState("");
  const [showSterileColumn, setShowSterileColumn] = useState(false);
  const [showEndUseColumn, setShowEndUseColumn] = useState(false);
  const [senderId, setSenderId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [shipmentDetails, setShipmentDetails] = useState<ShipmentDetails>(emptyShipment);
  const [financialDetails, setFinancialDetails] = useState<FinancialDetails>(emptyFinancial);
  const [priceList] = useState<PriceList>("logistics");
  const [notes, setNotes] = useState<string[]>([]);
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo>({});

  const { data: doc, isLoading: docLoading } = useQuery<DocumentWithRelations>({
    queryKey: ["document", editDocumentId],
    queryFn: () => apiFetch<DocumentWithRelations>(`/api/documents/${editDocumentId}`),
    enabled: !!editDocumentId,
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["companies", "all"],
    queryFn: () => apiFetch<Company[]>("/api/companies?type=all"),
  });

  const { data: catalogData } = useQuery<{
    items: Item[];
    total: number;
  }>({
    queryKey: ["items"],
    queryFn: () => apiFetch("/api/items?limit=500"),
  });
  const catalogItems = catalogData?.items ?? [];

  // Populate form when document loads
  const initRef = useRef(false);
  useEffect(() => {
    if (doc && !initRef.current) {
      initRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time form initialization from API data
      void (doc && (setDocumentType(doc.documentType as DocumentType),
      setStatus(doc.status),
      setDate(doc.date.split("T")[0]),
      setLanguage(doc.language as DocumentLanguage),
      setCurrency(doc.currency as Currency),
      setDollarExchangeRate(doc.dollarExchangeRate),
      setHtsusColumnTitle(doc.htsusColumnTitle || ""),
      setShowSterileColumn(doc.showSterileColumn),
      setShowEndUseColumn(doc.showEndUseColumn),
      setSenderId(doc.senderId),
      setRecipientId(doc.recipientId || ""),
      setItems(Array.isArray(doc.items) ? doc.items : []),
      setShipmentDetails({ ...emptyShipment, ...doc.shipmentDetails, boxes: Array.isArray(doc.shipmentDetails?.boxes) ? doc.shipmentDetails.boxes : [] }),
      setFinancialDetails({ ...emptyFinancial, ...doc.financialDetails }),
      setNotes(Array.isArray(doc.notes) ? doc.notes : []),
      setRecipientInfo(doc.recipientInfo || {}),
      setPriceList((doc.priceList || "logistics") as PriceList)));
    }
  }, [doc]);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/documents/${editDocumentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", editDocumentId] });
      toast.success("Documento salvo");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      // First save current changes
      const totalValue = calcTotal(items, financialDetails);
      await apiFetch(`/api/documents/${editDocumentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType, language, date, senderId,
          recipientId: recipientId || null, items,
          dollarExchangeRate, currency,
          htsusColumnTitle: htsusColumnTitle || null,
          showSterileColumn, showEndUseColumn, shipmentDetails,
          financialDetails: { ...financialDetails, total_value: totalValue },
          notes, status: "issued",
          recipientInfo: (recipientId || Object.keys(recipientInfo).length > 0) ? recipientInfo : null,
        }),
      });
      // Then issue (cascade)
      return apiFetch(`/api/documents/${editDocumentId}/issue`, { method: "POST" });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      const count = Array.isArray(data) ? data.length - 1 : 0;
      toast.success(`Documento emitido! ${count} documento(s) cascata(s) criado(s).`);
      navigate("documents");
    },
    onError: () => toast.error("Erro ao emitir documento"),
  });

  const generatePdfMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/documents/${editDocumentId}/pdf`, { method: "POST" }),
    onSuccess: (data) => {
      if (data?.pdfUrl) {
        toast.success("PDF gerado!");
        window.open(data.pdfUrl, "_blank");
      } else {
        toast.error("PDF não retornou URL");
      }
    },
    onError: () => toast.error("Erro ao gerar PDF"),
  });

  const handleSave = () => {
    if (!senderId) { toast.error("Selecione o remetente"); return; }
    const totalValue = calcTotal(items, financialDetails);
    updateMutation.mutate({
      documentType, status: "draft", language, date, senderId,
      recipientId: recipientId || null, items, dollarExchangeRate, currency,
      htsusColumnTitle: htsusColumnTitle || null, showSterileColumn, showEndUseColumn,
      shipmentDetails,
      financialDetails: { ...financialDetails, total_value: totalValue },
      notes,
      recipientInfo: (recipientId || Object.keys(recipientInfo).length > 0) ? recipientInfo : null,
    });
  };

  const handleIssue = () => {
    if (!senderId) { toast.error("Selecione o remetente"); return; }
    issueMutation.mutate();
  };

  if (docLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc && !docLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("documents")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-muted-foreground">Documento não encontrado.</p>
      </div>
    );
  }

  const senders = companies.filter((c) => c.type === "sender");
  const recipients = companies.filter((c) => c.type === "recipient");
  const isDraft = status === "draft";
  const isFromErp = !!doc?.orderNumber;
  const showRecipientFields = !!(recipientId || (recipientInfo && Object.keys(recipientInfo).length > 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("documents")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {doc?.number || "Editar Documento"}
              </h1>
              <Badge variant={status === "issued" ? "default" : "outline"}>
                {status === "draft" ? "Rascunho" : "Emitido"}
              </Badge>
              {isFromErp && (
                <Badge variant="secondary">OV {doc?.orderNumber}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Atualizado: {doc?.updatedAt ? new Date(doc.updatedAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {documentType === "packing_list" && (
            <Button variant="outline" size="sm" className="gap-2"
              onClick={() => toast.info("Sync from invoice - não implementado")}>
              <RefreshCw className="h-4 w-4" /> Sync Invoice
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => generatePdfMutation.mutate()} disabled={generatePdfMutation.isPending}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={documentType === "proforma" ? "Proforma" : documentType === "invoice" ? "Invoice" : "Packing List"} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={doc?.number || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Lista de Preço</Label>
              <Input value={priceList === "logistics" ? "Logística" : "Comercial"} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as DocumentLanguage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cotação USD</Label>
              <Input type="number" step="0.01" placeholder="ex: 5.25"
                value={dollarExchangeRate ?? ""}
                onChange={(e) => setDollarExchangeRate(e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-2">
              <Label>Título Coluna HTSUS</Label>
              <Input placeholder="ex: HTSUS Code" value={htsusColumnTitle}
                onChange={(e) => setHtsusColumnTitle(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="showSterile" checked={showSterileColumn}
                onCheckedChange={(v) => setShowSterileColumn(!!v)} />
              <Label htmlFor="showSterile" className="text-sm">Coluna Sterile</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="showEndUse" checked={showEndUseColumn}
                onCheckedChange={(v) => setShowEndUseColumn(!!v)} />
              <Label htmlFor="showEndUse" className="text-sm">Coluna End Use</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies */}
      <Card>
        <CardHeader><CardTitle className="text-base">Empresas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Remetente *</Label>
              {companiesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {senders.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.isDefault ? "(Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Destinatário</Label>
              {companiesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {recipients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {showRecipientFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input placeholder="email@company.com" value={recipientInfo.email || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, email: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <Input placeholder="City" value={recipientInfo.city || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, city: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Input placeholder="State" value={recipientInfo.state || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, state: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">País</Label>
                <Input placeholder="Country" value={recipientInfo.country || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, country: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CEP/ZIP</Label>
                <Input placeholder="Postal Code" value={recipientInfo.postalCode || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, postalCode: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Endereço</Label>
                <Input placeholder="Address" value={recipientInfo.address || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, address: e.target.value })} className="h-8 text-sm" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle className="text-base">Itens</CardTitle></CardHeader>
        <CardContent>
          <DocumentItemsTable
            items={items}
            onChange={setItems}
            catalogItems={catalogItems}
            language={language}
            showSterileColumn={showSterileColumn}
            htsusColumnTitle={htsusColumnTitle || undefined}
            dollarExchangeRate={dollarExchangeRate}
            priceList={priceList}
            erpMode={isFromErp}
          />
        </CardContent>
      </Card>

      {/* Shipment */}
      <Card>
        <CardHeader><CardTitle className="text-base">Shipment Details</CardTitle></CardHeader>
        <CardContent>
          <ShipmentDetailsForm data={shipmentDetails} onChange={setShipmentDetails} />
        </CardContent>
      </Card>

      {/* Financial */}
      <Card>
        <CardHeader><CardTitle className="text-base">Financial Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Desconto (%)</Label>
              <Input type="number" min={0} max={100} value={financialDetails.discount}
                onChange={(e) => setFinancialDetails({ ...financialDetails, discount: parseFloat(e.target.value) || 0 })} />
              {dollarExchangeRate && dollarExchangeRate > 0 && financialDetails.discount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  BRL: {fmtBrl(calcBrl(calcSubtotal(items) * financialDetails.discount / 100, dollarExchangeRate))}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Frete</Label>
              <Input type="number" min={0} step="0.01" value={financialDetails.shipping_cost}
                onChange={(e) => setFinancialDetails({ ...financialDetails, shipping_cost: parseFloat(e.target.value) || 0 })} />
              {dollarExchangeRate && dollarExchangeRate > 0 && financialDetails.shipping_cost > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  BRL: {fmtBrl(calcBrl(financialDetails.shipping_cost, dollarExchangeRate))}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Seguro</Label>
              <Input type="number" min={0} step="0.01" value={financialDetails.insurance}
                onChange={(e) => setFinancialDetails({ ...financialDetails, insurance: parseFloat(e.target.value) || 0 })} />
              {dollarExchangeRate && dollarExchangeRate > 0 && financialDetails.insurance > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  BRL: {fmtBrl(calcBrl(financialDetails.insurance, dollarExchangeRate))}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Taxas Bancárias</Label>
              <Input type="number" min={0} step="0.01" value={financialDetails.bank_fees}
                onChange={(e) => setFinancialDetails({ ...financialDetails, bank_fees: parseFloat(e.target.value) || 0 })} />
              {dollarExchangeRate && dollarExchangeRate > 0 && financialDetails.bank_fees > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  BRL: {fmtBrl(calcBrl(financialDetails.bank_fees, dollarExchangeRate))}
                </p>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">
                {currency} {calcTotal(items, financialDetails).toFixed(2)}
              </p>
              {dollarExchangeRate && dollarExchangeRate > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  BRL: {fmtBrl(calcBrl(calcTotal(items, financialDetails), dollarExchangeRate))}
                  <span className="text-xs ml-1">({dollarExchangeRate})</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
        <CardContent>
          <NotesForm notes={notes} onChange={setNotes} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <Button variant="outline" onClick={() => navigate("documents")}>Cancelar</Button>
        <Button variant="outline" onClick={handleSave}
          disabled={updateMutation.isPending || issueMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Salvar
        </Button>
        {isDraft && (
          <Button onClick={handleIssue}
            disabled={issueMutation.isPending || updateMutation.isPending} className="gap-2">
            <Send className="h-4 w-4" />
            {issueMutation.isPending ? "Emitindo..." : "Emitir Documento"}
          </Button>
        )}
      </div>
    </div>
  );
}