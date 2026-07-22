"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, FilePlus, Package, DollarSign, Clock, Database } from "lucide-react";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store";
import type {
  DocumentWithRelations,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from "@/lib/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiFetch } from "@/lib/utils";
import { toast } from "sonner";

interface DocCounts {
  total: number;
  drafts: number;
  thisMonth: number;
  totalValue: number;
}

const typeLabels: Record<DocumentType, string> = {
  proforma: "Proforma",
  invoice: "Invoice",
  packing_list: "Packing List",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
};

export function DashboardView() {
  const navigate = useAppStore((s) => s.navigate);
  const queryClient = useQueryClient();

  const seedMutation = useMutation({
    mutationFn: () => apiFetch<{ success: boolean; message: string; data?: { companies: number; items: number } }>("/api/seed", { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      toast.success(data.message || "Database seeded successfully");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to seed database");
    },
  });

  const { data, isLoading } = useQuery<{
    documents: DocumentWithRelations[];
    counts: DocCounts;
  }>({
    queryKey: ["documents", "dashboard"],
    queryFn: () => apiFetch<{
      documents: DocumentWithRelations[];
      counts: DocCounts;
    }>("/api/documents?limit=10"),
  });

  const documents = data?.documents || [];
  const counts = data?.counts || { total: 0, drafts: 0, thisMonth: 0, totalValue: 0 };

  const kpis = [
    {
      title: "Total Documents",
      value: counts.total,
      icon: FileText,
      format: "number" as const,
    },
    {
      title: "This Month",
      value: counts.thisMonth,
      icon: Clock,
      format: "number" as const,
    },
    {
      title: "Pending Drafts",
      value: counts.drafts,
      icon: Package,
      format: "number" as const,
    },
    {
      title: "Total Value Issued",
      value: counts.totalValue,
      icon: DollarSign,
      format: "currency" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your commercial documents
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {kpi.format === "currency"
                    ? `$${kpi.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : kpi.value.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => navigate("new-document")}
          className="gap-2"
        >
          <FilePlus className="h-4 w-4" />
          New Proforma
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("documents")}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          View All Documents
        </Button>
        <Button
          variant="secondary"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="gap-2"
        >
          <Database className="h-4 w-4" />
          {seedMutation.isPending ? "Seeding..." : "Seed Demo Data"}
        </Button>
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Create your first document to get started."
              actionLabel="New Document"
              onAction={() => navigate("new-document")}
            />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Recipient</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}