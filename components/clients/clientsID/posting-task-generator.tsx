// components/clients/clientsID/posting-task-generator.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Rocket, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";

interface PostingTaskGeneratorProps {
  taskId: string;
  taskName: string;
  assetName: string;
  assignmentId: string;
  clientName: string;
  defaultFrequency?: number;
  isClientOverride?: boolean;
  onSuccess?: () => void;
}

export function PostingTaskGenerator({
  taskId,
  taskName,
  assetName,
  assignmentId,
  clientName,
  defaultFrequency = 4,
  isClientOverride = false,
  onSuccess,
}: PostingTaskGeneratorProps) {
  const { user } = useUserSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frequency, setFrequency] = useState(defaultFrequency);
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [preview, setPreview] = useState<any>(null);

  // Generate preview when settings change
  const generatePreview = () => {
    const tasks = [];
    const now = startDate;
    const daysInPeriod = period === "monthly" ? 30 : 7;
    const daysOffset = Math.floor(daysInPeriod / frequency);

    for (let i = 0; i < frequency; i++) {
      const dueDate = new Date(now);
      dueDate.setDate(now.getDate() + daysOffset * i);
      tasks.push({
        name: `${assetName} - Posting ${i + 1}/${frequency}`,
        dueDate: format(dueDate, "MMM dd, yyyy"),
      });
    }

    setPreview(tasks);
  };

  // Generate preview when dialog opens or settings change
  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      generatePreview();
    }
  };

  // Update preview when settings change
  const handleFrequencyChange = (value: string) => {
    setFrequency(parseInt(value));
    setTimeout(generatePreview, 100);
  };

  const handlePeriodChange = (value: "monthly" | "weekly") => {
    setPeriod(value);
    setTimeout(generatePreview, 100);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      setTimeout(generatePreview, 100);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/trigger-posting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-actor-id": user?.id || "",
        },
        body: JSON.stringify({
          frequency,
          period,
          startDate: startDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${data.postingTasks?.length || frequency} posting tasks created successfully!`);
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(data.message || "Failed to generate posting tasks");
      }
    } catch (error) {
      console.error("Error generating posting tasks:", error);
      toast.error("An error occurred while generating posting tasks");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => handleOpen(true)}
        className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
      >
        <Rocket className="h-4 w-4" />
        Generate Posting Tasks
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-blue-500" />
              Generate Posting Tasks
            </DialogTitle>
            <DialogDescription>
              Create posting tasks for <span className="font-semibold">{assetName}</span> in{" "}
              <span className="font-semibold">{clientName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Settings Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Task Generation Settings
              </h4>

              {/* Frequency */}
              <div className="space-y-2">
                <Label htmlFor="frequency">
                  Posting Frequency {isClientOverride && <span className="text-blue-500">⚡ Client Override</span>}
                </Label>
                <Input
                  id="frequency"
                  type="number"
                  min="1"
                  max="30"
                  value={frequency}
                  onChange={(e) => handleFrequencyChange(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-slate-500">Number of posting tasks to create (1-30)</p>
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger id="period" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Tasks will be spread across {period === "monthly" ? "30 days" : "7 days"}
                </p>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={handleStartDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-slate-500">First posting task due date</p>
              </div>
            </div>

            {/* Preview Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Preview ({preview?.length || 0} tasks)
              </h4>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900 max-h-64 overflow-y-auto">
                {preview && preview.length > 0 ? (
                  <div className="space-y-2">
                    {preview.map((task: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-sm font-medium">{task.name}</span>
                        </div>
                        <span className="text-xs text-slate-500">Due: {task.dueDate}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Adjust settings to see preview
                  </p>
                )}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Important Notes
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                  <li>This action cannot be undone</li>
                  <li>Tasks will be created immediately</li>
                  <li>All tasks will be in "pending" status</li>
                  <li>Activity will be logged</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={loading || !preview || preview.length === 0}
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Generating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Generate {frequency} Tasks
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
