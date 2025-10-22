"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, UserRound, Search, Calendar, PenTool, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DatePicker from "react-datepicker";
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
  clientId?: string;
  onSuccess?: () => void;
  timerState?: any; // Timer data from TaskTimer
  pausedTimer?: any; // Paused timer data
  formatTimerDisplay?: (seconds: number) => string; // Format function
}

export default function ContentWritingModal({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
  timerState,
  pausedTimer,
  formatTimerDisplay,
}: ContentWritingModalProps) {
  const { user } = useUserSession();
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agents, setAgents] = useState<
    Array<{ id: string; name?: string | null; email?: string | null }>
  >([]);
  const [doneBy, setDoneBy] = useState<string>("");
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [lastUsedDate, setLastUsedDate] = useState<Date | null>(null);
  const [lastUsedAgent, setLastUsedAgent] = useState<string | null>(null);

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

  const openModal = (selectedTask: { id: string; name: string }) => {
    setContentSections([
      {
        id: "1",
        title: "Introduction",
        content: "",
        type: "paragraph",
      },
    ]);
    setActiveSection("1");
    onOpenChange(true);
  };

  const closeModal = () => {
    setContentSections([]);
    setActiveSection("");
    onOpenChange(false);
  };

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
    if (!completedAt) {
      toast.error("Please select a completion date");
      return;
    }
    if (completedAt.getTime() > Date.now()) {
      toast.error("Completed date cannot be in the future");
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

      // Format the content for submission
      const formattedContent = contentSections.map((section) => ({
        title: section.title,
        type: section.type,
        content: section.content,
      }));

      // 1) Mark task as completed with the content as completion data
      const completionResponse = await fetch(`/api/tasks/agents/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          status: "completed",
          completionLink: "", // Can be empty for content writing tasks
          content: formattedContent,
          contentType: "guest_posting",
        }),
      });

      if (!completionResponse.ok) {
        const errorData = await completionResponse.json();
        throw new Error(
          errorData?.message || errorData?.error || "Failed to submit content"
        );
      }

      // 2) Update task status and add data entry report
      const updateData: any = {
        status: "completed",
        completedAt: completedAt.toISOString(),
        taskCompletionJson: {
          contentWriting: formattedContent,
        },
        dataEntryReport: {
          completedByUserId: user.id,
          completedByName:
            (user as any)?.name || (user as any)?.email || user.id,
          completedBy: new Date().toISOString(),
          status: (task?.category?.name || "")
            .toLowerCase()
            .includes("guest posting")
            ? "Guest Posting Content submitted by data entry"
            : (task?.category?.name || "")
                .toLowerCase()
                .includes("content writing")
            ? "Content Writing Content submitted by data entry"
            : "Content submitted by data entry",
          doneByAgentId: doneBy || undefined,
        },
      };

      // Add performance data if calculated
      if (actualDurationMinutes !== undefined) {
        updateData.actualDurationMinutes = actualDurationMinutes;
        updateData.performanceRating = performanceRating;
      }

      const taskUpdateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      // 2.5) reassign to the selected 'doneBy' agent (if provided) so the task ownership reflects who actually did it
      if (doneBy && clientId) {
        const distBody = {
          clientId: clientId,
          assignments: [
            {
              taskId: task.id,
              agentId: doneBy,
              note: "Reassigned to actual performer by data_entry (content writing)",
              dueDate: task.dueDate, // Keep existing due date
            },
          ],
        } as any;
        const rDist = await fetch(`/api/tasks/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(distBody),
        });
        const jDist = await rDist.json();
        if (!rDist.ok)
          throw new Error(
            jDist?.error || "Failed to reassign task to selected agent"
          );
      }
      const approveRes = await fetch(`/api/tasks/${task.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performanceRating: "Good",
          notes: doneBy ? `Done by agent: ${doneBy}` : undefined,
        }),
      });
      const approveJson = await approveRes.json();
      if (!approveRes.ok)
        throw new Error(approveJson?.error || "Failed to approve task");

      // Save last used selections for faster subsequent entries
      if (doneBy) setLastUsedAgent(doneBy);
      if (completedAt) setLastUsedDate(completedAt);

      toast.success("Content submitted successfully!");
      closeModal();
      onSuccess?.();
    } catch (error: any) {
      console.error("Content submission error:", error);
      toast.error(error?.message || "Failed to submit content");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset state when modal opens with a new task
  useEffect(() => {
    if (open && task) {
      setContentSections([
        {
          id: "1",
          title: "Title",
          content: "",
          type: "paragraph",
        },
      ]);
      setActiveSection("1");
      // Initialize completion date and last used agent
      setCompletedAt(lastUsedDate || new Date());
      if (lastUsedAgent) setDoneBy(lastUsedAgent);
    }
  }, [open, task]);

  // Load agents for selection when modal opens
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetch(`/api/users?role=agent&limit=200`, {
          cache: "no-store",
        });
        const aJson = await res.json();
        const list: Array<{
          id: string;
          name?: string | null;
          email?: string | null;
        }> = (aJson?.users ?? aJson?.data ?? [])
          .filter((u: any) => u?.role?.name?.toLowerCase() === "agent")
          .map((u: any) => ({
            id: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
          }));
        setAgents(list);
      } catch (e) {
        console.error("Failed to load agents", e);
      }
    };
    if (open) loadAgents();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Agent and Date Section - Modern Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <UserRound className="h-4 w-4 text-blue-600" />
                </div>
                Done by (Agent) *
              </label>
              <Select
                value={doneBy}
                onValueChange={(value) => {
                  setDoneBy(value);
                  setLastUsedAgent(value);
                }}
              >
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
                      .filter((agent) => {
                        const search = agentSearchTerm.toLowerCase();
                        return (
                          !search ||
                          (agent.name || "").toLowerCase().includes(search)
                        );
                      })
                      .sort((a, b) => {
                        if (a.id === doneBy) return -1;
                        if (b.id === doneBy) return 1;
                        return 0;
                      })
                      .map((agent) => (
                        <SelectItem
                          key={agent.id}
                          value={agent.id}
                          className="rounded-lg py-2 px-2 my-1 hover:bg-gray-100 focus:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center gap-4 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div
                              className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                                agent.id === doneBy
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              {agent.name || "Unnamed Agent"}
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
                onChange={(date: Date | null) => {
                  const newDate = date || new Date();
                  setCompletedAt(newDate);
                  setLastUsedDate(newDate);
                }}
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
            onClick={submitContentWriting}
            disabled={isSubmitting || !doneBy || !completedAt || contentSections.length === 0}
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
