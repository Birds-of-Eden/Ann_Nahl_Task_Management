"use client";
import * as React from "react";
import { useState, useMemo } from "react";

export type TaskHistoryRow = {
  id: string;
  name: string;
  clientName: string;
  status: string;
  date: string; // ISO
  performanceRating: string | number | null; // ← raw value from API
  idealDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  qcTotalScore: number | null; // QC total score (0–100)
};

// --- Utility Functions (Keep as is, they are well-written) ---

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMinutes(m: number | null | undefined) {
  if (m == null) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function diffBadge(actual: number | null | undefined, ideal: number | null | undefined) {
  if (actual == null || ideal == null) return <span className="text-gray-400">—</span>;
  const delta = actual - ideal;
  const abs = Math.abs(delta);
  // Changed '−' to '-' for standard character consistency, though '−' is correct minus sign.
  const label = `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${formatMinutes(abs)}`;
  // Updated badge classes for a slightly cleaner look
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums";
  if (delta > 0) {
    return <span className={`${base} bg-red-100 text-red-700 border border-red-200`}>{label}</span>;
  }
  if (delta < 0) {
    return <span className={`${base} bg-green-100 text-green-700 border border-green-200`}>{label}</span>;
  }
  return <span className={`${base} bg-blue-50 text-blue-700 border border-blue-200`}>On Time</span>;
}

// QC score bar (0–100) - Improved visual design
function qcScoreBar(score: number | null) {
  if (score == null) return <span className="text-gray-400">—</span>;
  const val = Math.max(0, Math.min(100, score));
  // More subtle color gradient based on score
  let colorClass = "bg-amber-500";
  if (val >= 90) colorClass = "bg-green-600"; // Higher threshold for green
  else if (val >= 70) colorClass = "bg-green-400";
  else if (val >= 40) colorClass = "bg-amber-500";
  else colorClass = "bg-red-500";

  return (
    <div className="flex items-center gap-3 min-w-[140px]">
      {/* Bar style update: slightly thicker, softer background */}
      <div className="relative h-2.5 w-28 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-2.5 rounded-full ${colorClass} transition-all duration-500`}
          style={{ width: `${val}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-700 font-semibold w-10 text-right">
        {val.toFixed(0)}%
      </span>
    </div>
  );
}

// --- Component ---

export default function TaskHistory({ rows }: { rows: TaskHistoryRow[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("qc_approved,completed");
  const [taskNameFilter, setTaskNameFilter] = useState<string>("");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("today");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(true);

  // Unique statuses for filter options
  const statusOptions = useMemo(() => {
    // Include all unique statuses from the data, even if they aren't in the default filter
    const statuses = Array.from(new Set(rows.map(row => row.status)));
    return statuses.map(status => ({
      value: status,
      label: status.replaceAll("_", " "),
      count: rows.filter(row => row.status === status).length
    })).sort((a, b) => b.count - a.count); // Sort by count descending
  }, [rows]);

  // Date ranges - Keep logic, maybe add 'all' to getDateRange structure for cleaner access
  const getDateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const lastYear = new Date(today);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    return {
      today: { start: today, end: tomorrow },
      lastWeek: { start: lastWeek, end: tomorrow },
      lastMonth: { start: lastMonth, end: tomorrow },
      lastYear: { start: lastYear, end: tomorrow },
      all: { start: new Date(0), end: new Date(8640000000000000) } // Min Date to Max Date
    };
  }, []);

  // Active filters?
  const areFiltersActive = useMemo(() => {
    return (
      taskNameFilter !== "" ||
      statusFilter !== "qc_approved,completed" ||
      dateRangeFilter !== "today"
    );
  }, [taskNameFilter, statusFilter, dateRangeFilter]);

  const clearAllFilters = () => {
    setTaskNameFilter("");
    setStatusFilter("qc_approved,completed");
    setDateRangeFilter("today");
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    let filtered = rows;

    if (statusFilter) {
      const statuses = statusFilter.split(',');
      // Only filter if statusFilter isn't empty string (which means 'All Statuses' was selected, which we'll map to empty string or handle differently if needed. Here, we check against default/non-empty)
      if (statusFilter.length > 0) {
        filtered = filtered.filter(row => statuses.includes(row.status));
      }
    }

    if (taskNameFilter) {
      const searchTerm = taskNameFilter.toLowerCase();
      filtered = filtered.filter(row =>
        row.name.toLowerCase().includes(searchTerm)
      );
    }

    if (dateRangeFilter && dateRangeFilter !== "all") {
      const range = getDateRange[dateRangeFilter as keyof typeof getDateRange];
      if (range) {
        filtered = filtered.filter(row => {
          const rowDate = new Date(row.date);
          return rowDate >= range.start && rowDate < range.end;
        });
      }
    } else if (dateRangeFilter === "all") {
        // If 'all' is selected, no date filtering is applied based on the above logic.
    }


    return filtered;
  }, [rows, statusFilter, taskNameFilter, dateRangeFilter, getDateRange]);

  // Stats - Enhanced logic for averages
  const total = filteredRows.length;

  // Avg QC Total Score
  const qcScores = filteredRows.filter(r => r.qcTotalScore != null);
  const avgQc = qcScores.length
    ? qcScores.reduce((s, r) => s + (r.qcTotalScore || 0), 0) / qcScores.length
    : null; // Use null for no data, not 0, for better display logic

  const ideals = filteredRows.filter(r => r.idealDurationMinutes != null);
  const avgIdeal = ideals.length ?
    ideals.reduce((s, r) => s + (r.idealDurationMinutes || 0), 0) / ideals.length : null;

  const actuals = filteredRows.filter(r => r.actualDurationMinutes != null);
  const avgActual = actuals.length ?
    actuals.reduce((s, r) => s + (r.actualDurationMinutes || 0), 0) / actuals.length : null;

  const efficiency = (avgIdeal !== null && avgActual !== null && avgActual > 0) ?
    Math.min(100, (avgIdeal / avgActual) * 100) : 0;

  const formatRangeDisplay = (range: string) => {
    switch(range) {
      case 'today':
        return 'Today';
      case 'lastWeek':
        return 'Last 7 Days';
      case 'lastMonth':
        return 'Last 30 Days';
      case 'lastYear':
        return 'Last Year';
      case 'all':
        return 'All Time';
      default:
        return range;
    }
  };

  // --- Render ---
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans">
      {/* Header */}
      <header className="mb-8 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Task History</h1>
            <p className="text-sm text-gray-500 mt-1">
              Analyzing task performance across selected criteria.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {areFiltersActive && (
              <button
                onClick={clearAllFilters}
                className="flex items-center text-sm font-medium text-gray-600 hover:text-red-600 px-3 py-2 rounded-lg border border-gray-300 hover:border-red-300 bg-white shadow-sm transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear All
              </button>
            )}

            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-300 ${
                isFilterOpen
                  ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>
      </header>



      {/* Filter Panel - More defined card style */}
      {isFilterOpen && (
        <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-5 border-b pb-3">
            Refine Data View
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Task Name Search */}
            <div>
              <label htmlFor="taskNameFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Task Name Keywords
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  id="taskNameFilter"
                  value={taskNameFilter}
                  onChange={(e) => setTaskNameFilter(e.target.value)}
                  placeholder="e.g., 'Facebook Task'"
                  className="block w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                {taskNameFilter && (
                  <button
                    onClick={() => setTaskNameFilter("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter - Enhanced dropdown look */}
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Status Selection
              </label>
              <div className="relative">
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white shadow-sm transition-colors cursor-pointer"
                >
                  <option value="qc_approved,completed">Default: QC Approved & Completed</option>
                  <option value="qc_approved">QC Approved Only</option>
                  <option value="completed">Completed Only</option>
                  <option value="">All Statuses</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Date Range Filter - Use modern icons */}
            <div>
              <label htmlFor="dateRangeFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Time Period
              </label>
              <div className="relative">
                <select
                  id="dateRangeFilter"
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white shadow-sm transition-colors cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="lastWeek">Last 7 Days</option>
                  <option value="lastMonth">Last 30 Days</option>
                  <option value="lastYear">Last Year</option>
                  <option value="all">All Time</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters Badges - Cleaner look with subtle colors */}
          {areFiltersActive && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Active Filters</h4>
              <div className="flex flex-wrap gap-2">
                {taskNameFilter && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors">
                    Task: {taskNameFilter}
                    <button
                      onClick={() => setTaskNameFilter("")}
                      className="ml-2 rounded-full flex-shrink-0 flex items-center justify-center text-indigo-400 hover:bg-indigo-200 hover:text-indigo-600 focus:outline-none transition-colors"
                    >
                      <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                        <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                      </svg>
                    </button>
                  </span>
                )}

                {statusFilter.split(',').filter(s => s).map(status => {
                  const statusLabel = statusOptions.find(opt => opt.value === status)?.label || status;
                  return (
                    <span key={status} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 transition-colors">
                      Status: {statusLabel.replaceAll("_", " ")}
                      <button
                        onClick={() => {
                          const newStatuses = statusFilter.split(',').filter(s => s !== status);
                          setStatusFilter(newStatuses.join(','));
                        }}
                        className="ml-2 rounded-full flex-shrink-0 flex items-center justify-center text-purple-400 hover:bg-purple-200 hover:text-purple-600 focus:outline-none transition-colors"
                      >
                        <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                          <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                        </svg>
                      </button>
                    </span>
                  );
                })}

                {dateRangeFilter && dateRangeFilter !== "today" && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 transition-colors">
                    Time: {formatRangeDisplay(dateRangeFilter)}
                    <button
                      onClick={() => setDateRangeFilter("today")}
                      className="ml-2 rounded-full flex-shrink-0 flex items-center justify-center text-amber-400 hover:bg-amber-200 hover:text-amber-600 focus:outline-none transition-colors"
                    >
                      <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                        <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards - Use a clean card elevation */}
      <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center">
            <div className="rounded-xl bg-indigo-100 p-3 mr-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{total}</p>
            </div>
          </div>
        </div>

        {/* Avg QC Score */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center">
            <div className="rounded-xl bg-amber-100 p-3 mr-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Avg. QC Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {avgQc !== null ? avgQc.toFixed(1) : "N/A"}
                <span className="text-sm font-normal text-gray-400 ml-1">/100</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center">
            <div className="rounded-xl bg-purple-100 p-3 mr-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Avg. Time (Actual)</p>
              <p className="text-2xl font-bold text-gray-900">
                {avgActual !== null ? formatMinutes(Math.round(avgActual)) : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center">
            <div className="rounded-xl bg-green-100 p-3 mr-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Efficiency Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {efficiency.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table - Minimalist and clear */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-xl">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-[25%]">
                Task & Client
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider hidden sm:table-cell w-[15%]">
                Client
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-[10%]">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell w-[12%]">
                Completion Date
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider w-[8%]">
                Ideal
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider w-[8%]">
                Actual
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-[10%]">
                Time Δ
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-[15%]">
                QC Score
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-[10%]">
                Perf. Rating
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-14 h-14 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-600">No Tasks Match Your Criteria</p>
                    <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or clear them to view all data.</p>
                    {areFiltersActive && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 p-2 bg-indigo-50 rounded-md transition-colors"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors duration-150">
                  {/* Task & Client */}
                  <td className="px-6 py-3">
                    <div className="font-semibold text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 sm:hidden">{r.clientName}</div>
                  </td>
                  {/* Client (Desktop) */}
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                    {r.clientName}
                  </td>
                  {/* Status */}
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${
                      r.status === 'qc_approved'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : r.status === 'completed'
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {r.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  {/* Date (Desktop) */}
                  <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">
                    {formatDate(r.date)}
                  </td>
                  {/* Ideal Duration */}
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right tabular-nums">
                    {formatMinutes(r.idealDurationMinutes ?? null)}
                  </td>
                  {/* Actual Duration */}
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right tabular-nums">
                    {formatMinutes(r.actualDurationMinutes ?? null)}
                  </td>
                  {/* Time Delta */}
                  <td className="px-6 py-3 text-center">
                    {diffBadge(r.actualDurationMinutes, r.idealDurationMinutes)}
                  </td>
                  {/* QC Score */}
                  <td className="px-6 py-3">
                    {qcScoreBar(r.qcTotalScore ?? null)}
                  </td>
                  {/* Performance Rating (Raw) */}
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">
                    {r.performanceRating ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Info Bar */}
      <div className="mt-3 flex justify-between items-center text-xs text-gray-500 px-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-medium text-gray-600">Time Delta Key:</span>
          <span className="text-green-700 font-medium">− Time Saved</span>
          <span className="text-red-700 font-medium">/ Overdue</span>
        </div>
        <div>
          Displaying <strong className="text-gray-700">{filteredRows.length}</strong> of <span className="font-medium">{rows.length}</span> tasks.
        </div>
      </div>
    </div>
  );
}