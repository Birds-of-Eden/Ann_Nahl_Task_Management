"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Target, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";

interface CreateTasksButtonProps {
  clientId: string;
  disabled?: boolean;
  onTaskCreationComplete?: () => void;
}

export default function CreateTasksButton({ 
  clientId, 
  disabled = false,
  onTaskCreationComplete 
}: CreateTasksButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { user, status } = useAuth();

  const createTasks = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/tasks/create-dataentry-posting-tasks/auto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create tasks");
      }

      const createdTasks: Array<{ id: string; dueDate?: string | null }> = Array.isArray(data?.tasks) ? data.tasks : [];
      const createdCount = Number(data?.created ?? createdTasks.length);

      // Try auto-assign to the current session user
      try {
        if (createdTasks.length === 0) {
          toast.success("Tasks already existed or none created. No assignment needed.");
        } else if (status !== "authenticated" || !user?.id) {
          toast.warning("Tasks created, but no authenticated user found to assign.");
        } else {
          const assignments = createdTasks.map((t) => ({
            taskId: t.id,
            agentId: user.id,
            note: "Auto-assigned to session user after posting creation",
            dueDate:
              t?.dueDate && typeof t.dueDate === "string"
                ? t.dueDate
                : (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    return d.toISOString();
                  })(),
          }));

          const distRes = await fetch(`/api/tasks/dataentry-distribute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, assignments }),
          });

          if (distRes.ok) {
            toast.success(`Created ${createdCount} posting task(s) and assigned to you`);
          } else {
            const dj = await distRes.json().catch(() => ({}));
            console.error("Distribute failed", dj);
            toast.warning(`Created ${createdCount} posting task(s), but auto-assignment failed`);
          }
        }
      } catch (assignErr) {
        console.error(assignErr);
        toast.warning("Tasks created, but auto-assignment to session user failed");
      }

      if (!createdCount) {
        // If nothing new was created, still show a friendly message
        toast.info(data?.message || "No new posting tasks to create (already exists)");
      }

      // Only hide (reload) if tasks were actually created successfully
      if (createdCount > 0) {
        if (onTaskCreationComplete) {
          onTaskCreationComplete();
        }
        // Refresh the page to show updated status and hide the button thereafter
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Error creating tasks:", error);
      toast.error(error.message || "Failed to create tasks");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      onClick={createTasks}
      disabled={isCreating || disabled}
      className={` bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white h-11 flex-1 rounded-xl font-semibold transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={disabled ? 'Tasks already created' : 'Create posting tasks for this client'}
    >
      {isCreating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Creating Tasks...
        </>
      ) : (
        <>
          <Target className="h-4 w-4 mr-2" />
          Create Tasks
        </>
      )}
    </Button>
  );
}

