"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";

// Dialog + Excel-like Sheet Builder (no dummy data)
// - Use as a modal with open/onOpenChange
// - Excel-style grid + dynamic sheets/columns/rows
// - LocalStorage persistence

type CellRow = Record<string, string>;
type Section = { id: string; name: string; columns: string[]; rows: CellRow[] };

const uid = () => Math.random().toString(36).slice(2, 9);
const STORAGE_KEY = "boe.sheetbuilder.excel.dialog";

interface SheetBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    name: string;
    category?: { id: string; name: string } | null;
    dueDate?: string | null;
  } | null;
  clientId?: string;
  onSuccess?: () => void;
  readOnly?: boolean;
}

interface Agent {
  id: string;
  name?: string | null;
  email?: string | null;
}

export default function SheetBuilderDialog({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
  readOnly = false,
}: SheetBuilderDialogProps) {
  const [sections, setSections] = useState<Section[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [activeId, setActiveId] = useState<string>(() => sections[0]?.id ?? "");
  const [focusedCell, setFocusedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Agent and completion date state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [completionDate, setCompletionDate] = useState<string>("");
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!readOnly) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    }
  }, [sections, readOnly]);

  // Load existing data from task if in read-only mode
  useEffect(() => {
    if (open && task && readOnly) {
      try {
        const taskData = (task as any)?.taskCompletionJson;
        if (taskData?.monitoringSheets) {
          setSections(taskData.monitoringSheets);
          setActiveId(taskData.monitoringSheets[0]?.id || "");
          setSelectedAgent(taskData.doneByAgentId || "");
          setCompletionDate(taskData.completionDate || "");
        }
      } catch (e) {
        console.error("Failed to load monitoring data:", e);
      }
    }
  }, [open, task, readOnly]);

  // Load agents
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetch("/api/users?role=agent&limit=200");
        const data = await res.json();
        const agentList: Agent[] = (data?.users ?? data?.data ?? [])
          .filter((u: any) => u?.role?.name?.toLowerCase() === "agent")
          .map((u: any) => ({
            id: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
          }));
        setAgents(agentList);
      } catch (e) {
        console.error("Failed to load agents:", e);
      }
    };
    if (open && !readOnly) loadAgents();
  }, [open, readOnly]);

  const activeIndex = useMemo(
    () => sections.findIndex((s) => s.id === activeId),
    [sections, activeId]
  );
  const active = sections[activeIndex] ?? null;

  // Inline sheet name edit state
  const [editSheetId, setEditSheetId] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState<string>("");

  // Add fresh sheet (A,B,C + 10 empty rows)
  const addSection = () => {
    const name = `Sheet${sections.length + 1}`;
    const sec: Section = {
      id: uid(),
      name,
      columns: ["A", "B", "C"],
      rows: Array(10)
        .fill(null)
        .map(() => ({})),
    };
    setSections((prev) => [...prev, sec]);
    setActiveId(sec.id);
  };

  const renameSection = (id: string) => {
    const current = sections.find((s) => s.id === id)?.name || "";
    setEditSheetId(id);
    setEditSheetName(current);
  };

  const deleteSection = (id: string) => {
    setSections((p) => {
      const i = p.findIndex((s) => s.id === id);
      const ns = p.filter((s) => s.id !== id);
      if (id === activeId) setActiveId(ns[Math.max(0, i - 1)]?.id || "");
      return ns;
    });
  };

  const moveSection = (id: string, dir: -1 | 1) =>
    setSections((p) => {
      const i = p.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const c = [...p];
      const [it] = c.splice(i, 1);
      c.splice(j, 0, it);
      return c;
    });

  // Update column name with data migration
  const updateColumnName = (colIndex: number, newName: string) => {
    if (!active) return;
    const trimmed = (newName ?? "").trim();
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== active.id) return s;
        const fromKey = s.columns[colIndex];
        const toKey = trimmed || fromKey;
        if (toKey === fromKey) {
          const cols = [...s.columns];
          cols[colIndex] = toKey;
          return { ...s, columns: cols };
        }
        const cols = [...s.columns];
        cols[colIndex] = toKey;
        const rows = s.rows.map((r) => {
          if (fromKey in r) {
            if (!(toKey in r)) {
              const { [fromKey]: val, ...rest } = r as any;
              return { ...rest, [toKey]: val } as CellRow;
            } else {
              const { [fromKey]: _omit, ...rest } = r as any;
              return rest as CellRow;
            }
          }
          return r;
        });
        return { ...s, columns: cols, rows };
      })
    );
  };

  // Export all sheets to one CSV
  const exportToExcel = () => {
    if (sections.length === 0) return;

    let csvContent = "";

    sections.forEach((section, idx) => {
      // Add sheet name as header
      if (idx > 0) csvContent += "\n\n"; // Separate sheets
      csvContent += `Sheet: ${section.name}\n`;

      // Add column headers
      const headers = section.columns.join(",");
      csvContent += headers + "\n";

      // Add rows
      const rows = section.rows
        .map((row) =>
          section.columns
            .map((col) => {
              const value = row[col] || "";
              return value.includes(",") || value.includes('"')
                ? `"${value.replace(/"/g, '""')}"`
                : value;
            })
            .join(",")
        )
        .join("\n");
      csvContent += rows;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-all-sheets.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Column actions
  const addColumn = () => {
    if (!active) return;
    const newCol = String.fromCharCode(65 + active.columns.length); // A,B,C...
    setSections((p) =>
      p.map((s) => {
        if (s.id !== active.id) return s;
        const rows = s.rows.map((r) => ({ ...r, [newCol]: r[newCol] ?? "" }));
        return { ...s, columns: [...s.columns, newCol], rows };
      })
    );
  };

  const deleteColumn = (colIndex: number) => {
    if (!active) return;
    const key = active.columns[colIndex];
    setSections((p) =>
      p.map((s) => {
        if (s.id !== active.id) return s;
        const columns = s.columns.filter((_, i) => i !== colIndex);
        const rows = s.rows.map((r) => {
          const { [key]: _omit, ...rest } = r;
          return rest;
        });
        return { ...s, columns, rows };
      })
    );
  };

  // Row actions
  const addRow = () => {
    if (!active) return;
    const empty: CellRow = {};
    active.columns.forEach((c) => (empty[c] = ""));
    setSections((p) =>
      p.map((s) =>
        s.id === active.id ? { ...s, rows: [...s.rows, empty] } : s
      )
    );
  };
  const deleteRow = (rowIndex: number) => {
    if (!active) return;
    setSections((p) =>
      p.map((s) =>
        s.id === active.id
          ? { ...s, rows: s.rows.filter((_, i) => i !== rowIndex) }
          : s
      )
    );
  };
  const updateCell = (rowIndex: number, colKey: string, value: string) => {
    if (!active || readOnly) return;
    setSections((p) =>
      p.map((s) => {
        if (s.id !== active.id) return s;
        const rows = s.rows.map((r, i) =>
          i === rowIndex ? { ...r, [colKey]: value } : r
        );
        return { ...s, rows };
      })
    );
  };

  // Submit monitoring data to database
  const submitMonitoringData = async () => {
    const missing: string[] = [];
    if (!task?.id) missing.push("Task");
    if (!selectedAgent) missing.push("Done By Agent");
    if (!completionDate) missing.push("Completion Date");
    if (missing.length) {
      toast.error(`Missing: ${missing.join(", ")}`);
      return;
    }

    // At this point, task is guaranteed to exist due to validation above
    const taskId = task!.id;
    const dueDate = task!.dueDate;

    setIsSubmitting(true);
    try {
      const { user } = await fetch("/api/auth/session").then((r) => r.json());
      if (!user?.id) throw new Error("User not authenticated");

      // 1) Mark task as completed
      const r1 = await fetch(`/api/tasks/agents/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskId,
          status: "completed",
          completionLink: "",
        }),
      });
      if (!r1.ok) throw new Error("Failed to mark task completed");

      // 2) Update task with monitoring data
      const r2 = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: new Date(completionDate).toISOString(),
          taskCompletionJson: {
            monitoringSheets: sections,
            doneByAgentId: selectedAgent,
            completionDate,
            submittedAt: new Date().toISOString(),
          },
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName: user?.name || user?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Monitoring data submitted by data entry",
            doneByAgentId: selectedAgent,
          },
        }),
      });
      if (!r2.ok) throw new Error("Failed to save monitoring data");

      // 3) Reassign to selected agent
      if (clientId) {
        const r3 = await fetch(`/api/tasks/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            assignments: [
              {
                taskId: taskId,
                agentId: selectedAgent,
                note: "Reassigned to actual performer by data_entry (monitoring)",
                dueDate: dueDate,
              },
            ],
          }),
        });
        if (!r3.ok) throw new Error("Failed to reassign task");
      }

      // 4) Auto-approve
      const r4 = await fetch(`/api/tasks/${taskId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performanceRating: "Good",
          notes: `Done by agent: ${selectedAgent}`,
        }),
      });
      if (!r4.ok) throw new Error("Failed to approve task");

      toast.success("Monitoring data submitted successfully!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error?.message || "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] h-[85vh] p-0 overflow-hidden rounded-2xl flex flex-col">
        {/* Ribbon */}
        <header className="sticky top-0 z-10 border-b border-gray-300 bg-[#F3F3F3]">
          <div className="px-4 py-1 flex items-center justify-between border-b border-gray-300 bg-white">
            <DialogHeader className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                {task?.name || "Monitoring Task"}
              </DialogTitle>
            </DialogHeader>
            {readOnly ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close (View Only)
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
        </header>

        {/* Quick Access Toolbar */}
        <div className="px-4 py-2 flex items-center gap-2 bg-[#F3F3F3]">
          {!readOnly && (
            <>
              <Button
                onClick={addSection}
                className="h-8 px-3 bg-[#107C41] hover:bg-[#0E6B38] text-white"
              >
                + New Sheet
              </Button>
              {active && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                    className="h-8"
                  >
                    Insert Column
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                    className="h-8"
                  >
                    Insert Row
                  </Button>
                </>
              )}
              <Button
                onClick={exportToExcel}
                className="h-8 px-3 bg-[#107C41] hover:bg-[#0E6B38] text-white"
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setSections([]);
                  setActiveId("");
                }}
                className="ml-auto h-8"
              >
                Clear All
              </Button>
            </>
          )}
        </div>

        {/* Sheet Tabs */}
        <div className="px-4 flex items-center bg-white border-t border-gray-200 overflow-x-auto whitespace-nowrap">
          {sections.map((s) => (
            <div
              key={s.id}
              className={`shrink-0 flex items-center border-r border-gray-300 ${
                s.id === activeId
                  ? "bg-white border-t-2 border-t-[#107C41]"
                  : "bg-[#E9E9E9] hover:bg-[#DDDDDD]"
              }`}
            >
              <button
                onClick={() => setActiveId(s.id)}
                className="px-4 py-1.5 text-sm min-w-[80px] text-left"
              >
                {editSheetId === s.id ? (
                  <input
                    autoFocus
                    value={editSheetName}
                    onChange={(e) => setEditSheetName(e.target.value)}
                    onBlur={() => {
                      setSections((p) =>
                        p.map((x) =>
                          x.id === s.id
                            ? { ...x, name: editSheetName.trim() || x.name }
                            : x
                        )
                      );
                      setEditSheetId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditSheetId(null);
                    }}
                    className="w-full bg-white border border-gray-300 rounded px-2 py-0.5 text-sm"
                  />
                ) : (
                  s.name
                )}
              </button>
              <div className="flex gap-1 pr-2">
                <button
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    renameSection(s.id);
                  }}
                  className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded text-xs"
                >
                  ✎
                </button>
                <button
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSection(s.id);
                  }}
                  className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded text-xs"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={addSection}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 text-lg border-r border-gray-300"
            title="Add new sheet"
          >
            +
          </button>
        </div>

        {/* Grid */}
        <main className="px-4 py-4 flex-1 overflow-auto bg-[#F3F3F3]">
          {!active ? (
            <div className="flex flex-col items-center justify-center h-96 bg-white border border-gray-300 rounded-lg">
              <div className="text-gray-500 text-lg mb-4">
                No sheets available
              </div>
              <Button
                onClick={addSection}
                className="px-6 py-2 bg-[#107C41] text-white hover:bg-[#0E6B38]"
              >
                Create Your First Sheet
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-gray-300 shadow-sm">
              {/* Unified horizontal scroll area for headers + rows + add-row */}
              <div className="overflow-x-auto overflow-y-hidden">
                {/* Column Headers */}
                <div className="flex border-b border-gray-300 min-w-max">
                  <div className="w-12 shrink-0 border-right border-gray-300 bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-600 font-medium border-r">
                    {active.rows.length}
                  </div>
                  {active.columns.map((col, i) => (
                    <div
                      key={i}
                      className="relative w-[120px] shrink-0 border-r border-gray-300 bg-[#F8F9FA] px-2 py-1 text-xs font-semibold text-gray-700"
                    >
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => updateColumnName(i, e.target.value)}
                        className="w-full h-full bg-transparent border-none outline-none text-center font-semibold py-1"
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Column"
                        disabled={readOnly}
                      />
                      <button
                        type="button"
                        onClick={() => deleteColumn(i)}
                        className="absolute right-1 top-1 px-1 leading-none text-xs text-gray-400 hover:text-red-600"
                        title="Remove column"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Rows */}
                <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  {active.rows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex border-b border-gray-200 hover:bg-gray-50 min-w-max"
                    >
                      <div className="relative w-12 shrink-0 border-r border-gray-300 bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-500 py-1">
                        {rowIndex + 1}
                        <button
                          type="button"
                          onClick={() => deleteRow(rowIndex)}
                          className="absolute right-0.5 top-0.5 px-1 leading-none text-[10px] text-gray-400 hover:text-red-600"
                          title="Remove row"
                        >
                          ×
                        </button>
                      </div>
                      {active.columns.map((col, colIndex) => (
                        <div
                          key={colIndex}
                          className={`w-[120px] shrink-0 border-r border-gray-200 p-0 ${
                            focusedCell?.row === rowIndex &&
                            focusedCell?.col === colIndex
                              ? "ring-2 ring-blue-500 ring-inset"
                              : ""
                          }`}
                        >
                          <input
                            className="w-full h-full px-2 py-1 text-sm outline-none border-0 bg-transparent"
                            value={row[col] ?? ""}
                            onChange={(e) =>
                              updateCell(rowIndex, col, e.target.value)
                            }
                            onFocus={() =>
                              setFocusedCell({ row: rowIndex, col: colIndex })
                            }
                            onBlur={() => setFocusedCell(null)}
                            disabled={readOnly}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {active.rows.length === 0 && (
                  <div className="py-12 text-center text-gray-500 min-w-max">
                    No data. Start typing in the cells or add more rows.
                  </div>
                )}
              </div>

              {/* Add Row - outside scroll area */}
              <div className="border-t border-gray-300 p-2 bg-[#F8F9FA]">
                <Button variant="outline" size="sm" onClick={addRow}>
                  + Add Row
                </Button>
              </div>
            </div>
          )}

          {/* Status bar */}
          {active && (
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <div>Ready</div>
              <div className="flex items-center gap-4">
                <span>Sheets: {sections.length}</span>
                <span>Rows: {active.rows.length}</span>
                <span>Columns: {active.columns.length}</span>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <DialogFooter className="border-t bg-white px-4 py-4 flex flex-col sm:flex-row justify-between gap-4 min-h-[120px]">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Done By Agent */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">
                Done By Agent
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#107C41]"
                disabled={readOnly}
              >
                <option value="">Select Agent</option>
                {agents
                  .filter((a) =>
                    agentSearchTerm
                      ? (a.name || a.email || "")
                          .toLowerCase()
                          .includes(agentSearchTerm.toLowerCase())
                      : true
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.email || a.id}
                    </option>
                  ))}
              </select>
            </div>

            {/* Completion Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">
                Completion Date
              </label>
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#107C41]"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {!readOnly && (
              <>
                {/* Debug info - remove after testing */}
                <div className="text-xs text-gray-500">
                  Task ID: {task?.id ? "✓" : "✗"} | Agent: {selectedAgent ? "✓" : "✗"} | Date: {completionDate ? "✓" : "✗"}
                </div>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={submitMonitoringData}
                    disabled={
                      isSubmitting ||
                      !task?.id ||
                      !selectedAgent ||
                      !completionDate
                    }
                    className="bg-[#107C41] hover:bg-[#0E6B38] text-white"
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
