// components/clients/clientsID/template-customization/switch-template-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RefreshCw, Loader, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";

interface SwitchTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: any;
  currentTemplate: any;
  clientName: string;
  onSuccess?: () => void;
}

export function SwitchTemplateDialog({
  open,
  onOpenChange,
  assignment,
  currentTemplate,
  clientName,
  onSuccess,
}: SwitchTemplateDialogProps) {
  const { user } = useUserSession();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      const data = await response.json();
      
      if (response.ok) {
        setTemplates(data.filter((t: any) => t.id !== currentTemplate.id));
      }
    } catch (error) {
      toast.error("Failed to load templates");
    }
  };

  const handleSwitch = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/assignments/${assignment.id}/sync-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-actor-id": user?.id || "",
          },
          body: JSON.stringify({
            newTemplateId: selectedTemplateId,
            idempotencyKey: `switch-${assignment.id}-${Date.now()}`,
          }),
        }
      );

      if (response.ok) {
        onSuccess?.();
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to switch template");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            Switch Template for {clientName}
          </DialogTitle>
          <DialogDescription>
            Choose a new template. Settings will be preserved for common assets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">Current</p>
            <p className="font-semibold">{currentTemplate.name}</p>
          </div>

          <RadioGroup value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg cursor-pointer ${
                    selectedTemplateId === template.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <RadioGroupItem value={template.id} id={template.id} className="sr-only" />
                  <Label htmlFor={template.id} className="font-semibold cursor-pointer">
                    {template.name}
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {template.sitesAssets?.length || 0} assets
                  </p>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSwitch} disabled={loading || !selectedTemplateId}>
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : "Switch Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
