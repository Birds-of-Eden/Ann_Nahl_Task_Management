"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Upload,
  X,
  CheckCircle2,
  Type,
  FileDown,
  UserRound,
  Search,
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
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@radix-ui/react-tabs";
import JoditEditorComponent from "../JoditEditor";
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

interface SummaryReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any | null;
  clientId: string;
  onSuccess: () => void;
}

const SummaryReportModal: React.FC<SummaryReportModalProps> = ({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
}) => {
  const [title, setTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<
    Array<{ id: string; name?: string | null; email?: string | null }>
  >([]);
  const [doneBy, setDoneBy] = useState<string>("");
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const { user } = useUserSession();

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
          .map((u: any) => ({ id: u.id, name: u.name ?? null, email: u.email ?? null }));
        setAgents(list);
      } catch (err) {
        console.error("Failed to load agents", err);
      }
    };
    if (open) loadAgents();
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!task?.id || !user?.id) {
      toast.error("Missing task or user");
      return;
    }
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

    setSubmitting(true);
    try {
      // 1) Mark completed for the agent
      const r1 = await fetch(`/api/tasks/agents/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status: "completed" }),
      });
      if (!r1.ok) throw new Error("Failed to mark task completed");

      // 2) Update task with summaryReport and dataEntryReport
      const r2 = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: toLocalMiddayISOString(completedAt),
          summaryReport: {
            title: title.trim(),
            text,
            pdfFileName: pdfFile?.name ?? null,
            clientId,
            updatedAt: new Date().toISOString(),
          },
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName: (user as any)?.name || (user as any)?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Summary report submitted",
            doneByAgentId: doneBy || undefined,
          },
        }),
      });
      if (!r2.ok) throw new Error("Failed to update task with summary report");

      // 3) Optional reassign to actual performer
      if (doneBy && clientId) {
        const distBody = {
          clientId,
          assignments: [
            { taskId: task.id, agentId: doneBy, note: "Reassigned to actual performer (summary report)", dueDate: task?.dueDate },
          ],
        } as any;
        const rDist = await fetch(`/api/tasks/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(distBody),
        });
        if (!rDist.ok) throw new Error("Failed to reassign agent");
      }

      // 4) Approve
      const r3 = await fetch(`/api/tasks/${task.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ performanceRating: "Good", notes: doneBy ? `Done by agent: ${doneBy}` : undefined }),
      });
      if (!r3.ok) throw new Error("Failed to approve task");

      toast.success("Summary report submitted successfully");
      onSuccess();
      setTitle("");
      setPdfFile(null);
      setText("");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to submit summary report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col rounded-3xl border-0 bg-white shadow-2xl overflow-hidden">
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
                <div className="text-white font-black text-xl truncate">
                  {task?.name}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-16 font-medium">
              Add a title, upload your report PDF, and provide a summary. This task will be auto-approved upon submission.
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
                  <p className="text-xs text-slate-500 mt-1">Click to change file</p>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-slate-600 font-semibold">Click to upload PDF</span>
                  <p className="text-xs text-slate-500 mt-1">or drag and drop your file here</p>
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
                onContentChange={(content) => setText(content)}
                height={350}
                placeholder="Write a detailed summary of the report..."
              />
            </div>
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
            onClick={() => onOpenChange(false)}
            className="rounded-2xl h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white hover:text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-8"
            disabled={submitting}
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !doneBy || !completedAt}
            className="ml-2 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
          >
            <Save className="h-5 w-5 mr-2" />
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SummaryReportModal;
