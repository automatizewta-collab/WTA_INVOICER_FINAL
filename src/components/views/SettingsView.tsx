"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Info } from "lucide-react";
import { toast } from "sonner";
import type { Company } from "@/lib/types";
import { apiFetch } from "@/lib/utils";

export function SettingsView() {
  const queryClient = useQueryClient();

  const { data: settings = {}, isLoading: settingsLoading } = useQuery<
    Record<string, string>
  >({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Record<string, string>>("/api/settings"),
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies", "sender"],
    queryFn: () => apiFetch<Company[]>("/api/companies?type=sender"),
  });

  const [localSettings, setLocalSettings] = useState<Record<string, string>>(
    {}
  );

  // Initialize local settings when data loads
  const initialized = !!settings && !settingsLoading;
  const effectiveSettings = initialized
    ? { ...settings, ...localSettings }
    : localSettings;

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setLocalSettings({});
      toast.success("Settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const handleSave = () => {
    updateMutation.mutate(effectiveSettings);
  };

  const updateSetting = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your application preferences
        </p>
      </div>

      {/* App Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select
                  value={effectiveSettings.default_currency || "USD"}
                  onValueChange={(v) => updateSetting("default_currency", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Language</Label>
                <Select
                  value={effectiveSettings.default_language || "en"}
                  onValueChange={(v) => updateSetting("default_language", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default USD Exchange Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5.25"
                  value={effectiveSettings.default_exchange_rate || ""}
                  onChange={(e) =>
                    updateSetting("default_exchange_rate", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used as the default when creating new documents
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Incoterms</Label>
                <Input
                  placeholder="e.g. FOB"
                  value={effectiveSettings.default_incoterms || ""}
                  onChange={(e) =>
                    updateSetting("default_incoterms", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Default HTSUS Column Title</Label>
                <Input
                  placeholder="e.g. HTSUS Code"
                  value={effectiveSettings.default_htsus_title || ""}
                  onChange={(e) =>
                    updateSetting("default_htsus_title", e.target.value)
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Default Sender */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Sender Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settingsLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={effectiveSettings.default_sender_id || ""}
              onValueChange={(v) =>
                updateSetting("default_sender_id", v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default sender..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>

      <Separator />

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Invoicer</span> —
            Commercial Document Management System
          </p>
          <p>Version 1.0.0</p>
          <p>
            Manage proforma invoices, commercial invoices, and packing lists for
            export operations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}