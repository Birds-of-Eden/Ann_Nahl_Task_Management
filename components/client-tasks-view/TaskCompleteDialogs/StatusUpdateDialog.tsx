"use client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, CheckCircle } from "lucide-react";

interface StatusUpdateDialogProps {
  isOpen: boolean;
  onOpenChange: (b: boolean) => void;
  selectedTasks: string[];
  isUpdating: boolean;
  handleUpdateSelectedTasks: (action: "completed" | "pending" | "reassigned") => void;
}

export default function StatusUpdateDialog({
  isOpen,
  onOpenChange,
  selectedTasks,
  isUpdating,
  handleUpdateSelectedTasks,
}: StatusUpdateDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-50">
            Update Task Status
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            You have selected {selectedTasks.length} task
            {selectedTasks.length !== 1 ? "s" : ""}. Choose the status to
            apply to all selected tasks.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="flex-1"
          >
            Cancel
          </Button>

          <Button
            onClick={() => handleUpdateSelectedTasks("pending")}
            disabled={isUpdating}
            variant="secondary"
            className="flex-1"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Clock className="w-4 h-4 mr-2" />
            )}
            Mark as Pending
          </Button>

          <Button
            onClick={() => handleUpdateSelectedTasks("completed")}
            disabled={isUpdating}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Mark as Completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
