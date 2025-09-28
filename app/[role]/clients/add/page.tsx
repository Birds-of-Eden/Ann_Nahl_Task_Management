// app/[role]/clients/add/page.tsx
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  UserPlus2,
  Users,
  HelpCircle,
  ArrowRight,
  Shield,
  GalleryVerticalEnd,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

type Choice = "new" | "existing";

export default function AddClientDecisionPage() {
  const router = useRouter();
  const params = useParams() as { role: string };
  const base = `/${params.role}`;

  const [choice, setChoice] = React.useState<Choice | "">("");

  const goNext = React.useCallback(() => {
    if (choice === "new") router.push(`${base}/clients/onboarding`);
    if (choice === "existing") router.push(`${base}/clients/select-existing`);
  }, [choice, router, base]);

  // keyboard shortcuts: Y = new, E = existing, Enter = continue
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "y") setChoice("new");
      if (e.key.toLowerCase() === "e") setChoice("existing");
      if (e.key === "Enter" && choice) goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choice, goNext]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-50 via-white to-indigo-50 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-3xl"
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 shadow-lg">
            <GalleryVerticalEnd className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900">
              Add Client
            </h1>
            <p className="text-sm text-muted-foreground">
              Let’s get you to the right place. Are you adding a brand new
              client or selecting someone who already exists?
            </p>
          </div>
        </div>

        <Card className="border-gray-200/70 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              <span>Choose one option to continue</span>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <RadioGroup
              value={choice}
              onValueChange={(v: Choice) => setChoice(v)}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              aria-label="Client add options"
            >
              {/* New Client */}
              <OptionCard
                value="new"
                selected={choice === "new"}
                title="New Client"
                subtitle="Create a fresh record and start the full onboarding flow."
                hotkeyHint="Y"
                Icon={UserPlus2}
                onPick={() => setChoice("new")}
                cta="Continue to Onboarding"
              />

              {/* Existing Client */}
              <OptionCard
                value="existing"
                selected={choice === "existing"}
                title="Existing Client"
                subtitle="Pick from clients already in the system to proceed."
                hotkeyHint="E"
                Icon={Users}
                onPick={() => setChoice("existing")}
                cta="Choose from List"
              />
            </RadioGroup>
          </CardContent>

          <CardFooter className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>
                Only users with proper permissions can create or modify clients.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                Back
              </Button>
              <Button onClick={goNext} disabled={!choice}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Small helper */}
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Tips: press <kbd className="rounded border bg-muted px-1">Y</kbd> for
          New, <kbd className="rounded border bg-muted px-1">E</kbd> for
          Existing, then{" "}
          <kbd className="rounded border bg-muted px-1">Enter</kbd> to continue.
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------- */
/* Option Card                        */
/* ---------------------------------- */

function OptionCard({
  value,
  selected,
  title,
  subtitle,
  hotkeyHint,
  Icon,
  onPick,
  cta,
}: {
  value: Choice;
  selected: boolean;
  title: string;
  subtitle: string;
  hotkeyHint: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onPick: () => void;
  cta: string;
}) {
  return (
    <motion.label
      layout
      htmlFor={`choice-${value}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={[
        "group relative flex cursor-pointer flex-col rounded-xl border p-5",
        "bg-white/80 backdrop-blur-sm transition-all",
        "hover:shadow-md",
        selected
          ? "border-cyan-300 ring-2 ring-cyan-200"
          : "border-gray-200/70",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start gap-3">
        <div
          className={[
            "rounded-lg p-3 shadow-sm",
            selected ? "bg-cyan-50 text-cyan-700" : "bg-gray-100 text-gray-700",
          ].join(" ")}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{title}</span>
            <span
              className={[
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px]",
                selected
                  ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                  : "border-gray-200 bg-gray-50 text-gray-600",
              ].join(" ")}
            >
              Shortcut: {hotkeyHint}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>
        </div>

        <RadioGroupItem
          id={`choice-${value}`}
          value={value}
          className="mt-1"
          onClick={onPick}
        />
      </div>

      <Separator className="my-4" />

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant={selected ? "default" : "outline"}
          onClick={onPick}
          className="transition"
        >
          {cta}
        </Button>
      </div>
    </motion.label>
  );
}
