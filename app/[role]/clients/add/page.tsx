// app/[role]/clients/add/page.tsx
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  UserPlus2,
  Users,
  ArrowRight,
  GalleryVerticalEnd,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Choice = "new" | "existing" | "";

export default function AddClientAskPage() {
  const router = useRouter();
  const { role } = useParams() as { role: string };
  const base = `/${role}`;

  const [choice, setChoice] = React.useState<Choice>("");

  const goNext = React.useCallback(() => {
    if (choice === "new") router.push(`${base}/clients/onboarding`);
    if (choice === "existing") router.push(`${base}/clients/select-existing`);
  }, [choice, router, base]);

  // Shortcuts: N = New, E = Existing, Enter = Continue
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "n") setChoice("new");
      if (k === "e") setChoice("existing");
      if (e.key === "Enter" && choice) goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choice, goNext]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-50 via-white to-indigo-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-3xl"
      >
        {/* Brand/Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 shadow-lg">
            <GalleryVerticalEnd className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900">
              Add Client
            </h1>
            <p className="text-sm text-muted-foreground">
              Answer a quick question so we can take you to the right flow.
            </p>
          </div>
        </div>

        {/* The professional question */}
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
                  Please choose one option below — we’ll direct you instantly to
                  the right flow.
                </p>

                {/* Answer chips (no CTA yet) */}
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

                {/* Reveal the single relevant action AFTER user answers */}
                <AnimatePresence initial={false} mode="wait">
                  {choice && (
                    <motion.div
                      key={choice}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="mt-6"
                    >
                      <Separator className="mb-6" />
                      {choice === "new" ? (
                        <ActionCard
                          title="New client onboarding"
                          description="Create a fresh record and start the guided onboarding."
                          cta="Start Onboarding"
                          onContinue={goNext}
                          tone="cyan"
                          Icon={UserPlus2}
                        />
                      ) : (
                        <ActionCard
                          title="Existing Client Onboarding"
                          description="Pick from the current client list to proceed."
                          cta="Select From List"
                          onContinue={goNext}
                          tone="emerald"
                          Icon={Users}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Keyboard hint */}
                <div className="mt-6 text-xs text-muted-foreground">
                  Tips: press <Kbd>N</Kbd> for New, <Kbd>E</Kbd> for Existing,
                  then <Kbd>Enter</Kbd> to continue.
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

function ActionCard({
  title,
  description,
  cta,
  onContinue,
  tone,
  Icon,
}: {
  title: string;
  description: string;
  cta: string;
  onContinue: () => void;
  tone: "cyan" | "emerald";
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const iconWrap =
    tone === "cyan"
      ? "bg-cyan-50 text-cyan-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <div className="rounded-xl border border-gray-200/70 bg-white/80 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-3 ${iconWrap}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <Button onClick={onContinue}>
          {cta}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-semibold">
      {children}
    </kbd>
  );
}
