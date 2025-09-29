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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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

  const goNew = React.useCallback(
    () => router.push(`${base}/clients/onboarding?new=true`),
    [base, router]
  );

  const handlePickClient = React.useCallback(
    (c: Client) => {
      // keep consistent with existing details route in your app
      router.push(`/admin/clients/${c.id}`);
      // or: router.push(`${base}/clients/${c.id}`)
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
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) =>
      [c.name, c.company, c.designation, c.email, c.package?.name, c.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [clients, q]);

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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-50 via-white to-indigo-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-3xl"
      >
        {/* Question */}
        <Card className="border-gray-200/70 shadow-lg">
          <CardContent className="p-8 md:p-10">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-gray-100 p-2">
                <HelpCircle className="h-5 w-5 text-gray-700" />
              </div>
              <div className="flex-1">
                <p className="text-lg md:text-xl font-semibold text-gray-900 leading-relaxed">
                  Would you like to{" "}
                  <span className="text-cyan-700 font-bold">
                    add a new client
                  </span>{" "}
                  through onboarding, or{" "}
                  <span className="text-emerald-700 font-bold">
                    work with an existing client
                  </span>{" "}
                  already in the system?
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose one option below — we’ll direct you instantly to the
                  right flow.
                </p>

                {/* Answers (no redirect yet) */}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      <div className="rounded-xl border border-cyan-200/70 bg-white/80 p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg p-3 bg-cyan-50 text-cyan-700">
                            <UserPlus2 className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              New client onboarding
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Create a fresh record and start the guided
                              onboarding.
                            </p>
                          </div>
                          <Button onClick={goNew}>
                            Start Onboarding
                            <ArrowRight className="ml-2 h-4 w-4" />
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
                      <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-5 shadow-sm">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="rounded-lg p-3 bg-emerald-50 text-emerald-700">
                            <Users className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              Use an existing client
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Search and select a client below to view their
                              details.
                            </p>
                          </div>
                        </div>

                        {/* Search */}
                        <div className="relative mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by name, company, email…"
                            className="pl-9"
                          />
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
                          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
                            {filtered.slice(0, 20).map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 truncate">
                                    {c.name}
                                  </p>
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
                                  >
                                    View Details
                                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
                <div className="mt-6 text-xs text-muted-foreground">
                  Tips: press <Kbd>N</Kbd> for New, <Kbd>E</Kbd> for Existing.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
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
    "flex items-center justify-between rounded-xl border p-4 bg-white/80 backdrop-blur-sm transition-all hover:shadow-md cursor-pointer";
  const activeCls =
    color === "cyan"
      ? "border-cyan-300 ring-2 ring-cyan-200"
      : "border-emerald-300 ring-2 ring-emerald-200";
  const inactiveCls = "border-gray-200/70";
  const iconWrap =
    color === "cyan"
      ? "bg-cyan-50 text-cyan-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? activeCls : inactiveCls}`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${iconWrap}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <div className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
        {hotkey}
      </div>
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-semibold">
      {children}
    </kbd>
  );
}
