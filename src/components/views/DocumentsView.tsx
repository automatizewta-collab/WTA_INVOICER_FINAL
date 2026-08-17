"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileDown,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type {
  DocumentWithRelations,
  DocumentType,
} from "@/lib/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiFetch } from "@/lib/utils";

const typeLabels: Record<DocumentType, string> = {
  proforma: "Proforma",
  invoice: "Invoice",
  packing_list: "Packing List",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
};

export function DocumentsView() {
  const navigate = useAppStore((s) => s.navigate);
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    documents: DocumentWithRelations[];
  }>({
    queryKey: ["documents", typeFilter, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return apiFetch<{ documents: DocumentWithRelations[] }>(`/api/documents?${params.toString()}`);
    },
  });

  const documents = data?.documents || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted successfully");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Failed to delete document");
    },
  });

  const generatePdfMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/documents/${id}/pdf`, { method: "POST" }),
    onSuccess: () => {
      toast.success("PDF generation requested");
    },
    onError: () => {
      toast.error("Failed to generate PDF");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage your commercial documents
          </p>
        </div>
        <Button onClick={() => navigate("new-document")} className="gap-2">
          <FileText className="h-4 w-4" />
          New Document
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="proforma">Proforma</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="packing_list">Packing List</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents found"
              description={
                search || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Create your first document to get started."
              }
              actionLabel="New Document"
              onAction={() => navigate("new-document")}
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer"
                      onClick={() => navigate("edit-document", doc.id)}
                    >
                      <TableCell className="font-medium font-mono text-xs">
                        {doc.number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {typeLabels[doc.documentType as DocumentType] || doc.documentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            doc.status === "issued" ? "default" : "outline"
                          }
                        >
                          {statusLabels[doc.status] || doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(doc.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.sender?.name || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.recipient?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate("edit-document", doc.id);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                generatePdfMutation.mutate(doc.id);
                              }}
                            >
                              <FileDown className="h-4 w-4 mr-2" />
                              Generate PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(doc.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be
              undone.
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