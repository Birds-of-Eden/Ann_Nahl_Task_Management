// DataEntryRenew.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CalendarDays,
  CheckCircle,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useUserSession } from "@/lib/hooks/use-user-session";

export function RenewPostingTasksButton({
  clientId,
  templateId,
  packageMonths,
  className,
  onRenewComplete,
}: {
  clientId: string;
  templateId?: string | null;
  packageMonths: number;
  className?: string;
  onRenewComplete?: () => void;
}) {
  const { user } = useUserSession();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renewalDate, setRenewalDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);

  const computedDueDate = useMemo(() => {
    const d = new Date(renewalDate);
    if (Number.isNaN(d.getTime())) return "";
    const end = new Date(d);
    end.setMonth(
      end.getMonth() +
        (Number.isFinite(packageMonths) && packageMonths > 0
          ? Math.floor(packageMonths)
          : 1)
    );
    return end.toISOString().slice(0, 10);
  }, [renewalDate, packageMonths]);

  async function onConfirm() {
    try {
      setSubmitting(true);
      const res = await fetch("/api/renewal/dataentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          templateId: templateId ?? undefined,
          renewalDate, // send YYYY-MM-DD to avoid timezone shifts
          assignToUserId: user?.id ?? undefined, // ✅ session user
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || "Failed to create posting tasks for renewal");
        return;
      }
      toast.success(data?.message || "Posting tasks created for renewal");
      setConfirmOpen(false);
      setOpen(false);
      // Call the callback if provided
      if (onRenewComplete) {
        onRenewComplete();
      }
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium px-6 py-2.5 rounded-lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Renew & Generate Posting Tasks
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md border-0 bg-white shadow-2xl rounded-xl backdrop-blur-sm">
          <div className="relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-t-xl" />
            <DialogHeader className="pt-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </div>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  Renew Client Package
                </DialogTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Renew package and generate posting tasks for the client
              </p>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label
                  htmlFor="renewalDate"
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Renewal Date
                </Label>
                <Input
                  id="renewalDate"
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200 rounded-lg py-2.5"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-500" />
                  New Due Date
                </Label>
                <div className="relative">
                  <Input
                    readOnly
                    value={computedDueDate}
                    className="bg-gray-50 border-gray-200 text-gray-900 font-medium rounded-lg py-2.5 pr-10"
                  />
                  <CheckCircle className="w-5 h-5 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Calculated as renewal date + {packageMonths} month(s)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800">
                    This action will renew the client's package and automatically
                    generate all associated posting tasks.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200 rounded-lg py-2.5"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={submitting || !user?.id}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg py-2.5 font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Renewal
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 font-bold text-xl">
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-red-500 text-lg">
              This will set the renewal date to{" "}
              <span className="font-medium">{renewalDate}</span> and update the
              due date to <span className="font-medium">{computedDueDate}</span>. Posting
              tasks will be generated accordingly. You can’t undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-white bg-green-600 hover:bg-green-700 transition-colors duration-200 rounded-lg py-2.5 hover:text-white"
              disabled={submitting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              disabled={submitting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Yes, do it"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
