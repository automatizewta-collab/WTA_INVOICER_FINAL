"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";

interface NotesFormProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

export function NotesForm({ notes, onChange }: NotesFormProps) {
  const safeNotes = Array.isArray(notes) ? notes : [];

  const addNote = () => {
    onChange([...safeNotes, ""]);
  };

  const removeNote = (index: number) => {
    onChange(safeNotes.filter((_, i) => i !== index));
  };

  const updateNote = (index: number, value: string) => {
    const updated = [...safeNotes];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Notes</h3>
        <Button type="button" variant="outline" size="sm" onClick={addNote}>
          <Plus className="h-4 w-4 mr-1" />
          Add Note
        </Button>
      </div>
      {safeNotes.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          No notes added. Click &quot;Add Note&quot; to create one.
        </p>
      )}
      {safeNotes.map((note, index) => (
        <div key={index} className="flex gap-2 items-start">
          <Textarea
            value={note}
            onChange={(e) => updateNote(index, e.target.value)}
            placeholder={`Note ${index + 1}`}
            className="flex-1 min-h-[60px]"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 mt-1"
            onClick={() => removeNote(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}