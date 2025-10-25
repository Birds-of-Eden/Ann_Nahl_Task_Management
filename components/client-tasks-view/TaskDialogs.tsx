//app/components/client-tasks-view/TaskDialogs.tsx

"use client";
import { useState } from "react";
import type { Task, TimerState } from "../client-tasks-view/client-tasks-view";
import CompletionDialog from "./TaskCompleteDialogs/CompletionDialog";
import StatusUpdateDialog from "./TaskCompleteDialogs/StatusUpdateDialog";
import ShortDurationConfirmDialog from "./TaskCompleteDialogs/ShortDurationConfirmDialog";
import SummaryReportDialog from "./TaskCompleteDialogs/SummaryReportDialog";
import BacklinkingModal from "./TaskCompleteDialogs/BacklinkingDialog";
import ReviewRemovalModal from "./TaskCompleteDialogs/ReviewRemovalDialog";
import ContentWritingModal from "./TaskCompleteDialogs/contentWritingDialog";
// import ContentWritingModal from "./TaskCompleteDialogs/ContentWritingDialog";

export default function TaskDialogs({
  isStatusModalOpen,
  setIsStatusModalOpen,
  selectedTasks,
  isUpdating,
  handleUpdateSelectedTasks,
  isCompletionConfirmOpen,
  setIsCompletionConfirmOpen,
  taskToComplete,
  setTaskToComplete,
  completionLink,
  setCompletionLink,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  timerState,
  handleTaskCompletion,
  handleCompletionCancel,
  formatTimerDisplay,
  clientId,
  pausedTimer,
}: {
  isStatusModalOpen: boolean;
  setIsStatusModalOpen: (b: boolean) => void;
  selectedTasks: string[];
  isUpdating: boolean;
  handleUpdateSelectedTasks: (
    action: "completed" | "pending" | "reassigned",
    completionLink?: string
  ) => void;
  isCompletionConfirmOpen: boolean;
  setIsCompletionConfirmOpen: (b: boolean) => void;
  taskToComplete: Task | null;
  setTaskToComplete: (t: Task | null) => void;
  completionLink: string;
  setCompletionLink: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  timerState: TimerState | null;
  handleTaskCompletion: () => void;
  handleCompletionCancel: () => void;
  formatTimerDisplay: (seconds: number) => string;
  isBulkCompletionOpen: boolean;
  setIsBulkCompletionOpen: (b: boolean) => void;
  bulkCompletionLink: string;
  setBulkCompletionLink: (v: string) => void;
  handleBulkCompletion: () => void;
  handleBulkCompletionCancel: () => void;
  tasks: Task[];
  clientId: string;
  pausedTimer: TimerState | null;
}) {
  // ✅ Categories where only completion link should be shown (no credentials)
  const ASSETLESS_SET = new Set([
    "social activity",
    "blog posting",
    "graphics design",
  ]);
  const categoryName = (taskToComplete?.category?.name ?? "").toLowerCase();
  const showCredentialFields =
    !!taskToComplete && !ASSETLESS_SET.has(categoryName);

  // extra confirm dialog if actual < 70% of ideal
  const [isShortDurationConfirmOpen, setIsShortDurationConfirmOpen] =
    useState(false);
  const [shortDurationInfo, setShortDurationInfo] = useState<{
    actual: number;
    ideal: number;
  } | null>(null);
  const [clientEmail, setClientEmail] = useState<string | undefined>(undefined);
  const [lastUsedPassword, setLastUsedPassword] = useState<string | null>(null);

  // Function to determine if a task is simple (doesn't need credentials)
  const isSimpleTask = (task: any): boolean => {
    const categoryName = (task?.category?.name ?? "").toLowerCase();
    return ASSETLESS_SET.has(categoryName);
  };

  const predictActualMinutes = (): number | null => {
    if (!taskToComplete) return null;
    if (
      timerState?.taskId === taskToComplete.id &&
      typeof taskToComplete.idealDurationMinutes === "number"
    ) {
      const totalUsedSeconds =
        timerState.totalSeconds - timerState.remainingSeconds;
      if (totalUsedSeconds <= 0) return 0;
      const mins = Math.ceil(totalUsedSeconds / 60);
      return Math.max(mins, 1);
    }
    return typeof taskToComplete.actualDurationMinutes === "number"
      ? taskToComplete.actualDurationMinutes
      : null;
  };

  const showShortDurationIfNeeded = (): boolean => {
    if (!taskToComplete) return false;
    const ideal =
      typeof taskToComplete.idealDurationMinutes === "number"
        ? taskToComplete.idealDurationMinutes
        : null;
    const actual = predictActualMinutes();
    if (!ideal || actual == null) return false;
    const threshold = Math.ceil(ideal * 0.5);
    if (actual < threshold) {
      setShortDurationInfo({ actual, ideal });
      setIsShortDurationConfirmOpen(true);
      return true;
    }
    return false;
  };

  const guardedSubmit = () => {
    if (showShortDurationIfNeeded()) return;
    handleTaskCompletion();
  };

  const resetAllCompletionModals = () => {
    setIsShortDurationConfirmOpen(false);
    setShortDurationInfo(null);
    handleCompletionCancel();
  };

  return (
    <>
      {/* Status Update Modal */}
      <StatusUpdateDialog
        isOpen={isStatusModalOpen}
        onOpenChange={setIsStatusModalOpen}
        selectedTasks={selectedTasks}
        isUpdating={isUpdating}
        handleUpdateSelectedTasks={handleUpdateSelectedTasks}
      />

      {/* Short-duration confirmation (actual < 70% of ideal) */}
      <ShortDurationConfirmDialog
        isOpen={isShortDurationConfirmOpen}
        onOpenChange={setIsShortDurationConfirmOpen}
        shortDurationInfo={shortDurationInfo}
        onReview={() => {
          setIsShortDurationConfirmOpen(false);
          setTimeout(() => {
            setIsCompletionConfirmOpen(true);
          }, 50);
        }}
        onConfirm={() => {
          setIsShortDurationConfirmOpen(false);
          handleTaskCompletion();
        }}
      />

      {/* ✅ Category-aware completion modals */}
      {(() => {
        const cat = (taskToComplete?.category?.name ?? "").toLowerCase();
        const isSummary = cat.includes("summary report");
        const isBacklink = cat.includes("backlink");
        const isContent =
          cat.includes("content writing") || cat.includes("guest posting");
        const isReviewRemoval = cat.includes("review removal");

        if (isSummary) {
          return (
            <SummaryReportDialog
              open={isCompletionConfirmOpen}
              onOpenChange={setIsCompletionConfirmOpen}
              task={taskToComplete}
              clientId={clientId}
              onSuccess={() => setIsCompletionConfirmOpen(false)}
              submit={guardedSubmit}
              resetModal={resetAllCompletionModals}
              timerState={timerState}
              pausedTimer={pausedTimer}
              formatTimerDisplay={formatTimerDisplay}
            />
          );
        }
        if (isBacklink) {
          return (
            <BacklinkingModal
              open={isCompletionConfirmOpen}
              onOpenChange={setIsCompletionConfirmOpen}
              task={taskToComplete as any}
              clientId={clientId}
              timerState={timerState}
              pausedTimer={pausedTimer}
              formatTimerDisplay={formatTimerDisplay}
              resetModal={resetAllCompletionModals}
              submit={guardedSubmit}
            />
          );
        }
        if (isContent) {
          return (
            <ContentWritingModal
              open={isCompletionConfirmOpen}
              onOpenChange={setIsCompletionConfirmOpen}
              task={taskToComplete as any}
              timerState={timerState}
              pausedTimer={pausedTimer}
              formatTimerDisplay={formatTimerDisplay}
              resetModal={resetAllCompletionModals}
              submit={guardedSubmit}
            />
          );
        }
        if (isReviewRemoval) {
          return (
            <ReviewRemovalModal
              open={isCompletionConfirmOpen}
              onOpenChange={setIsCompletionConfirmOpen}
              task={taskToComplete as any}
              clientId={clientId}
              onSuccess={() => setIsCompletionConfirmOpen(false)}
              timerState={timerState}
              pausedTimer={pausedTimer}
              formatTimerDisplay={formatTimerDisplay}
              resetModal={resetAllCompletionModals}
              submit={guardedSubmit}
            />
          );
        }
        return (
          <CompletionDialog
            selected={taskToComplete}
            open={isCompletionConfirmOpen}
            link={completionLink}
            email={email}
            username={username}
            password={password}
            clientEmail={clientEmail}
            lastUsedPassword={lastUsedPassword}
            setLink={setCompletionLink}
            setEmail={setEmail}
            setUsername={setUsername}
            setPassword={setPassword}
            resetModal={resetAllCompletionModals}
            submit={guardedSubmit}
            isSimpleTask={isSimpleTask}
            timerState={timerState}
            pausedTimer={pausedTimer}
            formatTimerDisplay={formatTimerDisplay}
          />
        );
      })()}
    </>
  );
}
