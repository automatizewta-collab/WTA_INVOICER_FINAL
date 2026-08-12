"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type { DocumentType, DocumentLanguage, Currency, DocumentItem, Company, Item, ShipmentDetails, FinancialDetails, RecipientInfo, PriceList } from "@/lib/types";
import { DocumentItemsTable } from "@/components/shared/DocumentItemsTable";
import { ShipmentDetailsForm } from "@/components/shared/ShipmentDetailsForm";
import { NotesForm } from "@/components/shared/NotesForm";
import { apiFetch } from "@/lib/utils";
import { calcTotal, calcBrl, fmtBrl, calcSubtotal } from "@/lib/document-calculations";
import { ArrowLeft, Save, Send, Database } from "lucide-react";
import { ErpImportDialog } from "@/components/shared/ErpImportDialog";

const emptyShipment: ShipmentDetails = {
  carrier: "", incoterms: "", origin_port: "", destination_port: "",
  shipment_date: "", awb: "", boxes: [], gross_weight: 0, net_weight: 0,
};
const emptyFinancial: FinancialDetails = {
  discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
};

export function NewDocumentView() {
  const navigate = useAppStore((s) => s.navigate);
  const queryClient = useQueryClient();

  const [priceList, setPriceList] = useState<PriceList>("logistics");
  const [documentType, setDocumentType] = useState<DocumentType>("proforma");
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
  const [notes, setNotes] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [erpDialogOpen, setErpDialogOpen] = useState(false);
  const [erpImporting, setErpImporting] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo>({});

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["companies", "all"],
    queryFn: () => apiFetch<Company[]>("/api/companies?type=all"),
  });
  const senders = companies.filter((c) => c.type === "sender");
  const recipients = companies.filter((c) => c.type === "recipient");

  // Auto-fill recipient info when recipient is selected (use companies in deps, not recipients array ref)
  // Skip when ERP import just set the data
  useEffect(() => {
    if (skipRecipientEffect.current) {
      skipRecipientEffect.current = false;
      return;
    }
    if (recipientId) {
      const company = recipients.find((c) => c.id === recipientId);
      if (company) {
        setRecipientInfo({
          email: company.email || "",
          address: company.address || "",
          city: company.city || "",
          state: company.state || "",
          postalCode: company.postalCode || "",
          country: company.country || "",
        });
      }
    }
  }, [recipientId, companies]);

  const { data: settingsData } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Record<string, string>>("/api/settings"),
  });

  useEffect(() => {
    if (settingsData?.default_notes && notes.length === 0) {
      try {
        const parsed = JSON.parse(settingsData.default_notes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
        }
      } catch { /* ignore */ }
    }
  }, [settingsData]); // intentionally only depend on settingsData

  const { data: catalogData, isLoading: catalogLoading } = useQuery<{
    items: Item[];
    total: number;
  }>({
    queryKey: ["items"],
    queryFn: () => apiFetch("/api/items?limit=500"),
  });
  const catalogItems = catalogData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document created successfully");
      navigate("documents");
    },
    onError: () => toast.error("Failed to create document"),
  });

  const userId = useAppStore((s) => s.userId);
  const handleSubmit = (status: "draft" | "issued") => {
    if (!senderId) { toast.error("Selecione o remetente"); return; }
    if (items.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    const totalValue = calcTotal(items, financialDetails);
    createMutation.mutate({
      documentType, status, language, date, senderId,
      recipientId: recipientId || null, items, dollarExchangeRate, currency,
      htsusColumnTitle: htsusColumnTitle || null, showSterileColumn, showEndUseColumn,
      shipmentDetails,
      financialDetails: { ...financialDetails, total_value: totalValue },
      notes, contactName: contactName || null, contactPhone: contactPhone || null,
      orderNumber: orderNumber || null,
      customNumber: orderNumber || undefined,
      recipientInfo: (recipientId || Object.keys(recipientInfo).length > 0) ? recipientInfo : null,
      priceList,
      _userId: userId,
    });
  };

  const skipRecipientEffect = useRef(false);

  // ── ERP Import → populate form (no immediate draft) ──
  const handleErpImported = async (data: {
    orderNumber: number;
    client: { name: string; cnpj: string; email: string; address: string; city: string; state: string; postalCode: string; country: string };
    items: Array<{
      erpCode: string; catalogId: string; catalogCode: string; namePt: string;
      matched: boolean; autoCreated: boolean;
      quantity: number; unit_price: number; gross_weight: number; net_weight: number;
      htsus_code: string; sterile_at_import: "YES" | "NO";
    }>;
    autoCreatedCount: number;
    itemsNeedingAttention: Array<{ code: string; name: string; missing: string[] }>;
  }) => {
    setErpImporting(true);
    try {
      // Find or create recipient
      let companyId = recipients.find((c) =>
        c.cnpj && c.cnpj.replace(/\D/g, "") === data.client.cnpj.replace(/\D/g, "")
      )?.id;
      if (!companyId) {
        companyId = recipients.find((c) =>
          c.name.toLowerCase() === data.client.name.toLowerCase()
        )?.id;
      }
      if (!companyId) {
        const created = await apiFetch<{ id: string }>("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.client.name, type: "recipient", cnpj: data.client.cnpj,
            email: data.client.email, address: data.client.address,
            city: data.client.city, state: data.client.state,
            postalCode: data.client.postalCode, country: data.client.country,
          }),
        });
        companyId = created.id;
        queryClient.invalidateQueries({ queryKey: ["companies"] });
      }

      // Build document items using catalog IDs
      const docItems: DocumentItem[] = data.items.map((item, idx) => ({
        item_id: item.catalogId || item.erpCode,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: 0,
        line_number: idx + 1,
        gross_weight: item.gross_weight,
        net_weight: item.net_weight,
        htsus_code: item.htsus_code,
        sterile_at_import: item.sterile_at_import,
      }));

      // Prevent the recipientId useEffect from overwriting our recipientInfo
      skipRecipientEffect.current = true;

      // Populate the form instead of creating a draft
      setRecipientId(companyId);
      setRecipientInfo({
        email: contactEmail || data.client.email,
        address: data.client.address,
        city: data.client.city,
        state: data.client.state,
        postalCode: data.client.postalCode,
        country: data.client.country,
      });
      setItems(docItems);
      setOrderNumber(String(data.orderNumber));
      setDocumentType("proforma");

      const warnings = data.itemsNeedingAttention.length;
      toast.success(
        `OV ${data.orderNumber} importada (${data.items.length} itens)` +
        (data.autoCreatedCount > 0 ? ` | ${data.autoCreatedCount} item(ns) auto-cadastrado(s)` : "") +
        (warnings > 0 ? ` | ${warnings} item(ns) precisa(m) atenção` : "")
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar OV");
    } finally {
      setErpImporting(false);
    }
  };

  const showRecipientFields = !!(recipientId || (recipientInfo && Object.keys(recipientInfo).length > 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("documents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Documento</h1>
          <p className="text-muted-foreground">Importe do ERP ou crie manualmente</p>
        </div>
      </div>

      {/* ERP Import Section */}
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Importar do ERP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Remetente *</Label>
              {companiesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o remetente..." />
                  </SelectTrigger>
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
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input placeholder="Nome" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-36" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="+55 11 ..." value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-36" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input placeholder="email@empresa.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-44" />
              </div>
            </div>
            <Button
              onClick={() => setErpDialogOpen(true)}
              disabled={!senderId || erpImporting}
              className="gap-2"
            >
              <Database className="h-4 w-4" />
              {erpImporting ? "Criando Draft..." : "Importar OV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ErpImportDialog
        open={erpDialogOpen}
        onOpenChange={setErpDialogOpen}
        onImported={handleErpImported}
      />

      {/* Separator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">ou crie manualmente</span>
        </div>
      </div>

      {/* Manual document creation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Detalhes do Documento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proforma">Proforma</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="packing_list">Packing List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Lista de Preço</Label>
              <Select value={priceList} onValueChange={(v) => setPriceList(v as PriceList)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="logistics">Logística</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
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
              <Input placeholder="ex: HTSUS Code" value={htsusColumnTitle} onChange={(e) => setHtsusColumnTitle(e.target.value)} />
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

      {/* Recipient (manual) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Destinatário</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
          {showRecipientFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">País</Label>
                <Input placeholder="Country" value={recipientInfo.country || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, country: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Input placeholder="State" value={recipientInfo.state || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, state: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <Input placeholder="City" value={recipientInfo.city || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, city: e.target.value })} className="h-8 text-sm" />
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
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input placeholder="email@company.com" value={recipientInfo.email || ""}
                  onChange={(e) => setRecipientInfo({ ...recipientInfo, email: e.target.value })} className="h-8 text-sm" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items (manual) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Itens</CardTitle></CardHeader>
        <CardContent>
          {catalogLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <DocumentItemsTable
              items={items}
              onChange={setItems}
              catalogItems={catalogItems}
              language={language}
              showSterileColumn={showSterileColumn}
              htsusColumnTitle={htsusColumnTitle || undefined}
              dollarExchangeRate={dollarExchangeRate}
              priceList={priceList}
              erpMode={false}
            />
          )}
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
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{currency} {calcTotal(items, financialDetails).toFixed(2)}</p>
              {dollarExchangeRate && dollarExchangeRate > 0 && (
                <p className="text-sm text-muted-foreground">
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
        <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={createMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Salvar Rascunho
        </Button>
        <Button onClick={() => handleSubmit("issued")} disabled={createMutation.isPending} className="gap-2">
          <Send className="h-4 w-4" /> Emitir Documento
        </Button>
      </div>
    </div>
  );
}