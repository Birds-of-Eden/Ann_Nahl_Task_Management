

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Agent, Task } from "./distribution-types";

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTasks: Task[];
  agents: Agent[];
  onReassign: (taskIds: string[], newAgentId: string, dueDate?: Date) => Promise<void>;
}

export function ReassignModal({
  isOpen,
  onClose,
  selectedTasks,
  agents,
  onReassign,
}: ReassignModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedAgentId) {
      toast.warning("⚠️ Please select an agent");
      return;
    }

    if (selectedTasks.length === 0) {
      toast.warning("⚠️ No tasks selected");
      return;
    }

    setIsSubmitting(true);
    try {
      const taskIds = selectedTasks.map((task) => task.id);
      await onReassign(taskIds, selectedAgentId, dueDate);
      toast.success(`✅ Successfully reassigned ${selectedTasks.length} tasks`);
      onClose();
      // Reset form
      setSelectedAgentId("");
      setDueDate(undefined);
    } catch (error) {
      console.error("Error reassigning tasks:", error);
      toast.error("❌ Failed to reassign tasks");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSelectedAgentId("");
      setDueDate(undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            🔄 Reassign Tasks
          </DialogTitle>
          <DialogDescription>
            Reassign {selectedTasks.length} selected task{selectedTasks.length !== 1 ? 's' : ''} to a new agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected Tasks Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-3">
              📋 Selected Tasks ({selectedTasks.length})
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between bg-white rounded-md p-2 border border-blue-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        className={`text-xs ${
                          task.priority === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : task.priority === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : task.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        {task.dueDate && format(new Date(task.dueDate), 'MMM dd')}
                      </span>
                    </div>
                  </div>
                  {task.assignedTo && (
                    <div className="flex items-center gap-2 ml-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assignedTo.image} />
                        <AvatarFallback className="text-xs">
                          {task.assignedTo.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-600">
                        {task.assignedTo.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agent Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Select New Agent
            </label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Choose an agent to reassign tasks to..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={agent.image} />
                        <AvatarFallback>
                          {agent.name?.charAt(0) || "A"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        <p className="text-xs text-gray-600 capitalize">
                          {agent.category} Team
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date Selection
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-900">
              New Due Date (Optional)
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-12"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a new due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  fromDate={new Date()}
                  toDate={undefined}
                  showOutsideDays={true}
                  fixedWeeks={false}
                />
              </PopoverContent>
            </Popover>
          </div> */}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedAgentId || isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Reassigning...
                </>
              ) : (
                <>
                  🔄 Reassign {selectedTasks.length} Task{selectedTasks.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
