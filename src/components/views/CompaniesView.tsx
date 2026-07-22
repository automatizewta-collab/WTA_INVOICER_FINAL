"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, Building2, Star } from "lucide-react";
import { toast } from "sonner";
import type { Company } from "@/lib/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiFetch } from "@/lib/utils";

interface CompanyForm {
  name: string;
  type: "sender" | "recipient";
  contactName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  cnpj: string;
  stateRegistration: string;
  address: string;
  postalCode: string;
  state: string;
  isDefault: boolean;
  bankDetails: string;
  midCode: string;
}

const emptyForm: CompanyForm = {
  name: "",
  type: "sender",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  cnpj: "",
  stateRegistration: "",
  address: "",
  postalCode: "",
  state: "",
  isDefault: false,
  bankDetails: "",
  midCode: "",
};

export function CompaniesView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>({ ...emptyForm });
  const [activeTab, setActiveTab] = useState("sender");

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["companies", "all"],
    queryFn: () => apiFetch<Company[]>("/api/companies?type=all"),
  });

  const createMutation = useMutation({
    mutationFn: (body: CompanyForm) =>
      apiFetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company created successfully");
      closeDialog();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create company");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CompanyForm }) =>
      apiFetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company updated successfully");
      closeDialog();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update company");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deleted successfully");
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete company");
    },
  });

  const openCreate = (type: "sender" | "recipient") => {
    setEditingCompany(null);
    setForm({ ...emptyForm, type });
    setDialogOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setForm({
      name: company.name,
      type: company.type as "sender" | "recipient",
      contactName: company.contactName || "",
      email: company.email || "",
      phone: company.phone || "",
      city: company.city || "",
      country: company.country || "",
      cnpj: company.cnpj || "",
      stateRegistration: company.stateRegistration || "",
      address: company.address || "",
      postalCode: company.postalCode || "",
      state: company.state || "",
      isDefault: company.isDefault,
      bankDetails: company.bankDetails || "",
      midCode: company.midCode || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCompany(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = () => {
    if (!form.name) {
      toast.error("Company name is required");
      return;
    }
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const updateForm = (field: keyof CompanyForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const senders = companies.filter((c) => c.type === "sender");
  const recipients = companies.filter((c) => c.type === "recipient");

  const renderTable = (list: Company[], type: "sender" | "recipient") => (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={`No ${type}s yet`}
            description={`Add your first ${type} company.`}
            actionLabel={`New ${type === "sender" ? "Sender" : "Recipient"}`}
            onAction={() => openCreate(type)}
          />
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Contact
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    City / Country
                  </TableHead>
                  <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium text-sm">
                      {company.name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {company.contactName || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {company.email || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {[company.city, company.country]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">
                      {company.cnpj || "—"}
                    </TableCell>
                    <TableCell>
                      {company.isDefault && (
                        <Badge variant="default" className="gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(company)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteId(company.id)}
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
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">
          Manage sender and recipient companies
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className="flex justify-end">
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              onClick={() => openCreate(activeTab as "sender" | "recipient")}
            >
              <Plus className="h-4 w-4" />
              New {activeTab === "sender" ? "Sender" : "Recipient"}
            </Button>
          </DialogTrigger>
        </div>

        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "New Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update the company details below."
                : "Fill in the details for the new company."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Company Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex items-center gap-2 h-9">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="companyType"
                    value="sender"
                    checked={form.type === "sender"}
                    onChange={() => updateForm("type", "sender")}
                  />
                  <span className="text-sm">Sender</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="companyType"
                    value="recipient"
                    checked={form.type === "recipient"}
                    onChange={() => updateForm("type", "recipient")}
                  />
                  <span className="text-sm">Recipient</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={form.contactName}
                onChange={(e) => updateForm("contactName", e.target.value)}
                placeholder="Contact person"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                placeholder="email@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => updateForm("address", e.target.value)}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={form.state}
                onChange={(e) => updateForm("state", e.target.value)}
                placeholder="State / Province"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={(e) => updateForm("country", e.target.value)}
                placeholder="Country"
              />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input
                value={form.postalCode}
                onChange={(e) => updateForm("postalCode", e.target.value)}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => updateForm("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>State Registration</Label>
              <Input
                value={form.stateRegistration}
                onChange={(e) =>
                  updateForm("stateRegistration", e.target.value)
                }
                placeholder="State registration number"
              />
            </div>
            <div className="space-y-2">
              <Label>MID Code</Label>
              <Input
                value={form.midCode}
                onChange={(e) => updateForm("midCode", e.target.value)}
                placeholder="Manufacturer ID"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Bank Details</Label>
              <Input
                value={form.bankDetails}
                onChange={(e) => updateForm("bankDetails", e.target.value)}
                placeholder="Bank name, SWIFT, account..."
              />
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={form.isDefault}
                onCheckedChange={(v) => updateForm("isDefault", !!v)}
              />
              <Label htmlFor="isDefault" className="text-sm">
                Set as default {form.type}
              </Label>
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
              {editingCompany ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sender" className="gap-2">
            Senders ({senders.length})
          </TabsTrigger>
          <TabsTrigger value="recipient" className="gap-2">
            Recipients ({recipients.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sender" className="mt-4">
          {renderTable(senders, "sender")}
        </TabsContent>
        <TabsContent value="recipient" className="mt-4">
          {renderTable(recipients, "recipient")}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? Documents referencing
              this company will not be deleted, but may display incomplete
              information.
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