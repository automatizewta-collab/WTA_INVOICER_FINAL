"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";
import type { AuditLogEntry } from "@/lib/types";
import { apiFetch } from "@/lib/utils";

const entityOptions = [
  { value: "", label: "Todas Entidades" },
  { value: "document", label: "Documentos" },
  { value: "user", label: "Usuários" },
  { value: "company", label: "Empresas" },
  { value: "item", label: "Itens" },
];

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  issue: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

function getActionBadge(action: string) {
  const verb = action.split(".")[1] || action;
  const color = actionColors[verb] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  return (
    <Badge variant="outline" className={`${color} border-current/20`}>
      {verb.toUpperCase()}
    </Badge>
  );
}

export function AuditLogsView() {
  const [entityFilter, setEntityFilter] = useState("");

  const { data, isLoading } = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ["audit-logs", entityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (entityFilter) params.set("entity", entityFilter);
      return apiFetch(`/api/audit-logs?${params.toString()}`);
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">
            Histórico de ações no sistema ({total} registros)
          </p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por entidade" />
              </SelectTrigger>
              <SelectContent>
                {entityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value || "all"}>
                    {opt.label}
                  </SelectItem>
                ))}
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
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum registro</p>
              <p className="text-sm">As ações dos usuários aparecerão aqui.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data/Hora</TableHead>
                    <TableHead className="w-[100px]">Ação</TableHead>
                    <TableHead className="w-[100px]">Entidade</TableHead>
                    <TableHead>ID/Ref</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead className="w-[120px]">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        {format(new Date(log.createdAt), "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-xs capitalize">
                        {log.entity || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[150px] truncate">
                        {log.entityId || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.userEmail || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.details || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.ipAddress || "—"}
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
