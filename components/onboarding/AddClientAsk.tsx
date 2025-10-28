"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  UserPlus2,
  Users,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client } from "@/types/client";

type Choice = "new" | "existing" | "";

export function AddClientAskPage() {
  const router = useRouter();
  const { role } = useParams() as { role: string };
  const base = `/${role}`;

  const [choice, setChoice] = React.useState<Choice>("");
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const goNew = React.useCallback(
    () => router.push(`${base}/clients/onboarding?new=true`),
    [base, router]
  );

  const handlePickClient = React.useCallback(
    (c: Client) => {
      // Navigate to onboarding with existing client data
      const clientData = encodeURIComponent(JSON.stringify({
        id: c.id,
        name: c.name,
        company: c.company,
        designation: c.designation,
        location: c.location,
        websites: c.websites,
        biography: c.biography,
        companywebsite: c.companywebsite,
        companyaddress: c.companyaddress,
        email: c.email,
        phone: c.phone,
        birthdate: c.birthdate,
        status: c.status,
        packageId: c.packageId,
        socialLinks: c.socialLinks,
        imageDrivelink: c.imageDrivelink,
        amId: c.amId,
        startDate: c.startDate,
        dueDate: c.dueDate,
      }));

      router.push(`${base}/clients/onboarding?existing=true&clientData=${clientData}`);
    },
    [router, base]
  );

  // When the user chooses "existing", fetch the list once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (choice !== "existing") return;
      setLoading(true);
      try {
        const r = await fetch("/api/clients", { cache: "no-store" });
        const data: Client[] = await r.json();
        if (!cancelled) setClients(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [choice]);

  const filtered = React.useMemo(() => {
    let filteredClients = clients;

    // Apply status filter
    if (statusFilter !== "all") {
      filteredClients = filteredClients.filter((c) => c.status === statusFilter);
    }

    // Apply search filter
    const s = q.trim().toLowerCase();
    if (!s) return filteredClients;

    return filteredClients.filter((c) =>
      [c.name, c.company, c.designation, c.email, c.package?.name, c.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [clients, q, statusFilter]);

  // Shortcuts: N = New, E = Existing
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "n") setChoice("new");
      if (k === "e") setChoice("existing");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-100" />

      <div className="relative z-10 py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-5xl px-4"
      >
        {/* Question Card */}
        <Card className="border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
          <CardContent className="p-8 md:p-12">
            <div className="space-y-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-3">
                    <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 leading-tight">
                      Manage client onboarding with confidence
                    </h1>
                    <p className="text-sm md:text-base text-slate-600 max-w-2xl">
                      Decide whether you’re creating a fresh client profile or continuing an existing engagement. We’ll guide you directly to the correct workflow.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-medium text-slate-700">How would you like to proceed?</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AnswerChip
                    label="New client"
                    hotkey="N"
                    active={choice === "new"}
                    color="cyan"
                    Icon={UserPlus2}
                    onClick={() => setChoice("new")}
                  />
                  <AnswerChip
                    label="Existing client"
                    hotkey="E"
                    active={choice === "existing"}
                    color="emerald"
                    Icon={Users}
                    onClick={() => setChoice("existing")}
                  />
                </div>
              </div>

              <AnimatePresence initial={false} mode="popLayout">
                {choice === "new" && (
                  <motion.div
                    key="new-cta"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Separator className="mb-8" />
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-7 shadow-sm">
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm">
                            <UserPlus2 className="h-6 w-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-lg font-semibold text-slate-900">
                              New client onboarding
                            </p>
                            <p className="text-sm text-slate-600">
                              Create a fresh profile and move through the guided onboarding journey.
                            </p>
                          </div>
                        </div>
                        <Button onClick={goNew} className="bg-slate-900 text-white shadow-sm hover:bg-slate-950">
                          Start Onboarding
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {choice === "existing" && (
                  <motion.div
                    key="existing-inline"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Separator className="mb-8" />
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-7 shadow-sm space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-semibold text-slate-900">
                            Continue with an existing client
                          </p>
                          <p className="text-sm text-slate-600">
                            Search your roster and select the client whose onboarding you’d like to resume.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by name, company, email…"
                            className="h-11 rounded-xl border-slate-200 pl-9 focus:border-emerald-500 focus:ring-emerald-100"
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 md:w-44">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {loading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                        </div>
                      ) : filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
                          No clients match your filters.
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {filtered.slice(0, 20).map((c) => (
                            <li
                              key={c.id}
                              className="flex flex-col gap-3 p-4 transition-colors duration-150 hover:bg-emerald-50/60 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-medium text-slate-900">
                                    {c.name}
                                  </p>
                                  {c.status && (
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        c.status === "active"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : c.status === "inactive"
                                            ? "bg-rose-50 text-rose-700"
                                            : "bg-amber-50 text-amber-700"
                                      }`}
                                    >
                                      {c.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 truncate">
                                  {c.company ?? "—"} • {c.email ?? "—"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {c.package?.name && (
                                  <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                    {c.package.name}
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => handlePickClient(c)}
                                  className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                >
                                  Select Client
                                  <ArrowRight className="ml-1.5 h-4 w-4" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-xs text-slate-500">
                        Showing up to 20 results. Refine your search to narrow the list.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <span className="font-medium">Keyboard shortcuts:</span>
                <Kbd>N</Kbd> for New, <Kbd>E</Kbd> for Existing.
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </div>
  );
}

/* ---------- Pieces ---------- */

function AnswerChip({
  label,
  hotkey,
  active,
  color,
  Icon,
  onClick,
}: {
  label: string;
  hotkey: string;
  active: boolean;
  color: "cyan" | "emerald";
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
}) {
  const base =
    "flex items-center justify-between rounded-2xl border bg-white px-5 py-4 text-left transition-all duration-150 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2";
  const activeCls =
    color === "cyan"
      ? "border-violet-400 shadow-lg ring-2 ring-violet-200"
      : "border-emerald-400 shadow-lg ring-2 ring-emerald-200";
  const inactiveCls = "border-slate-200 hover:border-slate-300";
  const iconWrap =
    color === "cyan"
      ? "bg-violet-500"
      : "bg-emerald-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? activeCls : inactiveCls}`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ${iconWrap}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">Press {hotkey} to select</p>
        </div>
      </div>
      <Kbd>{hotkey}</Kbd>
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-lg border-2 border-gray-300 bg-white px-2.5 py-1 text-xs font-bold shadow-sm">
      {children}
    </kbd>
  );
}
