"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Plus, Trash2, FileText, AlignLeft } from "lucide-react";
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
          Additional Information
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Add custom fields with title and data pairs to capture any additional information.
        </p>
      </div>

      {/* Information Card */}
      <Card className="border-2 border-indigo-100 shadow-2xl rounded-2xl overflow-hidden bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Custom Fields</h2>
              <p className="text-sm text-gray-600">
                Add custom title/data pairs for the client's record
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:border-indigo-300 hover:shadow-lg transition-all duration-200"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* Title Input */}
                  <div className="md:col-span-4">
                    <Label
                      htmlFor={`title-${idx}`}
                      className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"
                    >
                      <AlignLeft className="w-4 h-4 text-indigo-500" />
                      Title
                    </Label>
                    <Textarea
                      id={`title-${idx}`}
                      value={row.title}
                      onChange={(e) =>
                        handleUpdateRow(idx, "title", e.target.value)
                      }
                      placeholder="Enter field title"
                      className="border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 resize-none rounded-xl transition-all duration-200"
                      rows={1}
                    />
                  </div>
                  {/* Data Input */}
                  <div className="md:col-span-7">
                    <Label
                      htmlFor={`data-${idx}`}
                      className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-indigo-500" />
                      Data
                    </Label>
                    <Textarea
                      id={`data-${idx}`}
                      value={row.data}
                      onChange={(e) =>
                        handleUpdateRow(idx, "data", e.target.value)
                      }
                      placeholder="Enter field information"
                      className="border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 resize-none rounded-xl transition-all duration-200"
                      rows={1}
                    />
                  </div>
                  {/* Remove Button */}
                  <div className="md:col-span-1 flex items-center justify-end h-full pt-7">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 text-red-500 hover:text-white hover:bg-red-500 border-2 border-red-300 hover:border-red-500 rounded-xl transition-all duration-200"
                      onClick={() => handleRemoveRow(idx)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Row Button */}
            <div className="mt-6">
              <Button
                type="button"
                className="w-full h-14 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={handleAddRow}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Another Field
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700 hover:border-indigo-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={handleNext}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-700 hover:via-purple-700 hover:to-violet-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
        >
          Continue to Next Step
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
