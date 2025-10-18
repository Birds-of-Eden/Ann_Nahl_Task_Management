"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, UserRound, Search, Calendar } from "lucide-react";
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
  } | null;
  onSuccess?: () => void;
}

export default function ContentWritingModal({
  open,
  onOpenChange,
  task,
  onSuccess,
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

    setIsSubmitting(true);
    try {
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
      const taskUpdateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: completedAt.toISOString(),
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName:
              (user as any)?.name || (user as any)?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Content submitted by data entry",
            contentSections: formattedContent,
            doneByAgentId: doneBy || undefined,
          },
        }),
      });

      if (!taskUpdateResponse.ok) {
        const errorData = await taskUpdateResponse.json();
        throw new Error(errorData?.error || "Failed to update task");
      }

      // 3) Auto-approve with note including selected agent (if any)
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
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col rounded-2xl border bg-white/80 backdrop-blur-sm">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <Save className="h-5 w-5 text-white" />
            </div>
            Submit Content:{" "}
            <span className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg text-white">
              {task?.name}
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm pt-1">
            Create and organize your guest posting content. Add multiple
            sections and format your text as needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <Tabs
            value={activeSection}
            onValueChange={setActiveSection}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <TabsList className="flex-wrap h-auto p-1 bg-gray-100">
                {contentSections.map((section, index) => (
                  <div key={section.id} className="flex items-center">
                    <TabsTrigger
                      value={section.id}
                      className="relative px-3 py-2 text-sm data-[state=active]:bg-white"
                    >
                      <Input
                        value={section.title}
                        onChange={(e) =>
                          updateSectionTitle(section.id, e.target.value)
                        }
                        className="h-6 text-sm border-none p-0 bg-transparent focus:bg-white px-1 -mx-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TabsTrigger>
                    {contentSections.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContentSection(section.id)}
                        className="h-4 w-4 p-0 ml-1 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
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
                className="flex items-center gap-2 bg-gradient-to-br from-blue-500 to-purple-600 hover:opacity-90 rounded-xl h-11 font-semibold shadow-sm text-white hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
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
                    height={400}
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>

          {/* Agent and Date Section in a final Fieldset */}
          <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1 mb-1">
                <UserRound className="h-4 w-4 text-blue-600" />
                Done by (agent) *
              </legend>
              <Select
                value={doneBy}
                onValueChange={(value) => {
                  setDoneBy(value);
                  setLastUsedAgent(value);
                }}
              >
                <SelectTrigger className="rounded-xl h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500/50 text-base">
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

            <div className="space-y-2">
              <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1 mb-1">
                <Calendar className="h-4 w-4 text-purple-600" />
                Completed At *
              </legend>
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm h-11 focus:border-purple-500 focus:ring-purple-500/50 transition-all"
                maxDate={new Date()}
              />
            </div>
          </fieldset>

          <div className="pt-4 border-t mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={closeModal}
              className="rounded-xl h-11"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitContentWriting}
              disabled={isSubmitting}
              className="ml-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 rounded-xl h-11 font-semibold shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Submitting..." : "Submit Content"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
