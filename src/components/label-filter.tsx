/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Label as LabelType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Filter, X } from "lucide-react";
import { useEffect, useState } from "react";

interface LabelFilterProps {
  onFilterChange: (labelIds: string[]) => void;
  selectedLabelIds: string[];
}

export default function LabelFilter({
  onFilterChange,
  selectedLabelIds,
}: LabelFilterProps) {
  const [labels, setLabels] = useState<LabelType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const supabase = createClientComponentClient();

  // Fetch all available labels
  useEffect(() => {
    const fetchLabels = async () => {
      setIsLoading(true);
      try {
        // Try to fetch from the new schema first
        const { data: newSchemaData, error: newSchemaError } = await supabase
          .from("labels")
          .select("*");

        if (!newSchemaError && newSchemaData && newSchemaData.length > 0) {
          // New schema data available
          setLabels(
            newSchemaData.map((label: LabelType) => ({
              id: label.id,
              name: label.name,
              color: label.color,
            }))
          );
        } else {
          // Try the old schema as fallback
          const { data: oldSchemaData, error: oldSchemaError } = await supabase
            .from("chat_labels")
            .select("distinct label");

          if (!oldSchemaError && oldSchemaData) {
            // Convert old schema data to label format
            const uniqueLabels = [
              ...new Set(oldSchemaData.map((item: any) => item.label)),
            ];
            setLabels(
              uniqueLabels.map((label: unknown) => ({
                id: String(label),
                name: String(label),
                color: "bg-gray-100 text-gray-600 border-gray-200", // Default color
              }))
            );
          }
        }
      } catch (err) {
        console.error("Error fetching labels:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabels();
  }, [supabase]);

  const toggleLabel = (labelId: string) => {
    const newSelection = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((id) => id !== labelId)
      : [...selectedLabelIds, labelId];

    onFilterChange(newSelection);
  };

  const clearFilters = () => {
    onFilterChange([]);
  };

  return (
    <div className="flex items-center">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex items-center gap-1 text-xs h-8",
              selectedLabelIds.length > 0 &&
                "bg-blue-50 border-blue-200 text-blue-600"
            )}
          >
            <Filter size={14} />
            <span>
              {selectedLabelIds.length > 0
                ? `Filtered (${selectedLabelIds.length})`
                : "Filter by Label"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Filter by Labels</h3>
              {selectedLabelIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            {isLoading ? (
              <p className="text-sm text-gray-500">Loading labels...</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {labels.length === 0 ? (
                  <p className="text-sm text-gray-500">No labels available</p>
                ) : (
                  labels.map((label) => (
                    <div key={label.id} className="flex items-center">
                      <label
                        htmlFor={`filter-${label.id}`}
                        className="flex items-center space-x-2 text-sm cursor-pointer py-1 px-2 rounded-md w-full hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          id={`filter-${label.id}`}
                          checked={selectedLabelIds.includes(label.id)}
                          onChange={() => toggleLabel(label.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs rounded-md",
                            label.color
                          )}
                        >
                          {label.name}
                        </span>
                      </label>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedLabelIds.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="ml-1 h-8 px-2"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
