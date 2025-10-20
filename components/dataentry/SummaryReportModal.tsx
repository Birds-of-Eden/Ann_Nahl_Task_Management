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
      <DialogContent className="max-w-[80vw] max-h-[80vh] overflow-y-auto rounded-2xl border bg-white/80 backdrop-blur-md">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-600" />
            Create Summary Report
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm">
            Add a title, upload your report PDF, and provide a short summary
            text.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Title Input */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1">
              <Type className="h-4 w-4 text-indigo-500" />
              Report Title *
            </legend>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter report title"
              className="rounded-xl h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/50 transition-all"
            />
          </fieldset>

          {/* PDF Upload */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1">
              <FileDown className="h-4 w-4 text-green-600" />
              Upload PDF File
            </legend>
            <label
              htmlFor="pdf-upload"
              className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-6 cursor-pointer hover:bg-gray-50 transition-all"
            >
              <Upload className="h-5 w-5 text-gray-500 mr-2" />
              {pdfFile ? (
                <span className="font-medium text-gray-800">
                  {pdfFile.name}
                </span>
              ) : (
                <span className="text-gray-500">Click to upload PDF</span>
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
          </fieldset>

          {/* Textarea */}
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            <JoditEditorComponent
              initialValue={text}
              onContentChange={(content) => setText(content)}
              height={400}
            />
          </div>

          {/* Agent Selection */}
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t mt-4">
            <div className="space-y-2">
              <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1 mb-1">
                <UserRound className="h-4 w-4 text-blue-600" />
                Done by (agent) *
              </legend>
              <Select value={doneBy} onValueChange={setDoneBy}>
                <SelectTrigger className="rounded-xl h-12 border-gray-300 text-base">
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
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name || "Unnamed Agent"}
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
                onChange={(d) => setCompletedAt(d)}
                dateFormat="MMMM d, yyyy"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                placeholderText="Select completion date"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm h-11 focus:border-purple-500 focus:ring-purple-500/50"
                maxDate={new Date()}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-11 bg-red-500 hover:bg-red-600 text-white font-medium transition-all"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !doneBy}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 rounded-xl h-11 font-semibold text-white shadow-sm transition-all"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SummaryReportModal;
