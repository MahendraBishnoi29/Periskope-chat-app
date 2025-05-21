/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LabelRecord, Label as LabelType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { AlertCircle, Check, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface LabelManagerProps {
  chatId: string;
  currentLabels: LabelType[];
  onLabelsUpdated: () => void;
}

const LABEL_COLORS = [
  { name: "Red", value: "bg-red-100 text-red-600 border-red-200" },
  { name: "Green", value: "bg-green-100 text-green-600 border-green-200" },
  { name: "Blue", value: "bg-blue-100 text-blue-600 border-blue-200" },
  { name: "Purple", value: "bg-purple-100 text-purple-600 border-purple-200" },
  { name: "Yellow", value: "bg-yellow-100 text-yellow-600 border-yellow-200" },
  { name: "Orange", value: "bg-orange-100 text-orange-600 border-orange-200" },
  { name: "Pink", value: "bg-pink-100 text-pink-600 border-pink-200" },
  { name: "Gray", value: "bg-gray-100 text-gray-600 border-gray-200" },
];

export default function LabelManager({
  chatId,
  currentLabels,
  onLabelsUpdated,
}: LabelManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null);
  const [showSchemaHelp, setShowSchemaHelp] = useState(false);

  const supabase = createClientComponentClient();

  // initialize selected labels from current labels
  useEffect(() => {
    setSelectedLabels(currentLabels.map((label) => label.id));
  }, [currentLabels]);

  const fetchLabels = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.from("labels").select("*");

      if (error) {
        throw error;
      }

      setAvailableLabels(
        (data || []).map((label: LabelRecord) => ({
          id: label.id,
          name: label.name,
          color: label.color,
        }))
      );
    } catch (err: any) {
      console.error("Error fetching labels:", err);
      setError(`Failed to load labels: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLabels();
    }
  }, [isOpen]);

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      setError("Label name cannot be empty");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const labelId = editingLabel ? editingLabel.id : uuidv4();

      const labelData = {
        id: labelId,
        name: newLabelName.trim(),
        color: selectedColor,
      };

      if (editingLabel) {
        // Update existing label
        const { error } = await supabase
          .from("labels")
          .update(labelData)
          .eq("id", labelId);

        if (error) throw error;
      } else {
        // Create new label
        const { error } = await supabase.from("labels").insert(labelData);

        if (error) throw error;

        // Add the new label to selected labels
        setSelectedLabels((prev) => [...prev, labelId]);
      }

      // Reset form and refresh labels
      setNewLabelName("");
      setSelectedColor(LABEL_COLORS[0].value);
      setIsCreatingLabel(false);
      setEditingLabel(null);
      await fetchLabels();
    } catch (err: any) {
      console.error("Error creating label:", err);
      setError(`Failed to create label: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this label? This will remove it from all chats."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // delete the label
      const { error } = await supabase
        .from("labels")
        .delete()
        .eq("id", labelId);

      if (error) throw error;

      // remove from selected labels
      setSelectedLabels((prev) => prev.filter((id) => id !== labelId));

      // refresh labels
      await fetchLabels();
    } catch (err: any) {
      console.error("Error deleting label:", err);
      setError(`Failed to delete label: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditLabel = (label: LabelType) => {
    setEditingLabel(label);
    setNewLabelName(label.name);
    setSelectedColor(label.color);
    setIsCreatingLabel(true);
  };

  const handleSaveLabels = async () => {
    setIsLoading(true);
    setError(null);
    setShowSchemaHelp(false);

    try {
      // First, delete all existing chat-label associations for this chat
      const { error: deleteError } = await supabase
        .from("chat_labels")
        .delete()
        .eq("chat_id", chatId);

      if (deleteError) {
        console.error("Error deleting existing labels:", deleteError);
        throw deleteError;
      }

      // Then insert the new associations
      if (selectedLabels.length > 0) {
        // Get the label names for the selected label IDs
        const selectedLabelData = availableLabels.filter((label) =>
          selectedLabels.includes(label.id)
        );

        // Insert each label one by one to better handle errors
        for (const label of selectedLabelData) {
          try {
            // First try with label_id (new schema)
            const { error: insertError } = await supabase
              .from("chat_labels")
              .insert({
                chat_id: chatId,
                label_id: label.id,
              });

            if (insertError) {
              // If that fails, try with label (old schema)
              const { error: oldSchemaError } = await supabase
                .from("chat_labels")
                .insert({
                  chat_id: chatId,
                  label: label.name,
                });

              if (oldSchemaError) {
                // Check if this is a schema mismatch error
                if (
                  oldSchemaError.message &&
                  oldSchemaError.message.includes(
                    "violates not-null constraint"
                  )
                ) {
                  setShowSchemaHelp(true);
                }
                throw oldSchemaError;
              }
            }
          } catch (err: any) {
            console.error("Error inserting label:", err);
            throw err;
          }
        }
      }

      // Close dialog and notify parent
      setIsOpen(false);
      onLabelsUpdated();
    } catch (err: any) {
      console.error("Error saving labels:", err);
      setError(`Error saving labels: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-xs flex items-center gap-1"
      >
        <Plus size={14} />
        <span>Manage Labels</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Chat Labels</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showSchemaHelp && (
            <Alert className="mt-2 bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                <p className="mb-2">
                  There is a database schema mismatch. Please run the following
                  SQL script in your Supabase SQL Editor to update your schema:
                </p>
                <pre className="bg-gray-800 text-white p-2 rounded text-xs overflow-auto"></pre>
              </AlertDescription>
            </Alert>
          )}

          <div className="py-4">
            {/* Label creation form */}
            {isCreatingLabel ? (
              <div className="mb-4 p-4 border rounded-md">
                <h3 className="text-sm font-medium mb-2">
                  {editingLabel ? "Edit Label" : "Create New Label"}
                </h3>
                <div className="space-y-3">
                  <div>
                    <Input
                      placeholder="Label name"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">
                      Select color
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {LABEL_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setSelectedColor(color.value)}
                          className={cn(
                            "h-8 rounded-md border",
                            color.value,
                            selectedColor === color.value &&
                              "ring-2 ring-offset-2 ring-blue-500"
                          )}
                        >
                          {selectedColor === color.value && (
                            <Check size={16} className="mx-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCreatingLabel(false);
                        setEditingLabel(null);
                        setNewLabelName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateLabel}
                      disabled={isLoading || !newLabelName.trim()}
                    >
                      {isLoading
                        ? "Saving..."
                        : editingLabel
                        ? "Update"
                        : "Create"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingLabel(true)}
                className="mb-4"
              >
                <Plus size={14} className="mr-1" />
                Create New Label
              </Button>
            )}

            {/* Available labels */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <h3 className="text-sm font-medium">Available Labels</h3>
              {isLoading && (
                <p className="text-sm text-gray-500">Loading labels...</p>
              )}

              {!isLoading && availableLabels.length === 0 && (
                <p className="text-sm text-gray-500">
                  No labels available. Create one to get started.
                </p>
              )}

              {availableLabels.map((label) => (
                <div
                  key={label.id}
                  className="flex items-center justify-between p-2 border rounded-md"
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`label-${label.id}`}
                      checked={selectedLabels.includes(label.id)}
                      onChange={() => toggleLabel(label.id)}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor={`label-${label.id}`}
                      className="flex items-center cursor-pointer"
                    >
                      <span
                        className={cn(
                          "px-2 py-1 text-xs rounded-md mr-2",
                          label.color
                        )}
                      >
                        {label.name}
                      </span>
                    </label>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditLabel(label)}
                      className="h-7 w-7"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteLabel(label.id)}
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLabels} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Labels"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
