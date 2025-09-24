"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Using Textarea for more flexibility
import { Card, CardContent } from "@/components/ui/card";
import { Info, Plus, Trash2 } from "lucide-react";
import type { StepProps } from "@/types/onboarding";

export function OtherInfo({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  type KV = { title: string; data: string };

  // Initialize state from formData
  const [rows, setRows] = useState<KV[]>(() =>
    (formData.otherField || []).map((r) => ({
      title: r.title ?? "",
      data: r.data ?? "",
    }))
  );

  // This useEffect can be removed if the component is only mounted once per data set.
  // If formData can change from the parent while this component is mounted, you can keep it.
  useEffect(() => {
    setRows(
      (formData.otherField || []).map((r) => ({
        title: r.title ?? "",
        data: r.data ?? "",
      }))
    );
  }, [formData.otherField]);

  const handleNext = () => {
    // Clean up data by trimming whitespace and filtering out empty rows before proceeding
    const cleaned = rows
      .map((r) => ({ title: r.title.trim(), data: r.data.trim() }))
      .filter((r) => r.title || r.data);
    updateFormData({ otherField: cleaned });
    onNext();
  };

  const handleUpdateRow = (index: number, field: keyof KV, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { title: "", data: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-slate-50/60">
        <CardContent className="p-6">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Info className="h-5 w-5 text-slate-500" />
              Other Information
            </h3>
            <p className="text-sm text-slate-500">
              Add custom title/data pairs. These will be saved in the client's
              record.
            </p>
          </div>

          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-start"
              >
                {/* Title Input */}
                <div className="md:col-span-4">
                  <Label
                    htmlFor={`title-${idx}`}
                    className="text-sm font-medium text-slate-600 mb-1 block"
                  >
                    Title
                  </Label>
                  <Textarea
                    id={`title-${idx}`}
                    value={row.title}
                    onChange={(e) =>
                      handleUpdateRow(idx, "title", e.target.value)
                    }
                    placeholder="Enter here title"
                    className="border-slate-300 focus-visible:ring-blue-500 resize-none"
                    rows={1}
                  />
                </div>
                {/* Data Input */}
                <div className="md:col-span-7">
                  <Label
                    htmlFor={`data-${idx}`}
                    className="text-sm font-medium text-slate-600 mb-1 block"
                  >
                    Data
                  </Label>
                  <Textarea
                    id={`data-${idx}`}
                    value={row.data}
                    onChange={(e) =>
                      handleUpdateRow(idx, "data", e.target.value)
                    }
                    placeholder="Enter here information"
                    className="border-slate-300 focus-visible:ring-blue-500 resize-none"
                    rows={1}
                  />
                </div>
                {/* Remove Button */}
                <div className="md:col-span-1 flex items-center justify-end h-full pt-7">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400 rounded-lg px-3 py-1"
                    onClick={() => handleRemoveRow(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove</span>
                  </Button>
                </div>
              </div>
            ))}

            {/* Add Row Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                className="border-green-300 text-green-600 hover:bg-green-600 hover:text-white mt-2"
                onClick={handleAddRow}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={handleNext}>Next</Button>
      </div>
    </div>
  );
}
