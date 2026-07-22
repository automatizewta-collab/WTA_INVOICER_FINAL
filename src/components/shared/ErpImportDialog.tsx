"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, AlertTriangle, PlusCircle, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { useState } from "react";

interface ItemNeedingAttention {
  code: string;
  name: string;
  missing: string[];
}

interface ErpImportResult {
  orderNumber: number;
  client: {
    name: string;
    cnpj: string;
    email: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: Array<{
    erpCode: string;
    erpName: string;
    catalogId: string;
    catalogCode: string;
    namePt: string;
    matched: boolean;
    autoCreated: boolean;
    quantity: number;
    unit_price: number;
    gross_weight: number;
    net_weight: number;
    htsus_code: string;
    sterile_at_import: "YES" | "NO";
    name_en: string;
    name_es: string;
    end_use: string;
  }>;
  source: "mssql" | "mock";
  warnings: string[];
  autoCreatedCount: number;
  itemsNeedingAttention: ItemNeedingAttention[];
}

interface ErpImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (data: ErpImportResult) => void;
}

export function ErpImportDialog({
  open,
  onOpenChange,
  onImported,
}: ErpImportDialogProps) {
  const [orderNumberInput, setOrderNumberInput] = useState("");
  const [result, setResult] = useState<ErpImportResult | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (orderNumber: number) => {
      return apiFetch<ErpImportResult>("/api/erp/import-order", {
        method: "POST",
        body: JSON.stringify({ orderNumber }),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.autoCreatedCount > 0) {
        toast.info(`${data.autoCreatedCount} item(ns) cadastrado(s) automaticamente`, {
          description: "Verifique os campos que precisam de preenchimento.",
          duration: 6000,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Erro ao buscar OV", {
        description: error.message,
      });
    },
  });

  const handleSearch = () => {
    const parsed = parseInt(orderNumberInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Número de OV inválido", {
        description: "Insira um número inteiro positivo.",
      });
      return;
    }
    setResult(null);
    searchMutation.mutate(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleConfirm = () => {
    if (result) {
      onImported(result);
      handleReset();
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setOrderNumberInput("");
    setResult(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleReset();
    }
    onOpenChange(nextOpen);
  };

  const matchedCount = result?.items.filter((i) => i.matched && !i.autoCreated).length ?? 0;
  const autoCreatedCount = result?.items.filter((i) => i.autoCreated).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar do ERP</DialogTitle>
          <DialogDescription>
            Busque uma ordem de venda (OV) pelo número para importar os dados.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="ov-number">Número da OV</Label>
            <Input
              id="ov-number"
              type="number"
              min={1}
              placeholder="Ex: 12345"
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={searchMutation.isPending}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={searchMutation.isPending || !orderNumberInput.trim()}
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <PackageSearch className="mr-2 h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {result && (
            <>
              {/* Auto-created items warning */}
              {result.autoCreatedCount > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <PlusCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-2">
                      <p className="font-medium">
                        {result.autoCreatedCount} item(ns) cadastrado(s) automaticamente
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Estes itens não existiam no catálogo e foram criados com dados básicos do ERP.
                        Preencha o Nome em Inglês na aba <strong>Itens</strong>.
                      </p>
                      <ul className="space-y-1.5">
                        {result.itemsNeedingAttention.map((item) => (
                          <li
                            key={item.code}
                            className="flex items-start gap-2 bg-white/60 dark:bg-black/20 rounded px-2 py-1.5"
                          >
                            <span className="font-mono text-xs font-semibold shrink-0 mt-px">
                              {item.code}
                            </span>
                            <span className="truncate">{item.name}</span>
                            <div className="flex flex-wrap gap-1 shrink-0 ml-auto">
                              {item.missing.map((field) => (
                                <Badge
                                  key={field}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-800 dark:border-amber-600 dark:text-amber-300"
                                >
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Edite-os na aba <strong>Itens</strong> antes de gerar os documentos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mock data warning */}
              {result.source === "mock" && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Dados de demonstração (ERP não configurado)</span>
                </div>
              )}

              {/* Client summary */}
              <div className="rounded-md border p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Dados do Cliente
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome: </span>
                    <span className="font-medium">{result.client.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CNPJ: </span>
                    <span className="font-medium">{result.client.cnpj}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Cidade / UF: </span>
                    <span className="font-medium">
                      {result.client.city} / {result.client.state}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">
                          Código
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Nome
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Qtd
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          P.B.
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          P.L.
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          NBM
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          USD
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item, idx) => (
                        <tr
                          key={item.erpCode + "-" + idx}
                          className={
                            item.autoCreated
                              ? "border-b last:border-b-0 bg-amber-50/50 dark:bg-amber-950/20"
                              : "border-b last:border-b-0"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            {item.erpCode}
                          </td>
                          <td className="px-3 py-2 max-w-[200px] truncate">
                            {item.erpName}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.gross_weight}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.net_weight}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            {item.htsus_code}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.unit_price > 0 ? `$${item.unit_price.toFixed(4)}` : (
                              <span className="text-amber-600 dark:text-amber-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.autoCreated ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700"
                              >
                                <PlusCircle className="mr-1 h-3 w-3" />
                                Novo
                              </Badge>
                            ) : item.matched ? (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                              >
                                OK
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                              >
                                Não encontrado
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary bar */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  {result.items.length} item(ns) total
                </span>
                {matchedCount > 0 && (
                  <span className="text-green-700 dark:text-green-400">
                    {matchedCount} já cadastrado(s)
                  </span>
                )}
                {autoCreatedCount > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {autoCreatedCount} cadastrado(s) agora
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer with confirm */}
        {result && (
          <DialogFooter>
            <Button variant="outline" onClick={handleReset}>
              Limpar
            </Button>
            <Button onClick={handleConfirm}>
              {autoCreatedCount > 0 ? (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Confirmar ({autoCreatedCount} novo(s))
                </>
              ) : (
                "Confirmar Importação"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}