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
  } | null;
  clientId?: string;
  onSuccess?: () => void;
}

export default function ReviewRemovalModal({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
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

    setIsSubmitting(true);
    try {
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
      const updateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: toLocalMiddayISOString(completedAt),
          reviewRemovalLinks: links,
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName:
              (user as any)?.name || (user as any)?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Review removal submitted",
            doneByAgentId: doneBy || undefined,
          },
        }),
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col rounded-2xl border bg-white/80 backdrop-blur-sm">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <div className="bg-gradient-to-br from-red-500 to-orange-600 p-2 rounded-lg">
              <LinkIcon className="h-5 w-5 text-white" />
            </div>
            Submit Review Removal:{" "}
            <span className="bg-gradient-to-br from-red-500 to-orange-600 p-2 rounded-lg text-white">
              {task?.name}
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm pt-1">
            Add multiple links related to review removal and assign agent with
            completion date.
          </DialogDescription>
        </DialogHeader>

        {/* Links Input */}
        <div className="space-y-3 flex-1 overflow-y-auto pt-2 pb-4">
          {links.map((link, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="url"
                placeholder={`Enter link #${index + 1}`}
                value={link}
                onChange={(e) => updateLink(index, e.target.value)}
                className="flex-1 rounded-xl h-11 border-gray-300"
              />
              {links.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLink(index)}
                  className="h-11 w-11 rounded-xl hover:bg-red-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            type="button"
            onClick={addLink}
            variant="outline"
            size="sm"
            className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-br from-red-500 to-orange-600 hover:opacity-90 text-white hover:text-white rounded-xl h-11"
          >
            <Plus className="h-4 w-4" />
            Add Another Link
          </Button>
        </div>

        {/* Agent and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t mt-4">
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

        <DialogFooter className="pt-4 border-t mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={closeModal}
            className="rounded-xl h-11"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submitReviewRemoval}
            disabled={isSubmitting}
            className="ml-2 bg-gradient-to-r from-red-500 to-orange-600 hover:opacity-90 rounded-xl h-11 font-semibold shadow-sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit Review Removal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
