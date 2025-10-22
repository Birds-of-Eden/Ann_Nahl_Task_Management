"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Save,
  UserRound,
  Search,
  Calendar,
  Clock,
  Package,
  X,
  ListOrdered,
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
import index from "swr";

interface BacklinkingModalProps {
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

export default function BacklinkingModal({
  open,
  onOpenChange,
  task,
  clientId,
  onSuccess,
}: BacklinkingModalProps) {
  const { user } = useUserSession();
  const [links, setLinks] = useState<string[]>([""]);
  const [agents, setAgents] = useState<
    Array<{ id: string; name?: string | null; email?: string | null }>
  >([]);
  const [doneBy, setDoneBy] = useState<string>("");
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [orderDate, setOrderDate] = useState<Date | null>(null);
  const [month, setMonth] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dripPeriod, setDripPeriod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);

  const toLocalMiddayISOString = (d: Date) => {
    const local = new Date(d);
    local.setHours(12, 0, 0, 0); // normalize to local midday to avoid UTC date shifting
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
    setOrderDate(null);
    setMonth("");
    setQuantity("");
    setDripPeriod("");
    onOpenChange(false);
  };

  const submitBacklinking = async () => {
    if (!task || !user?.id) return;
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
    if (!doneBy) {
      toast.error("Please select an agent");
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
        throw new Error("Failed to submit backlinking data");

      // 2) Update task details with backlinking data (saved in Task.backLinking)
      const updateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: completedAt
            ? toLocalMiddayISOString(completedAt)
            : toLocalMiddayISOString(new Date()),
          taskCompletionJson: {
            backlinkingLinks: links,
            orderDate: toLocalMiddayISOString(orderDate),
            month,
            quantity: parseInt(quantity),
            dripPeriod,
            doneByAgentId: doneBy || undefined,
          },
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName:
              (user as any)?.name || (user as any)?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Backlinking submitted",
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
              note: "Reassigned to actual performer (backlinking)",
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

      toast.success("Backlinking submitted successfully!");
      closeModal();
      onSuccess?.();
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
                <div className="text-white font-black text-xl truncate">
                  {task?.name}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-16 font-medium">
              Add backlink URLs and provide order details. This task will be auto-approved upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-6">
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
              💡 Tip: Paste multiple URLs separated by commas or new lines. We'll automatically format them.
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
            className="rounded-2xl h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-8"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={submitBacklinking}
            disabled={isSubmitting || !doneBy || !completedAt}
            className="ml-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit Backlinking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
