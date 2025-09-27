"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Target, Loader2, Calendar, UserCheck } from "lucide-react";

interface CreateTasksButtonProps {
  clientId: string;
  disabled?: boolean;
  onTaskCreationComplete?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function CreateTasksButton({
  clientId,
  disabled = false,
  onTaskCreationComplete,
  variant = "default",
  size = "default",
}: CreateTasksButtonProps) {
  const [isCreating, setIsCreating] = useState(false);

  const createTasks = async () => {
    if (!clientId) {
      toast.error("Client ID is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/tasks/create-dataentry-posting-tasks", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message || 
          data?.error || 
          `Failed to create tasks (${response.status})`
        );
      }

      const createdCount = Number(data?.created ?? 0);
      const assigneeName = data?.assignee?.name;
      const cyclesCreated = data?.cyclesToCreate;
      const targetDate = data?.targetDate ? new Date(data.targetDate).toLocaleDateString() : null;

      if (createdCount > 0) {
        let successMessage = data?.message || `Created ${createdCount} task(s)`;
        
        if (assigneeName) {
          successMessage += ` and assigned to ${assigneeName}`;
        }
        if (cyclesCreated && targetDate) {
          successMessage += ` for ${cyclesCreated} cycle(s) up to ${targetDate}`;
        }

        toast.success(successMessage, {
          duration: 5000,
          description: targetDate ? `Tasks created until ${targetDate}` : undefined,
        });
      } else {
        toast.info(data?.message || "All tasks already exist - nothing to create.", {
          duration: 4000,
        });
      }

      onTaskCreationComplete?.();
      
      // Optional: Add a small delay before reloading to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err: any) {
      console.error("Task creation error:", err);
      
      // More specific error messages
      if (err.message.includes("qc_approved")) {
        toast.error("QC Approval Required", {
          description: "All source tasks must be QC approved before creating posting tasks",
          duration: 6000,
        });
      } else if (err.message.includes("start date")) {
        toast.error("Missing Start Date", {
          description: "Client start date is required to create tasks",
          duration: 5000,
        });
      } else if (err.message.includes("data_entry")) {
        toast.error("No Data Entry Staff", {
          description: "No data entry users available to assign tasks",
          duration: 5000,
        });
      } else {
        toast.error("Creation Failed", {
          description: err.message || "Failed to create posting tasks",
          duration: 5000,
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: "h-9 px-3 text-xs",
    default: "h-11 px-6 text-sm",
    lg: "h-12 px-8 text-base",
    icon: "h-11 w-11"
  };

  // Variant classes
  const variantClasses = {
    default: "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-xl",
    outline: "border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white",
    secondary: "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
  };

  return (
    <Button
      onClick={createTasks}
      disabled={isCreating || disabled}
      className={`
        ${sizeClasses[size]} 
        ${variantClasses[variant]}
        rounded-xl font-semibold transition-all duration-300 
        transform hover:scale-105 active:scale-95
        disabled:transform-none disabled:hover:scale-100
        flex items-center justify-center gap-2
        ${disabled ? "opacity-50 cursor-not-allowed grayscale" : ""}
        ${size === "icon" ? "flex-col" : ""}
      `}
      title={
        disabled 
          ? "Tasks already created or client not ready" 
          : "Create posting tasks from start date to today/due date"
      }
    >
      {isCreating ? (
        <>
          <Loader2 className={`${size === "icon" ? "h-5 w-5" : "h-4 w-4"} animate-spin`} />
          {size !== "icon" && (
            <span>{size === "sm" ? "Creating..." : "Creating Tasks..."}</span>
          )}
        </>
      ) : (
        <>
          {variant === "outline" ? (
            <Calendar className={size === "icon" ? "h-5 w-5" : "h-4 w-4"} />
          ) : (
            <Target className={size === "icon" ? "h-5 w-5" : "h-4 w-4"} />
          )}
          {size !== "icon" && (
            <span className="flex items-center gap-1">
              {size === "sm" ? "Create Tasks" : "Create Posting Tasks"}
              <UserCheck className="h-3 w-3 opacity-80" />
            </span>
          )}
        </>
      )}
    </Button>
  );
}