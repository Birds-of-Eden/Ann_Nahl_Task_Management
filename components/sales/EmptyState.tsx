import { Search } from "lucide-react";

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-sm ring-1 ring-slate-100">
        <Search className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-2 text-xs text-slate-500 max-w-sm">{hint}</p>}
    </div>
  );
}
