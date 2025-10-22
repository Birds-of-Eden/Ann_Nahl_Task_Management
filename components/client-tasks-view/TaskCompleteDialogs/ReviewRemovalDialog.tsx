"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Save,
  UserRound,
  Search,
  Calendar,
  Link as LinkIcon,
  Star,
  X,
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

interface ReviewRemovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    name: string;
    dueDate?: string | null;
    idealDurationMinutes?: number | null;
  } | null;
  clientId?: string;
  onSuccess?: () => void;
  timerState?: any; // Timer data from TaskTimer
  pausedTimer?: any; // Paused timer data
  formatTimerDisplay?: (seconds: number) => string; // Format function
}

export default function ReviewRemovalModal({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
  timerState,
  pausedTimer,
  formatTimerDisplay,
}: ReviewRemovalModalProps) {
  const { user } = useUserSession();
  const [links, setLinks] = useState<string[]>([""]);
  const [agents, setAgents] = useState<
    Array<{ id: string; name?: string | null; email?: string | null }>
  >([]);
  const [doneBy, setDoneBy] = useState<string>("");
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toLocalMiddayISOString = (d: Date) => {
    const local = new Date(d);
    local.setHours(12, 0, 0, 0);
    return local.toISOString();
  };

  // Load agents on open
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetch(`/api/users?role=agent&limit=200`, {
          cache: "no-store",
        });
        const json = await res.json();
        const list = (json?.users ?? json?.data ?? [])
          .filter((u: any) => u?.role?.name?.toLowerCase() === "agent")
          .map((u: any) => ({
            id: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
          }));
        setAgents(list);
      } catch (err) {
        console.error("Failed to load agents", err);
      }
    };
    if (open) loadAgents();
  }, [open]);

  // Calculate timer information from TaskTimer data
  const calculateTimerInfo = () => {
    if (!task?.idealDurationMinutes) return null;

    const total = task.idealDurationMinutes * 60;
    const isActive = timerState?.taskId === task.id;
    const isPausedHere = !isActive && pausedTimer?.taskId === task.id && !pausedTimer?.isRunning;

    let elapsedSeconds = 0;
    let remainingSeconds = total;
    let displayTime = total;

    if (isActive && timerState) {
      remainingSeconds = timerState.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      displayTime = Math.abs(remainingSeconds);
    } else if (isPausedHere && pausedTimer) {
      remainingSeconds = pausedTimer.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      displayTime = Math.abs(remainingSeconds);
    }

    return {
      elapsedSeconds,
      formatDisplayTime: formatTimerDisplay ? formatTimerDisplay(displayTime) : `${Math.floor(displayTime / 60)}:${(displayTime % 60).toString().padStart(2, '0')}`
    };
  };

  const timerInfo = calculateTimerInfo();

  const addLink = () => setLinks([...links, ""]);
  const removeLink = (index: number) => {
    if (links.length === 1) return;
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
  };
  const updateLink = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const closeModal = () => {
    setLinks([""]);
    setDoneBy("");
    setCompletedAt(null);
    onOpenChange(false);
  };

  const submitReviewRemoval = async () => {
    if (!task || !user?.id) return;
    if (!completedAt) {
      toast.error("Please select a completion date");
      return;
    }
    if (completedAt.getTime() > Date.now()) {
      toast.error("Completion date cannot be in the future");
      return;
    }
    if (links.some((l) => !l.trim())) {
      toast.error("Please fill all link fields");
      return;
    }
    if (!doneBy) {
      toast.error("Please select an agent");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate actual duration and performance rating if timer is available
      let actualDurationMinutes: number | undefined;
      let performanceRating: "Excellent" | "Good" | "Average" | "Poor" | "Lazy" = "Average";

      if (timerInfo && task?.idealDurationMinutes) {
        const total = task.idealDurationMinutes * 60;
        const isActive = timerState?.taskId === task.id;
        const isPausedHere = !isActive && pausedTimer?.taskId === task.id && !pausedTimer?.isRunning;

        let elapsedSeconds = 0;
        if (isActive && timerState) {
          elapsedSeconds = Math.max(0, total - timerState.remainingSeconds);
        } else if (isPausedHere && pausedTimer) {
          elapsedSeconds = Math.max(0, total - pausedTimer.remainingSeconds);
        }

        actualDurationMinutes = Math.ceil(elapsedSeconds / 60);

        // Calculate performance rating based on time ratio
        if (actualDurationMinutes > 0) {
          const ratio = actualDurationMinutes / task.idealDurationMinutes;
          if (ratio <= 1.2) performanceRating = "Excellent";
          else if (ratio <= 1.5) performanceRating = "Good";
          else if (ratio <= 2.0) performanceRating = "Average";
          else if (ratio <= 3.0) performanceRating = "Poor";
          else performanceRating = "Lazy";
        }
      }

      // 1) Mark task as completed without setting completionLink (should remain null)
      const completionResponse = await fetch(`/api/tasks/agents/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          status: "completed",
        }),
      });
      if (!completionResponse.ok)
        throw new Error("Failed to submit review removal data");

      // 2) Update task details
      const updateData: any = {
        status: "completed",
        completedAt: toLocalMiddayISOString(completedAt),
        taskCompletionJson: {
          reviewRemoval: links,
        },
        dataEntryReport: {
          completedByUserId: user.id,
          completedByName:
            (user as any)?.name || (user as any)?.email || user.id,
          completedBy: new Date().toISOString(),
          status: "Review removal submitted",
          doneByAgentId: doneBy || undefined,
        },
      };

      // Add performance data if calculated
      if (actualDurationMinutes !== undefined) {
        updateData.actualDurationMinutes = actualDurationMinutes;
        updateData.performanceRating = performanceRating;
      }

      const updateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!updateResponse.ok) throw new Error("Failed to update task");

      // 3) Assign actual performer if provided
      if (doneBy && clientId) {
        const distBody = {
          clientId,
          assignments: [
            {
              taskId: task.id,
              agentId: doneBy,
              note: "Reassigned to actual performer (review removal)",
              dueDate: task.dueDate,
            },
          ],
        };
        const distRes = await fetch(`/api/tasks/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(distBody),
        });
        if (!distRes.ok) throw new Error("Failed to reassign agent");
      }

      // 4) Approve the task
      const approveRes = await fetch(`/api/tasks/${task.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performanceRating: "Good",
          notes: doneBy ? `Done by agent: ${doneBy}` : undefined,
        }),
      });
      if (!approveRes.ok) throw new Error("Failed to approve task");

      toast.success("Review removal submitted successfully!");
      closeModal();
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit review removal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col rounded-3xl border-0 bg-white shadow-2xl overflow-hidden">
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-red-500 via-pink-500 to-orange-500 -m-6 mb-6 px-8 py-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <Star className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Submit Review Removal
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
              Add review removal links and assign agent. This task will be auto-approved upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Timer Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-xl">
                  <Calendar className="h-5 w-5 text-white" />
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
                  {timerInfo ? `${Math.floor(timerInfo.elapsedSeconds / 60)}:${(timerInfo.elapsedSeconds % 60).toString().padStart(2, '0')}` : "00:00"}
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  {timerInfo ? Math.ceil(timerInfo.elapsedSeconds / 60) : 0} minutes
                </div>
              </div>
            </div>
          </div>

          {/* Links Input Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-red-100 p-2 rounded-lg">
                <LinkIcon className="h-4 w-4 text-red-600" />
              </div>
              Review Removal Links *
            </label>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder={`https://example.com/review-${index + 1}`}
                    value={link}
                    onChange={(e) => updateLink(index, e.target.value)}
                    className="flex-1 rounded-2xl h-14 border-2 border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all text-base font-medium px-5"
                  />
                  {links.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(index)}
                      className="h-14 w-14 rounded-2xl hover:bg-red-100 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={addLink}
              variant="outline"
              size="sm"
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 via-pink-500 to-orange-500 hover:from-red-600 hover:via-pink-600 hover:to-orange-600 text-white hover:text-white rounded-2xl h-12 font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all border-0"
            >
              <Plus className="h-5 w-5" />
              Add Another Link
            </Button>
          </div>

          {/* Agent and Date Section - Modern Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <UserRound className="h-4 w-4 text-blue-600" />
                </div>
                Done by (Agent) *
              </label>
              <Select value={doneBy} onValueChange={setDoneBy}>
                <SelectTrigger className="rounded-2xl h-14 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-base font-medium">
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 shadow-lg p-3 w-[300px]">
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        placeholder="Search agents by name..."
                        className="pl-12 h-12 text-base border-2 border-white"
                        value={agentSearchTerm}
                        onChange={(e) => setAgentSearchTerm(e.target.value)}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.currentTarget.focus();
                        }}
                      />
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
                    {agents
                      .filter((a) =>
                        !agentSearchTerm
                          ? true
                          : (a.name || "")
                              .toLowerCase()
                              .includes(agentSearchTerm.toLowerCase())
                      )
                      .sort((a, b) => {
                        if (a.id === doneBy) return -1;
                        if (b.id === doneBy) return 1;
                        return 0;
                      })
                      .map((a) => (
                        <SelectItem
                          key={a.id}
                          value={a.id}
                          className="rounded-lg py-2 px-2 my-1 hover:bg-gray-100 focus:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center gap-4 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div
                              className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                                a.id === doneBy ? "bg-blue-500" : "bg-green-500"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              {a.name || "Unnamed Agent"}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-purple-600" />
                </div>
                Completed At *
              </label>
              <DatePicker
                selected={completedAt}
                onChange={(d) => setCompletedAt(d)}
                dateFormat="MMMM d, yyyy"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                placeholderText="Select completion date"
                className="w-full border-2 border-slate-200 rounded-2xl px-5 py-2 text-base h-14 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all font-medium"
                maxDate={new Date()}
              />
            </div>
          </div>
        </div>

        {/* Footer with Modern Button Design */}
        <DialogFooter className="pt-8 border-t-2 border-slate-100 px-6 pb-6 gap-4">
          <Button
            variant="outline"
            onClick={closeModal}
            className="rounded-2xl h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white hover:text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-8"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={submitReviewRemoval}
            disabled={isSubmitting || !doneBy || !completedAt}
            className="ml-2 bg-gradient-to-r from-red-500 via-pink-500 to-orange-500 hover:from-red-600 hover:via-pink-600 hover:to-orange-600 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Submitting..." : `Submit Review Removal (${timerInfo?.formatDisplayTime || "00:00"})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
