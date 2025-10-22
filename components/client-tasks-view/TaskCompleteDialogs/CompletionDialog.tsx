"use client";

import React, { useState } from "react";
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
import {
  CheckCircle2,
  KeyRound,
  Link as LinkIcon,
  X,
  Clock,
} from "lucide-react";

interface CompletionDialogProps {
  selected: any;
  open: boolean;
  link: string;
  email: string;
  username: string;
  password: string;
  clientEmail?: string;
  lastUsedPassword?: string | null;
  setLink: (val: string) => void;
  setEmail: (val: string) => void;
  setUsername: (val: string) => void;
  setPassword: (val: string) => void;
  resetModal: () => void;
  submit: () => void;
  isSimpleTask: (task: any) => boolean;
  timerState?: any; // Timer data from TaskTimer
  pausedTimer?: any; // Paused timer data
  formatTimerDisplay?: (seconds: number) => string; // Format function
}

const CompletionDialog: React.FC<CompletionDialogProps> = ({
  selected,
  open,
  link,
  email,
  username,
  password,
  clientEmail,
  lastUsedPassword,
  setLink,
  setEmail,
  setUsername,
  setPassword,
  resetModal,
  submit,
  isSimpleTask,
  timerState,
  pausedTimer,
  formatTimerDisplay,
}) => {
  // Calculate timer information from TaskTimer data
  const calculateTimerInfo = () => {
    if (!selected?.idealDurationMinutes) return null;

    const total = selected.idealDurationMinutes * 60;
    const isActive = timerState?.taskId === selected.id;
    const isPausedHere =
      !isActive &&
      pausedTimer?.taskId === selected.id &&
      !pausedTimer?.isRunning;

    let elapsedSeconds = 0;
    let remainingSeconds = total;
    let progress = 0;
    let isRunning = false;
    let isOvertime = false;
    let displayTime = total;

    if (isActive && timerState) {
      isRunning = timerState.isRunning;
      remainingSeconds = timerState.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      progress = (elapsedSeconds / total) * 100;
      displayTime = Math.abs(remainingSeconds);
      isOvertime = remainingSeconds <= 0;
    } else if (isPausedHere && pausedTimer) {
      remainingSeconds = pausedTimer.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      progress = (elapsedSeconds / total) * 100;
      displayTime = Math.abs(remainingSeconds);
      isOvertime = remainingSeconds <= 0;
    }

    return {
      elapsedSeconds,
      remainingSeconds,
      totalSeconds: total,
      progress,
      isRunning,
      isOvertime,
      displayTime,
      formatElapsedTime: formatTimerDisplay
        ? formatTimerDisplay(elapsedSeconds)
        : `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60)
            .toString()
            .padStart(2, "0")}`,
      formatDisplayTime: formatTimerDisplay
        ? formatTimerDisplay(displayTime)
        : `${Math.floor(displayTime / 60)}:${(displayTime % 60)
            .toString()
            .padStart(2, "0")}`,
    };
  };

  const timerInfo = calculateTimerInfo();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetModal()}>
      <DialogContent className="sm:max-w-[750px] rounded-3xl border-0 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 -m-6 mb-6 px-8 py-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Complete Task
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-black text-xl truncate flex-1">
                    {selected?.name}
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                    <Clock className="h-4 w-4 text-white/80" />
                    <span className="text-white font-mono font-bold text-sm">
                      {timerInfo?.formatDisplayTime || "00:00"}
                    </span>
                  </div>
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-16 font-medium">
              Provide completion details below. This task will be auto-approved
              upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="space-y-8 px-6 pb-6">
          {/* Timer Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-xl">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
                    Time Tracking
                  </h3>
                  <p className="text-xs text-blue-600 font-medium">
                    Time spent on this completion
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-black text-blue-700">
                  {timerInfo?.formatElapsedTime || "00:00"}
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  {timerInfo ? Math.ceil(timerInfo.elapsedSeconds / 60) : 0}{" "}
                  minutes
                </div>
              </div>
            </div>
          </div>
          {/* Completion Link */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <LinkIcon className="h-4 w-4 text-emerald-600" />
              </div>
              Completion Link *
            </label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com/your-completed-work"
              className="rounded-2xl h-14 border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all text-base font-medium px-5"
            />
          </div>

          {/* Credentials */}
          {!isSimpleTask(selected) && (
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-3xl p-6 space-y-5 shadow-inner">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-amber-500 p-2 rounded-xl">
                  <KeyRound className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                  Account Credentials
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Email
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={clientEmail || "email@example.com"}
                    className="rounded-2xl h-12 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Username
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="rounded-2xl h-12 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all font-medium"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        lastUsedPassword
                          ? "Using previously saved password"
                          : "Enter password"
                      }
                      type="text"
                      className="rounded-2xl h-12 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 font-mono pr-20 transition-all font-medium"
                    />
                    {lastUsedPassword && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full">
                        SAVED
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-medium">
                    {lastUsedPassword
                      ? "✓ Using your last saved password. You can edit it above."
                      : "Password will be saved for next use."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="pt-8 border-t-2 border-slate-100 px-6 pb-6 gap-4">
          <Button
            variant="outline"
            onClick={resetModal}
            className="rounded-2xl h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white hover:text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-8"
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            className="ml-2 bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
            onClick={() => {
              // Include time tracking data in submission
              const timeSpentMinutes = timerInfo
                ? Math.ceil(timerInfo.elapsedSeconds / 60)
                : 0;
              submit();
            }}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Submit Completion ({timerInfo?.formatDisplayTime || "00:00"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompletionDialog;
