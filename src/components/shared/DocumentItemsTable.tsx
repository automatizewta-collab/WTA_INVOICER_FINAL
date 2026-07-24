"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import type { DocumentItem, DocumentLanguage, Item } from "@/lib/types";

interface DocumentItemsTableProps {
  items: DocumentItem[];
  onChange: (items: DocumentItem[]) => void;
  catalogItems: Item[];
  language: DocumentLanguage;
  showSterileColumn: boolean;
  htsusColumnTitle?: string;
  dollarExchangeRate?: number | null;
  erpMode?: boolean;
}

function getLineTotal(item: DocumentItem): number {
  return item.quantity * item.unit_price * (1 - item.discount / 100);
}

export function DocumentItemsTable({
  items,
  onChange,
  catalogItems,
  language,
  showSterileColumn,
  htsusColumnTitle,
  dollarExchangeRate,
  erpMode = false,
}: DocumentItemsTableProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));

  const addItem = () => {
    const newLine = safeItems.length > 0 ? Math.max(...safeItems.map((i) => i.line_number)) + 1 : 1;
    onChange([
      ...safeItems,
      {
        item_id: "", quantity: 1, unit_price: 0, discount: 0,
        line_number: newLine, gross_weight: 0, net_weight: 0,
        htsus_code: "", sterile_at_import: "NO",
      },
    ]);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= safeItems.length) return;
    const updated = [...safeItems];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    // Re-number
    updated.forEach((item, i) => { item.line_number = i + 1; });
    onChange(updated);
  };

  const selectCatalogItem = (index: number, itemId: string) => {
    const catalogItem = catalogItems.find((c) => c.id === itemId);
    if (catalogItem) {
      const updated = [...safeItems];
      updated[index] = {
        ...updated[index],
        item_id: catalogItem.id,
        unit_price: catalogItem.unitValueUsd,
        gross_weight: catalogItem.grossWeight,
        net_weight: catalogItem.netWeight,
        htsus_code: catalogItem.htsusCode || "",
        sterile_at_import: catalogItem.sterileAtImport === "YES" ? "YES" : "NO",
      };
      onChange(updated);
    }
  };

  const updateItem = (index: number, field: keyof DocumentItem, value: string | number) => {
    const updated = [...safeItems];
    (updated[index] as Record<string, string | number>)[field] = value;
    onChange(updated);
  };

  const htsusLabel = htsusColumnTitle || "HTSUS Code";
  const showBrl = !!dollarExchangeRate && dollarExchangeRate > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Itens ({safeItems.length})</h3>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Item
        </Button>
      </div>

      <div className="border rounded-md overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[90px]">Código</TableHead>
              <TableHead className="min-w-[200px]">Descrição (PT)</TableHead>
              <TableHead className="w-20">Qtd</TableHead>
              <TableHead className="w-28">Preço USD</TableHead>
              {showBrl && <TableHead className="w-28">Preço BRL</TableHead>}
              <TableHead className="w-20">Desc %</TableHead>
              <TableHead className="w-28">Total USD</TableHead>
              {showBrl && <TableHead className="w-28">Total BRL</TableHead>}
              <TableHead className="w-24">P.B.</TableHead>
              <TableHead className="w-24">P.L.</TableHead>
              <TableHead className="w-28">{htsusLabel}</TableHead>
              {showSterileColumn && <TableHead className="w-20">Sterile</TableHead>}
              {!erpMode && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={12 + (showBrl ? 2 : 0)}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Nenhum item. Clique &quot;Adicionar Item&quot; para começar.
                </TableCell>
              </TableRow>
            )}
            {safeItems.map((item, index) => {
              // Look up catalog by item_id (DB ID) or by code
              const catalogItem = catalogById.get(item.item_id) ||
                catalogItems.find((c) => c.code === item.item_id);
              const description = catalogItem?.namePt || "";

              // Price warning: no price set
              const needsPrice = !item.unit_price || item.unit_price === 0;

              const unitBrl = showBrl && dollarExchangeRate ? item.unit_price * dollarExchangeRate : 0;
              const lineTotal = getLineTotal(item);
              const lineBrl = showBrl && dollarExchangeRate ? lineTotal * dollarExchangeRate : 0;

              return (
                <TableRow key={index} className={needsPrice ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                  <TableCell className="text-muted-foreground text-xs text-center">
                    {item.line_number}
                  </TableCell>

                  {/* Code column */}
                  <TableCell>
                    {erpMode ? (
                      <span className="font-mono text-xs font-medium">
                        {catalogItem?.code || item.item_id}
                      </span>
                    ) : (
                      <Select
                        value={item.item_id}
                        onValueChange={(val) => selectCatalogItem(index, val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogItems.map((ci) => (
                            <SelectItem key={ci.id} value={ci.id}>
                              {ci.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>

                  {/* Description — always PT */}
                  <TableCell className="text-xs min-w-[200px] max-w-[280px]">
                    <span className={"leading-relaxed whitespace-normal block line-clamp-2" + (needsPrice ? " text-amber-700 dark:text-amber-400" : "")}>
                      {description}
                    </span>
                    {needsPrice && (
                      <AlertCircle className="inline-block h-3 w-3 ml-1 text-amber-500" />
                    )}
                  </TableCell>

                  <TableCell>
                    <Input type="number" min={0} value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.0001" value={item.unit_price}
                      onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs" />
                  </TableCell>

                  {showBrl && (
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {unitBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  )}

                  <TableCell>
                    <Input type="number" min={0} max={100} value={item.discount}
                      onChange={(e) => updateItem(index, "discount", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs" />
                  </TableCell>

                  <TableCell className="text-xs font-medium tabular-nums">
                    {lineTotal.toFixed(2)}
                  </TableCell>

                  {showBrl && (
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {lineBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  )}

                  <TableCell>
                    <Input type="number" min={0} step="0.01" value={item.gross_weight}
                      onChange={(e) => updateItem(index, "gross_weight", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.01" value={item.net_weight}
                      onChange={(e) => updateItem(index, "net_weight", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs" />
                  </TableCell>
                  <TableCell>
                    <Input value={item.htsus_code}
                      onChange={(e) => updateItem(index, "htsus_code", e.target.value)}
                      className="h-8 text-xs" placeholder="0000.00.00" />
                  </TableCell>

                  {showSterileColumn && (
                    <TableCell>
                      <Checkbox checked={item.sterile_at_import === "YES"}
                        onCheckedChange={(checked) => updateItem(index, "sterile_at_import", checked ? "YES" : "NO")} />
                    </TableCell>
                  )}

                  {/* Reorder + delete */}
                  {!erpMode ? (
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => removeItem(index)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  ) : (
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5"
                          onClick={() => moveItem(index, -1)} disabled={index === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5"
                          onClick={() => moveItem(index, 1)} disabled={index === safeItems.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {safeItems.length > 0 && (
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-sm font-medium">
              Total USD:{" "}
              <span className="text-base font-bold">
                ${safeItems.reduce((sum, item) => sum + getLineTotal(item), 0).toFixed(2)}
              </span>
            </p>
            {showBrl && dollarExchangeRate && (
              <p className="text-sm font-medium text-muted-foreground">
                Total BRL:{" "}
                <span className="text-base">
                  R$ {safeItems.reduce((sum, item) => sum + getLineTotal(item), 0).toFixed(2)} × {dollarExchangeRate} ={" "}
                  <span className="font-bold text-foreground">
                    R$ {(safeItems.reduce((sum, item) => sum + getLineTotal(item), 0) * dollarExchangeRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}