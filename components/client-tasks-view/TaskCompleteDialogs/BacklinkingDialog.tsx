"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Package,
  X,
  ListOrdered,
  Link as LinkIcon,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";

interface BacklinkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    name: string;
    dueDate?: string | null;
    idealDurationMinutes?: number | null;
  } | null;
  clientId?: string;
  timerState?: any; // Timer data from TaskTimer
  pausedTimer?: any; // Paused timer data
  formatTimerDisplay?: (seconds: number) => string; // Format function
  resetModal: () => void;
  submit: () => void;
  isSimpleTask: (task: any) => boolean;
}

export default function BacklinkingModal({
  open,
  onOpenChange,
  task,
  clientId,
  timerState,
  pausedTimer,
  formatTimerDisplay,
  resetModal,
  submit,
  isSimpleTask,
}: BacklinkingModalProps) {
  const { user } = useUserSession();
  const [links, setLinks] = useState<string[]>([""]);
  const [orderDate, setOrderDate] = useState<Date | null>(null);
  const [month, setMonth] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dripPeriod, setDripPeriod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate timer information from TaskTimer data
  const calculateTimerInfo = () => {
    if (!task?.idealDurationMinutes) return null;

    const total = task.idealDurationMinutes * 60;
    const isActive = timerState?.taskId === task.id;
    const isPausedHere =
      !isActive && pausedTimer?.taskId === task.id && !pausedTimer?.isRunning;

    let elapsedSeconds = 0;
    let remainingSeconds = total;
    let progress = 0;
    let isRunning = false;
    let isOvertime = false;
    let displayTime = total;

    if (isActive && timerState) {
      isRunning = timerState.isRunning;
      remainingSeconds = timerState.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      progress = (elapsedSeconds / total) * 100;
      displayTime = Math.abs(remainingSeconds);
      isOvertime = remainingSeconds <= 0;
    } else if (isPausedHere && pausedTimer) {
      remainingSeconds = pausedTimer.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      progress = (elapsedSeconds / total) * 100;
      displayTime = Math.abs(remainingSeconds);
      isOvertime = remainingSeconds <= 0;
    }

    return {
      elapsedSeconds,
      remainingSeconds,
      totalSeconds: total,
      progress,
      isRunning,
      isOvertime,
      displayTime,
      formatElapsedTime: formatTimerDisplay
        ? formatTimerDisplay(elapsedSeconds)
        : `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60)
            .toString()
            .padStart(2, "0")}`,
      formatDisplayTime: formatTimerDisplay
        ? formatTimerDisplay(displayTime)
        : `${Math.floor(displayTime / 60)}:${(displayTime % 60)
            .toString()
            .padStart(2, "0")}`,
    };
  };

  const timerInfo = calculateTimerInfo();

  const toLocalMiddayISOString = (d: Date) => {
    const local = new Date(d);
    local.setHours(12, 0, 0, 0); // normalize to local midday to avoid UTC date shifting
    return local.toISOString();
  };

  const submitBacklinking = async () => {
    if (!task || !user?.id) {
      toast.error("Missing task or user");
      return;
    }
    if (!orderDate) {
      toast.error("Please select an order date");
      return;
    }
    if (orderDate.getTime() > Date.now()) {
      toast.error("Order date cannot be in the future");
      return;
    }
    if (!month || !quantity || !dripPeriod.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    if (links.some((l) => !l.trim())) {
      toast.error("Please fill all link fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Update task details with backlinking data (saved in Task.taskCompletionJson)
      const updateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          taskCompletionJson: {
            backlinkingLinks: links,
            orderDate: toLocalMiddayISOString(orderDate),
            month,
            quantity: parseInt(quantity),
            dripPeriod,
          },
        }),
      });
      if (!updateResponse.ok) throw new Error("Failed to update task");

      toast.success("Backlinking submitted successfully!");
      resetModal();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit backlinking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col rounded-3xl border-0 bg-white shadow-2xl overflow-auto">
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 -m-6 mb-6 px-8 py-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <LinkIcon className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Submit Backlinking
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-black text-xl truncate flex-1">
                    {task?.name}
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                    <Clock className="h-4 w-4 text-white/80" />
                    <span className="text-white font-mono font-bold text-sm">
                      {timerInfo?.formatDisplayTime || "00:00"}
                    </span>
                  </div>
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-16 font-medium">
              Add backlink URLs and provide order details. This task will be
              auto-approved upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Timer Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-xl">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
                    Time Tracking
                  </h3>
                  <p className="text-xs text-blue-600 font-medium">
                    Time spent on this completion
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-black text-blue-700">
                  {timerInfo?.formatElapsedTime || "00:00"}
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  {timerInfo ? Math.ceil(timerInfo.elapsedSeconds / 60) : 0}{" "}
                  minutes
                </div>
              </div>
            </div>
          </div>
          {/* Backlinks Textarea Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-orange-100 p-2 rounded-lg">
                <LinkIcon className="h-4 w-4 text-orange-600" />
              </div>
              Backlink URLs *
            </label>
            <textarea
              placeholder="Paste your comma-separated or newline-separated backlink URLs here...&#10;Example:&#10;https://example.com/link1&#10;https://example.com/link2"
              value={links.join(", ")}
              onChange={(e) => {
                const pastedLinks = e.target.value
                  .split(/[\n,]+/)
                  .map((link) => link.trim())
                  .filter((link) => link.length > 0)
                  .map((link) => {
                    if (!/^https?:\/\//i.test(link)) {
                      return "https://" + link;
                    }
                    return link;
                  });
                setLinks(pastedLinks);
              }}
              className="w-full rounded-2xl border-2 border-slate-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 p-4 min-h-[180px] resize-y text-base font-medium transition-all"
              rows={8}
            />
            <p className="text-xs text-slate-600 font-medium">
              💡 Tip: Paste multiple URLs separated by commas or new lines.
              We'll automatically format them.
            </p>
          </div>

          {/* Backlinking Details - Premium Design */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-3xl p-6 space-y-5 shadow-inner">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-amber-500 p-2 rounded-xl">
                <Package className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                Order Details
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Order Date */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Order Date *
                </label>
                <DatePicker
                  selected={orderDate}
                  onChange={(d) => setOrderDate(d)}
                  dateFormat="MMMM d, yyyy"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  placeholderText="Select order date"
                  className="w-full border-2 border-amber-200 rounded-2xl px-5 py-2 text-base h-14 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 bg-white transition-all font-medium"
                  maxDate={new Date()}
                />
              </div>

              {/* Month Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Month Selection *
                </label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="rounded-2xl h-14 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 text-base font-medium">
                    <SelectValue placeholder="Select month..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["M1", "M2", "M3", "M4"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Quantity *
                </label>
                <Select value={quantity} onValueChange={setQuantity}>
                  <SelectTrigger className="rounded-2xl h-14 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 text-base font-medium">
                    <SelectValue placeholder="Select quantity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["200", "500", "1000"].map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Drip Period */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Drip Period *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 30 days"
                  value={dripPeriod}
                  onChange={(e) => setDripPeriod(e.target.value)}
                  className="rounded-2xl h-14 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all text-base font-medium px-5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Modern Button Design */}
        <DialogFooter className="pt-8 border-t-2 border-slate-100 px-6 pb-6 gap-4">
          <Button
            variant="outline"
            onClick={resetModal}
            className="rounded-2xl h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white hover:text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-8"
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            className="ml-2 bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
            onClick={submitBacklinking}
            disabled={isSubmitting}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            {isSubmitting
              ? "Submitting..."
              : `Submit Completion (${
                  timerInfo?.formatDisplayTime || "00:00"
                })`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
