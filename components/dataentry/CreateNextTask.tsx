"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

interface CreateNextTaskProps {
  clientId: string;
  onCreated?: () => void;
}

export default function CreateNextTask({ clientId, onCreated }: CreateNextTaskProps) {
  const [isLoading, setIsLoading] = useState(false);

  const createNext = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tasks/remain-tasks-create-and-distrubution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Failed to create remaining tasks");
      }

      const createdCount = Number(json?.created ?? 0);
      const assignedToName = json?.assignedTo?.name || "the top agent";
      
      if (createdCount > 0) {
        toast.success(`${json.message} (Assigned to ${assignedToName})`);
      } else {
        toast.info(json?.message || "No remaining tasks to create.");
      }
      
      onCreated?.();
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create remaining tasks");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={createNext}
      disabled={isLoading}
      className="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white h-11 rounded-xl font-semibold"
      title="Create remaining tasks and assign to the top agent"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Creating Next...
        </>
      ) : (
        <>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Create & Assign Next Task
        </>
      )}
    </Button>
  );
}