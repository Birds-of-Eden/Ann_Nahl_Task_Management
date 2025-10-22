"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, Calendar, PenTool, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";
import JoditEditorComponent from "@/components/JoditEditor";
import "react-datepicker/dist/react-datepicker.css";

export type ContentSection = {
  id: string;
  title: string;
  content: string;
  type: "paragraph" | "heading1" | "heading2" | "list";
};

interface ContentWritingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    name: string;
    category?: { id: string; name: string } | null;
    dueDate?: string | null;
    idealDurationMinutes?: number | null;
  } | null;
  timerState?: any; // Timer data from TaskTimer
  pausedTimer?: any; // Paused timer data
  formatTimerDisplay?: (seconds: number) => string; // Format function
  resetModal: () => void;
  submit: () => void;
}

export default function ContentWritingModal({
  open,
  onOpenChange,
  task,
  timerState,
  pausedTimer,
  formatTimerDisplay,
  resetModal,
  submit,
}: ContentWritingModalProps) {
  const { user } = useUserSession();
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);

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

  // Initialize with 1 section when modal opens
  useEffect(() => {
    if (open && contentSections.length === 0) {
      setContentSections([
        {
          id: "1",
          title: "Introduction",
          content: "",
          type: "paragraph",
        },
      ]);
      setActiveSection("1");
    }
  }, [open, contentSections.length]);

  const addContentSection = () => {
    const newId = Date.now().toString();
    const newSection: ContentSection = {
      id: newId,
      title: `Section ${contentSections.length + 1}`,
      content: "",
      type: "paragraph",
    };
    setContentSections([...contentSections, newSection]);
    setActiveSection(newId);
  };

  const removeContentSection = (id: string) => {
    if (contentSections.length <= 1) return;

    const newSections = contentSections.filter((section) => section.id !== id);
    setContentSections(newSections);

    if (activeSection === id) {
      setActiveSection(newSections[0]?.id || "");
    }
  };

  const updateSectionContent = (id: string, content: string) => {
    setContentSections((sections) =>
      sections.map((section) =>
        section.id === id ? { ...section, content } : section
      )
    );
  };

  const updateSectionTitle = (id: string, title: string) => {
    setContentSections((sections) =>
      sections.map((section) =>
        section.id === id ? { ...section, title } : section
      )
    );
  };

  const submitContentWriting = async () => {
    if (!task || !user?.id) return;

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

      const formattedContent = contentSections.map((section) => ({
        title: section.title,
        type: section.type,
        content: section.content,
      }));

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
            contentWriting: formattedContent,
          },
             }),
           });
           if (!updateResponse.ok) throw new Error("Failed to update task");
     
           // Now trigger parent submission flow to stop timer and update local state
           await Promise.resolve(submit());
     
           toast.success("Content writing submitted successfully!");
           resetModal();
         } catch (err: any) {
           console.error(err);
           toast.error(err?.message || "Failed to submit content writing");
         } finally {
           setIsSubmitting(false);
         }
       };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetModal()}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col rounded-3xl border-0 bg-white shadow-2xl overflow-hidden">
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 -m-6 mb-6 px-8 py-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <PenTool className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Submit Content Writing
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
              Create and organize guest posting content. Add sections and format your text. This task will be auto-approved upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-6 flex-1 overflow-y-auto">
          <Tabs
            value={activeSection}
            onValueChange={setActiveSection}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <TabsList className="flex-wrap h-auto p-2 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl shadow-inner">
                {contentSections.map((section, index) => (
                  <div key={section.id} className="flex items-center gap-1 bg-white rounded-xl shadow-sm px-2 py-1">
                    <TabsTrigger
                      value={section.id}
                      className="relative px-3 py-2 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white rounded-xl transition-all"
                    >
                      <Input
                        value={section.title}
                        onChange={(e) =>
                          updateSectionTitle(section.id, e.target.value)
                        }
                        className="h-6 text-sm border-none p-0 bg-transparent focus:ring-0 focus-visible:ring-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TabsTrigger>
                    {contentSections.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContentSection(section.id)}
                        className="h-7 w-7 rounded-full hover:bg-red-100 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </TabsList>

              <Button
                type="button"
                onClick={addContentSection}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 via-violet-500 to-blue-500 hover:from-purple-600 hover:via-violet-600 hover:to-blue-600 text-white hover:text-white rounded-2xl h-12 font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all border-0"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </Button>
            </div>

            <div className="flex-1 flex flex-col border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {contentSections.map((section) => (
                <TabsContent
                  key={section.id}
                  value={section.id}
                  className="flex-1 flex flex-col m-0 data-[state=active]:flex"
                >
                  <JoditEditorComponent
                    initialValue={section.content}
                    onContentChange={(content) =>
                      updateSectionContent(section.id, content)
                    }
                    height={380}
                    placeholder="Write compelling content for this section..."
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>
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
            onClick={submitContentWriting}
            className="ml-2 bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 hover:from-purple-700 hover:via-violet-700 hover:to-blue-700 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit Content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
