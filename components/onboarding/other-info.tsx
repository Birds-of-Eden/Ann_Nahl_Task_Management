// components/onboarding/other-info.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Info,
  Plus,
  Trash2,
  FileText,
  AlignLeft,
  ListChecks,
} from "lucide-react";
import type { StepProps } from "@/types/onboarding";

export function OtherInfo({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  type KV = {
    category: string;
    title: string;
    data: string[]; // multiple items (links / texts)
  };

  // ---------- State ----------
  const [rows, setRows] = useState<KV[]>(() =>
    (formData.otherField || []).map((r) => ({
      category: r.category ?? "",
      title: r.title ?? "",
      data: Array.isArray(r.data) ? r.data : r.data ? [String(r.data)] : [""],
    }))
  );

  // Keep in sync with parent updates (if parent can change while mounted)
  useEffect(() => {
    setRows(
      (formData.otherField || []).map((r) => ({
        category: r.category ?? "",
        title: r.title ?? "",
        data: Array.isArray(r.data) ? r.data : r.data ? [String(r.data)] : [""],
      }))
    );
  }, [formData.otherField]);

  // ---------- Handlers ----------
  const handleNext = () => {
    const cleaned = rows
      .map((r) => ({
        category: r.category.trim(),
        title: r.title.trim(),
        data: r.data.map((d) => d.trim()).filter(Boolean),
      }))
      .filter((r) => r.title || r.data.length);

    updateFormData({ otherField: cleaned });
    onNext();
  };

  const handleUpdateRow = (index: number, field: keyof KV, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddDataItem = (rowIndex: number) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex ? { ...row, data: [...row.data, ""] } : row
      )
    );
  };

  const handleUpdateDataItem = (
    rowIndex: number,
    dataIndex: number,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              data: row.data.map((d, di) => (di === dataIndex ? value : d)),
            }
          : row
      )
    );
  };

  const handleRemoveDataItem = (rowIndex: number, dataIndex: number) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? { ...row, data: row.data.filter((_, di) => di !== dataIndex) }
          : row
      )
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { category: "", title: "", data: [""] }]);
  };

  // ---------- UI ----------
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg ring-1 ring-black/5">
          <ListChecks className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Additional Information
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-sm text-gray-600">
          Create professional, structured custom fields. Use a{" "}
          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-indigo-700 ring-1 ring-inset ring-indigo-200">
            Category
          </span>{" "}
          and a{" "}
          <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-purple-700 ring-1 ring-inset ring-purple-200">
            Title
          </span>{" "}
          and then add one or more{" "}
          <span className="rounded-md bg-gray-50 px-1.5 py-0.5 text-gray-700 ring-1 ring-inset ring-gray-200">
            Data Items
          </span>
          .
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-0 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] ring-1 ring-black/5 backdrop-blur bg-white">
        <CardContent className="p-6 md:p-8">
          {/* Card Header */}
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ring-1 ring-black/5">
              <Info className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Custom Fields
              </h2>
              <p className="text-sm text-gray-600">
                Add as many fields as you need. You can remove individual data
                items anytime.
              </p>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-6">
            {rows.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="text-sm text-gray-600">
                  No custom fields yet. Click{" "}
                  <span className="font-medium text-gray-900">
                    “Add Another Field”
                  </span>{" "}
                  to get started.
                </p>
              </div>
            )}

            {rows.map((row, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-gray-200/80 bg-white/70 p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Grid Labels (desktop) */}
                <div className="hidden grid-cols-12 gap-4 pb-2 text-xs font-medium text-gray-500 md:grid">
                  <div className="col-span-3 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-500" />
                    Category
                  </div>
                  <div className="col-span-3 flex items-center gap-1.5">
                    <AlignLeft className="h-3.5 w-3.5 text-indigo-500" />
                    Title
                  </div>
                  <div className="col-span-6 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-500" />
                    Data Items
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {/* Category */}
                  <div className="md:col-span-3">
                    <Label
                      htmlFor={`category-${idx}`}
                      className="mb-1 block text-[13px] font-medium text-gray-700 md:hidden"
                    >
                      Category
                    </Label>
                    <Textarea
                      id={`category-${idx}`}
                      value={row.category}
                      onChange={(e) =>
                        handleUpdateRow(idx, "category", e.target.value)
                      }
                      placeholder="e.g., Publications"
                      className="resize-none rounded-xl border-2 border-gray-200 bg-white/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      rows={1}
                    />
                  </div>

                  {/* Title */}
                  <div className="md:col-span-3">
                    <Label
                      htmlFor={`title-${idx}`}
                      className="mb-1 block text-[13px] font-medium text-gray-700 md:hidden"
                    >
                      Title
                    </Label>
                    <Textarea
                      id={`title-${idx}`}
                      value={row.title}
                      onChange={(e) =>
                        handleUpdateRow(idx, "title", e.target.value)
                      }
                      placeholder="Field title"
                      className="resize-none rounded-xl border-2 border-gray-200 bg-white/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      rows={1}
                    />
                  </div>

                  {/* Data Items */}
                  <div className="md:col-span-6">
                    <Label className="mb-1 block text-[13px] font-medium text-gray-700 md:hidden">
                      Data Items
                    </Label>

                    <div className="space-y-2">
                      {row.data.map((d, di) => (
                        <div key={di} className="flex items-start gap-2">
                          <Textarea
                            value={d}
                            onChange={(e) =>
                              handleUpdateDataItem(idx, di, e.target.value)
                            }
                            placeholder="Enter link or text"
                            className="flex-1 resize-none rounded-xl border-2 border-gray-200 bg-white/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                            rows={1}
                          />
                          <Button
                            type="button"
                            aria-label="Remove data item"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl border-2 border-red-200 text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                            onClick={() => handleRemoveDataItem(idx, di)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        onClick={() => handleAddDataItem(idx)}
                        variant="outline"
                        className="mt-2 w-full rounded-xl border-2 border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Data Item
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Row Button */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleAddRow}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 font-semibold text-white shadow-lg transition-all hover:translate-y-[-1px] hover:shadow-xl"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Another Field
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Navigation */}
      <div className="flex flex-col gap-3 pt-2 md:flex-row md:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          className="h-12 rounded-xl border-2 transition-all hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700 hover:shadow-sm"
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>
          Previous
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          className="h-12 rounded-xl bg-gray-900 text-white shadow-lg transition-all hover:translate-y-[-1px] hover:bg-black hover:shadow-xl"
        >
          Continue to Next Step
          <svg
            className="ml-2 inline-block h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
}
