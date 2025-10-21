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
  GalleryVerticalEnd,
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
        website: c.website,
        website2: c.website2,
        website3: c.website3,
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-violet-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-fuchsia-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-3xl"
      >
        {/* Question Card */}
        <Card className="border-violet-200/50 shadow-2xl bg-white/90 backdrop-blur-xl">
          <CardContent className="p-8 md:p-12">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-3 shadow-lg">
                <HelpCircle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xl md:text-2xl font-bold text-gray-900 leading-relaxed">
                  Would you like to{" "}
                  <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    add a new client
                  </span>{" "}
                  through onboarding, or{" "}
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    work with an existing client
                  </span>{" "}
                  already in the system?
                </p>
                <p className="mt-3 text-base text-gray-600">
                  Choose one option below — we'll direct you instantly to the
                  right flow.
                </p>

                {/* Answers */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                {/* Reveal the relevant action/section */}
                <AnimatePresence initial={false} mode="popLayout">
                  {choice === "new" && (
                    <motion.div
                      key="new-cta"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="mt-6"
                    >
                      <Separator className="mb-6" />
                      <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-xl">
                        <div className="flex items-start gap-4">
                          <div className="rounded-xl p-3 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                            <UserPlus2 className="h-7 w-7" />
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-bold text-gray-900">
                              New client onboarding
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                              Create a fresh record and start the guided
                              onboarding process.
                            </p>
                          </div>
                          <Button onClick={goNew} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg">
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
                      className="mt-6"
                    >
                      <Separator className="mb-6" />
                      <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-xl">
                        <div className="flex items-start gap-4 mb-6">
                          <div className="rounded-xl p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                            <Users className="h-7 w-7" />
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-bold text-gray-900">
                              Use an existing client
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                              Search and select a client below to continue their
                              onboarding.
                            </p>
                          </div>
                        </div>

                        {/* Search and Filter */}
                        <div className="flex gap-3 mb-5">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              placeholder="Search by name, company, email…"
                              className="pl-9 h-11 border-2 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-xl"
                            />
                          </div>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40 h-11 border-2 focus:border-emerald-500 rounded-xl">
                              <Filter className="h-4 w-4 mr-2" />
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

                        {/* List */}
                        {loading ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                          </div>
                        ) : filtered.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-lg">
                            No clients found.
                          </div>
                        ) : (
                          <ul className="divide-y divide-gray-100 rounded-xl border-2 border-gray-200 overflow-hidden bg-white shadow-sm">
                            {filtered.slice(0, 20).map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-3 p-4 hover:bg-emerald-50/50 transition-all duration-200"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 truncate">
                                      {c.name}
                                    </p>
                                    {c.status && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                        c.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                                        c.status === 'inactive' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      }`}>
                                        {c.status}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 truncate">
                                    {c.company ?? "—"} • {c.email ?? "—"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.package?.name && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50">
                                      {c.package.name}
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handlePickClient(c)}
                                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
                                  >
                                    Select Client
                                    <ArrowRight className="ml-1.5 h-4 w-4" />
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        {/* Optional hint */}
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          Showing up to 20 results. Refine your search to find
                          more.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Keyboard hint */}
                <div className="mt-8 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <span className="font-medium">💡 Keyboard shortcuts:</span>
                  <Kbd>N</Kbd> for New, <Kbd>E</Kbd> for Existing.
                </div>
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
    "flex items-center justify-between rounded-2xl border-2 p-5 bg-white backdrop-blur-sm transition-all hover:shadow-xl cursor-pointer transform hover:scale-105 duration-200";
  const activeCls =
    color === "cyan"
      ? "border-violet-400 ring-4 ring-violet-200 shadow-xl scale-105 bg-gradient-to-br from-violet-50 to-purple-50"
      : "border-emerald-400 ring-4 ring-emerald-200 shadow-xl scale-105 bg-gradient-to-br from-emerald-50 to-teal-50";
  const inactiveCls = "border-gray-200 hover:border-gray-300";
  const iconWrap =
    color === "cyan"
      ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg"
      : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? activeCls : inactiveCls}`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 ${iconWrap}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="font-bold text-gray-900 text-lg">{label}</span>
      </div>
      <div className="text-xs font-semibold text-gray-500 border-2 border-gray-300 rounded-lg px-3 py-1.5">
        {hotkey}
      </div>
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
