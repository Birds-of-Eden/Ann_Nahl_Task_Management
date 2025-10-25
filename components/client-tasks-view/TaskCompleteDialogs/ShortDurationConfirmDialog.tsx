"use client";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ShortDurationConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (b: boolean) => void;
  shortDurationInfo: { actual: number; ideal: number } | null;
  onReview: () => void;
  onConfirm: () => void;
}

export default function ShortDurationConfirmDialog({
  isOpen,
  onOpenChange,
  shortDurationInfo,
  onReview,
  onConfirm,
}: ShortDurationConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl border border-amber-200 dark:border-amber-800 bg-gradient-to-b from-white to-amber-50 dark:from-gray-900 dark:to-amber-950/20">
        <DialogHeader>
          <DialogTitle className="sr-only">Confirm Early Completion</DialogTitle>
          <div className="flex flex-col items-start gap-3">
            {/* 🔥 Animated Icon + Title */}
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex items-center gap-3"
            >
              <div className="mt-0.5 shrink-0 rounded-xl p-2 bg-red-200 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-indigo-300" />
              </div>
              <h3 className="text-2xl font-bold text-red-600 dark:text-indigo-200">
                Confirm Early Completion
              </h3>
            </motion.div>

            <div className="flex-1">
              <DialogDescription className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Your tracked time appears significantly lower than expected for this task.
                Do you still want to submit it as completed?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white/70 dark:bg-amber-900/10 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Ideal</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              {shortDurationInfo?.ideal ?? "--"} min
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white/70 dark:bg-amber-900/10 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">50% Threshold</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              {shortDurationInfo
                ? Math.ceil(shortDurationInfo.ideal * 0.5)
                : "--"}{" "}
              min
            </p>
          </div>
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Your Actual
            </p>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {shortDurationInfo?.actual ?? "--"} min
            </p>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {shortDurationInfo
            ? `Actual ${shortDurationInfo.actual} min is less than 50% of ideal (${Math.ceil(
                shortDurationInfo.ideal * 0.5
              )} of ${shortDurationInfo.ideal} min).`
            : "Actual time appears significantly lower than expected."}
        </div>

        <DialogFooter className="mt-5 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onReview}
          >
            Review
          </Button>
          <Button
            className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
            onClick={onConfirm}
          >
            Yes, Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
