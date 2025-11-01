import React, { useEffect, useMemo, useState } from "react";

// Dynamic Sheet Builder — Excel-like design with fresh start
type CellRow = Record<string, string>;
type Section = { id: string; name: string; columns: string[]; rows: CellRow[] };
const uid = () => Math.random().toString(36).slice(2, 9);
const STORAGE_KEY = "boe.sheetbuilder.excel";

export default function SheetBuilderPage() {
  const [sections, setSections] = useState<Section[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return []; // Start completely fresh - no default sections
  });

  const [activeId, setActiveId] = useState<string>(() => sections[0]?.id ?? "");
  const [focusedCell, setFocusedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  }, [sections]);

  const activeIndex = useMemo(
    () => sections.findIndex((s) => s.id === activeId),
    [sections, activeId]
  );
  const active = sections[activeIndex] ?? null;

  // Inline sheet name edit state (replaces alerts)
  const [editSheetId, setEditSheetId] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState<string>("");

  // Create a fresh new sheet with auto-generated name
  const addSection = () => {
    const name = `Sheet${sections.length + 1}`;
    const sec: Section = {
      id: uid(),
      name,
      columns: ["A", "B", "C"], // Excel-like column headers
      rows: Array(10)
        .fill(null)
        .map(() => ({})), // Start with 10 empty rows
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

  // Update column name
  const updateColumnName = (colIndex: number, newName: string) => {
    if (!active) return;
    const trimmed = (newName ?? "").trim();
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== active.id) return s;
        const fromKey = s.columns[colIndex];
        const toKey = trimmed || fromKey; // keep old if empty
        // If nothing changes, just normalize the label
        if (toKey === fromKey) {
          const cols = [...s.columns];
          cols[colIndex] = toKey;
          return { ...s, columns: cols };
        }
        // Rename column and migrate row data
        const cols = [...s.columns];
        cols[colIndex] = toKey;
        const rows = s.rows.map((r) => {
          if (fromKey in r) {
            // Only migrate if destination key doesn't already exist
            if (!(toKey in r)) {
              const { [fromKey]: val, ...rest } = r as any;
              return { ...rest, [toKey]: val } as CellRow;
            } else {
              // Destination exists; keep destination, drop old key
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

  // Export to Excel (CSV format)
  const exportToExcel = () => {
    if (!active) return;

    // Create CSV content
    const headers = active.columns.join(",");
    const rows = active.rows
      .map((row) =>
        active.columns
          .map((col) => {
            const value = row[col] || "";
            // Escape quotes and wrap in quotes if contains comma
            return value.includes(",") || value.includes('"')
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(",")
      )
      .join("\n");

    const csvContent = `${headers}\n${rows}`;

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${active.name}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Column actions
  const addColumn = () => {
    if (!active) return;
    const newCol = String.fromCharCode(65 + active.columns.length); // A, B, C, etc.
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
    if (!active) return;
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

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-slate-900">
      {/* Excel-like Ribbon */}
      <header className="sticky top-0 z-20 border-b border-gray-300 bg-[#F3F3F3]">
        <div className="mx-auto px-4 py-1 flex items-center gap-4 border-b border-gray-300 bg-white">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-gray-800">
              Monitoring Sheet Builder
            </span>
          </div>
        </div>

        {/* Quick Access Toolbar */}
        <div className="mx-auto px-4 py-2 flex items-center gap-2">
          <button
            onClick={addSection}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#107C41] text-white rounded text-sm hover:bg-[#0E6B38]"
          >
            <span>+</span> New Sheet
          </button>
          {active && (
            <>
              <button
                onClick={addColumn}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                Insert Column
              </button>
              <button
                onClick={addRow}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                Insert Row
              </button>
            </>
          )}
          {active && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#107C41] text-white rounded text-sm hover:bg-[#0E6B38]"
            >
              📊 Export to Excel
            </button>
          )}
          <button
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setSections([]);
              setActiveId("");
            }}
            className="ml-auto px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            Clear All Data
          </button>
        </div>

        {/* Sheet Tabs - Excel Style */}
        <div className="mx-auto px-4 flex items-center">
          {sections.map((s, index) => (
            <div
              key={s.id}
              className={`flex items-center border-r border-gray-300 ${
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
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        setEditSheetId(null);
                      }
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
      </header>

      {/* Excel-like Grid */}
      <main className="mx-auto px-4 py-4 w-[100%] overflow-auto">
        {!active ? (
          <div className="flex flex-col items-center justify-center h-96 bg-white border border-gray-300 rounded-lg">
            <div className="text-gray-500 text-lg mb-4">
              No sheets available
            </div>
            <button
              onClick={addSection}
              className="px-6 py-2 bg-[#107C41] text-white rounded hover:bg-[#0E6B38]"
            >
              Create Your First Sheet
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-300 shadow-sm">
            {/* Column Headers */}
            <div className="flex border-b border-gray-300">
              {/* Corner cell */}
              <div className="w-12 border-r border-gray-300 bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-600 font-medium">
                {active.rows.length}
              </div>

              {/* Editable column headers */}
              {active.columns.map((col, i) => (
                <div
                  key={i}
                  className="relative flex-1 min-w-[120px] border-r border-gray-300 bg-[#F8F9FA] px-2 py-1 text-xs font-semibold text-gray-700"
                >
                  <input
                    type="text"
                    value={col}
                    onChange={(e) => updateColumnName(i, e.target.value)}
                    className="w-full h-full bg-transparent border-none outline-none text-center font-semibold py-1"
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Column"
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

            {/* Data Rows */}
            <div className="max-h-[60vh] overflow-auto">
              {active.rows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex border-b border-gray-200 hover:bg-gray-50"
                >
                  {/* Row number with delete */}
                  <div className="relative w-12 border-r border-gray-300 bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-500 py-1">
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

                  {/* Data cells */}
                  {active.columns.map((col, colIndex) => (
                    <div
                      key={colIndex}
                      className={`flex-1 min-w-[120px] border-r border-gray-200 p-0 ${
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
                        placeholder=""
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Empty state */}
            {active.rows.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                No data. Start typing in the cells or add more rows.
              </div>
            )}

            {/* Add Row Button */}
            <div className="border-t border-gray-300 p-2 bg-[#F8F9FA]">
              <button
                onClick={addRow}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                + Add Row
              </button>
            </div>
          </div>
        )}

        {/* Status Bar - Excel Style */}
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
    </div>
  );
}
