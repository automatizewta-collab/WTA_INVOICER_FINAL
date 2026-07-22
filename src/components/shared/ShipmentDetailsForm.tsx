"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import type { ShipmentBox, ShipmentDetails } from "@/lib/types";

interface ShipmentDetailsFormProps {
  data: ShipmentDetails;
  onChange: (data: ShipmentDetails) => void;
}

export function ShipmentDetailsForm({
  data,
  onChange,
}: ShipmentDetailsFormProps) {
  // Defensive: ensure boxes is always a valid array even if stored JSON was partial
  const safeBoxes = Array.isArray(data.boxes) ? data.boxes : [];

  const updateField = <K extends keyof ShipmentDetails>(
    key: K,
    value: ShipmentDetails[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  const addBox = () => {
    onChange({
      ...data,
      boxes: [...safeBoxes, { quantity: 1, type: "", dimensions: "" }],
    });
  };

  const removeBox = (index: number) => {
    onChange({
      ...data,
      boxes: safeBoxes.filter((_, i) => i !== index),
    });
  };

  const updateBox = (index: number, field: keyof ShipmentBox, value: string | number) => {
    const updated = [...safeBoxes];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, boxes: updated });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="carrier">Carrier</Label>
          <Input
            id="carrier"
            value={data.carrier}
            onChange={(e) => updateField("carrier", e.target.value)}
            placeholder="e.g. FedEx, DHL"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incoterms">Incoterms</Label>
          <Input
            id="incoterms"
            value={data.incoterms}
            onChange={(e) => updateField("incoterms", e.target.value)}
            placeholder="e.g. FOB, CIF, EXW"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awb">AWB / Tracking</Label>
          <Input
            id="awb"
            value={data.awb}
            onChange={(e) => updateField("awb", e.target.value)}
            placeholder="Airway Bill number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="origin_port">Origin Port</Label>
          <Input
            id="origin_port"
            value={data.origin_port}
            onChange={(e) => updateField("origin_port", e.target.value)}
            placeholder="e.g. GRU, VCP"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destination_port">Destination Port</Label>
          <Input
            id="destination_port"
            value={data.destination_port}
            onChange={(e) => updateField("destination_port", e.target.value)}
            placeholder="e.g. MIA, LAX"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipment_date">Shipment Date</Label>
          <Input
            id="shipment_date"
            type="date"
            value={data.shipment_date}
            onChange={(e) => updateField("shipment_date", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Boxes</h4>
          <Button type="button" variant="outline" size="sm" onClick={addBox}>
            <Plus className="h-4 w-4 mr-1" />
            Add Box
          </Button>
        </div>
        {safeBoxes.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            No boxes added. Click &quot;Add Box&quot; to create one.
          </p>
        )}
        {safeBoxes.map((box, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                min={1}
                value={box.quantity}
                onChange={(e) =>
                  updateBox(index, "quantity", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Type</Label>
              <Input
                value={box.type}
                onChange={(e) => updateBox(index, "type", e.target.value)}
                placeholder="e.g. Carton"
                className="h-9"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Dimensions</Label>
              <Input
                value={box.dimensions}
                onChange={(e) =>
                  updateBox(index, "dimensions", e.target.value)
                }
                placeholder="e.g. 50x40x30cm"
                className="h-9"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => removeBox(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gross_weight">Gross Weight (kg)</Label>
          <Input
            id="gross_weight"
            type="number"
            step="0.01"
            value={data.gross_weight || ""}
            onChange={(e) =>
              updateField("gross_weight", parseFloat(e.target.value) || 0)
            }
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="net_weight">Net Weight (kg)</Label>
          <Input
            id="net_weight"
            type="number"
            step="0.01"
            value={data.net_weight || ""}
            onChange={(e) =>
              updateField("net_weight", parseFloat(e.target.value) || 0)
            }
            placeholder="0.00"
          />
        </div>
      </div>
    </div>
  );
}