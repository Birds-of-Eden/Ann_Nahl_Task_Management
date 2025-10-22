"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Upload,
  X,
  Type,
  FileDown,
  Calendar,
  ClipboardPlus,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";
import JoditEditorComponent from "@/components/JoditEditor";

interface SummaryReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any | null;
  clientId: string;
  onSuccess: () => void;
  submit: () => void;
  resetModal: () => void;
  timerState?: any; // Timer data from TaskTimer
  pausedTimer?: any; // Paused timer data
  formatTimerDisplay?: (seconds: number) => string; // Format function
}

const SummaryReportModal: React.FC<SummaryReportModalProps> = ({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
  submit,
  resetModal,
  timerState,
  pausedTimer,
  formatTimerDisplay,
}) => {
  const [title, setTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUserSession();

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

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!task?.id || !user?.id) {
      toast.error("Missing task or user");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate actual duration and performance rating
      const actualDurationMinutes = timerInfo
        ? Math.ceil(timerInfo.elapsedSeconds / 60)
        : 0;

      let performanceRating:
        | "Excellent"
        | "Good"
        | "Average"
        | "Poor"
        | "Lazy" = "Average";
      if (timerInfo && task?.idealDurationMinutes) {
        const ratio = actualDurationMinutes / task.idealDurationMinutes;

        if (ratio <= 1.2)
          performanceRating = "Excellent"; // Within 20% of ideal
        else if (ratio <= 1.5)
          performanceRating = "Good"; // Within 50% of ideal
        else if (ratio <= 2.0)
          performanceRating = "Average"; // Within 100% of ideal
        else if (ratio <= 3.0)
          performanceRating = "Poor"; // 100-200% over ideal
        else performanceRating = "Lazy"; // More than 200% over ideal
      }

      // Update task details with backlinking data (saved in Task.taskCompletionJson)
      const updateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          // Persist timing/performance fields
          completedAt: new Date().toISOString(),
          idealDurationMinutes: task?.idealDurationMinutes ?? undefined,
          actualDurationMinutes,
          performanceRating,
          taskCompletionJson: {
            title: title.trim(),
            text,
            pdfFileName: pdfFile?.name ?? null,
            clientId,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      if (!updateResponse.ok) throw new Error("Failed to update task");

      // Now trigger parent submission flow to stop timer and update local state
      await Promise.resolve(submit());

      toast.success("Summary Report submitted successfully!");
      resetModal();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit summary report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col rounded-3xl border-0 bg-white shadow-2xl overflow-hidden">
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 -m-6 mb-6 px-8 py-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <ClipboardPlus className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Create Summary Report
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-black text-xl truncate flex-1">
                    {task?.name}
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                    <Calendar className="h-4 w-4 text-white/80" />
                    <span className="text-white font-mono font-bold text-sm">
                      {timerInfo?.formatDisplayTime || "00:00"}
                    </span>
                  </div>
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-16 font-medium">
              Add a title, upload your report PDF, and provide a summary. This
              task will be auto-approved upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-6 flex-1 overflow-y-auto">
          {/* Title Input */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-green-100 p-2 rounded-lg">
                <Type className="h-4 w-4 text-green-600" />
              </div>
              Report Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title for your summary report"
              className="rounded-2xl h-14 border-2 border-green-500 focus:border-green-500 focus:ring-4 focus:ring-green-500 transition-all text-base font-medium px-5"
            />
          </div>

          {/* PDF Upload */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <FileDown className="h-4 w-4 text-emerald-600" />
              </div>
              Upload PDF File (Optional)
            </label>
            <label
              htmlFor="pdf-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl py-8 cursor-pointer hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 hover:border-green-400 transition-all group"
            >
              <Upload className="h-8 w-8 text-slate-400 group-hover:text-green-600 mb-3 transition-colors" />
              {pdfFile ? (
                <div className="text-center">
                  <span className="font-bold text-green-700 text-lg">
                    {pdfFile.name}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Click to change file
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-slate-600 font-semibold">
                    Click to upload PDF
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    or drag and drop your file here
                  </p>
                </div>
              )}
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={(e) =>
                  setPdfFile(e.target.files?.[0] ? e.target.files[0] : null)
                }
                className="hidden"
              />
            </label>
          </div>

          {/* Rich Text Editor */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-teal-100 p-2 rounded-lg">
                <FileText className="h-4 w-4 text-teal-600" />
              </div>
              Summary Text *
            </label>
            <div className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <JoditEditorComponent
                initialValue={text}
                onContentChange={(content: any) => setText(content)}
                height={350}
                placeholder="Write a detailed summary of the report..."
              />
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
            onClick={handleSubmit}
            className="ml-2 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SummaryReportModal;
