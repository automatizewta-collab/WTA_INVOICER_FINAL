"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import type { Item } from "@/lib/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiFetch } from "@/lib/utils";

const emptyItem = {
  code: "",
  namePt: "",
  nameEn: "",
  nameEs: "",
  unitValueUsd: 0,
  grossWeight: 0,
  netWeight: 0,
  htsusCode: "",
  endUse: "",
  endUseEs: "",
  sterileAtImport: "NO",
};

export function ItemsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState(emptyItem);

  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    items: Item[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["items", search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      return apiFetch(`/api/items?${params.toString()}`);
    },
  });

  const items = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.ceil(totalItems / (data?.limit ?? 50));

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyItem) =>
      apiFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item criado com sucesso");
      closeDialog();
    },
    onError: () => {
      toast.error("Failed to create item");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof emptyItem }) =>
      apiFetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item atualizado com sucesso");
      closeDialog();
    },
    onError: () => {
      toast.error("Failed to update item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item excluído com sucesso");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Failed to delete item");
    },
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyItem });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      namePt: item.namePt,
      nameEn: item.nameEn,
      nameEs: item.nameEs || "",
      unitValueUsd: item.unitValueUsd,
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      htsusCode: item.htsusCode || "",
      endUse: item.endUse || "",
      endUseEs: item.endUseEs || "",
      sterileAtImport: item.sterileAtImport,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ ...emptyItem });
  };

  const handleSubmit = () => {
    if (!form.code || !form.namePt) {
      toast.error("Código e Nome (PT) são obrigatórios");
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const updateForm = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Items Catalog</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Item" : "New Item"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Update the item details below."
                  : "Fill in the details for the new item."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => updateForm("code", e.target.value)}
                  placeholder="e.g. SKU-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Name (PT) *</Label>
                <Input
                  value={form.namePt}
                  onChange={(e) => updateForm("namePt", e.target.value)}
                  placeholder="Nome em português"
                />
              </div>
              <div className="space-y-2">
                <Label>Name (EN) *</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => updateForm("nameEn", e.target.value)}
                  placeholder="Name in English"
                />
              </div>
              <div className="space-y-2">
                <Label>Name (ES)</Label>
                <Input
                  value={form.nameEs}
                  onChange={(e) => updateForm("nameEs", e.target.value)}
                  placeholder="Nombre en español"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Value (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.unitValueUsd}
                  onChange={(e) =>
                    updateForm("unitValueUsd", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>HTSUS Code</Label>
                <Input
                  value={form.htsusCode}
                  onChange={(e) => updateForm("htsusCode", e.target.value)}
                  placeholder="0000.00.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Gross Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.grossWeight}
                  onChange={(e) =>
                    updateForm(
                      "grossWeight",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Net Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.netWeight}
                  onChange={(e) =>
                    updateForm(
                      "netWeight",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Use</Label>
                <Input
                  value={form.endUse}
                  onChange={(e) => updateForm("endUse", e.target.value)}
                  placeholder="e.g. Surgical instrument"
                />
              </div>
              <div className="space-y-2">
                <Label>End Use (ES)</Label>
                <Input
                  value={form.endUseEs}
                  onChange={(e) => updateForm("endUseEs", e.target.value)}
                  placeholder="Uso final en español"
                />
              </div>
              <div className="space-y-2">
                <Label>Sterile at Import</Label>
                <div className="flex items-center gap-2 h-9">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sterile"
                      value="YES"
                      checked={form.sterileAtImport === "YES"}
                      onChange={() => updateForm("sterileAtImport", "YES")}
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sterile"
                      value="NO"
                      checked={form.sterileAtImport === "NO"}
                      onChange={() => updateForm("sterileAtImport", "NO")}
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending || updateMutation.isPending
                }
              >
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 max-w-md"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum item encontrado"
              description={
                search
                  ? "Tente ajustar sua busca."
                  : "Adicione itens ao catálogo de produtos."
              }
              actionLabel="Novo Item"
              onAction={openCreate}
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name (PT)</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Name (EN)
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      Name (ES)
                    </TableHead>
                    <TableHead>Unit Value</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Gross Wt
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Net Wt
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      HTSUS
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {item.code}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.namePt}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {item.nameEn}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs">
                        {item.nameEs || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        ${item.unitValueUsd.toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {item.grossWeight} kg
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {item.netWeight} kg
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-mono">
                        {item.htsusCode || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalItems > (data?.limit ?? 50) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {items.length} de {totalItems} itens
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}