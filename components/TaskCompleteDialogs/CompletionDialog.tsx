"use client";

import React from "react";
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
  Calendar,
  CheckCircle2,
  KeyRound,
  Link as LinkIcon,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "react-datepicker";

interface CompletionDialogProps {
  selected: any;
  open: boolean;
  link: string;
  email: string;
  username: string;
  password: string;
  doneBy: string;
  completedAt: Date | undefined;
  clientEmail?: string;
  lastUsedPassword?: string | null;
  agents: any[];
  agentSearchTerm: string;
  setLink: (val: string) => void;
  setEmail: (val: string) => void;
  setUsername: (val: string) => void;
  setPassword: (val: string) => void;
  setDoneBy: (val: string) => void;
  setAgentSearchTerm: (val: string) => void;
  setCompletedAt: (val: Date | undefined) => void;
  resetModal: () => void;
  submit: () => void;
  setLastUsedAgent?: (val: string) => void;
  setLastUsedDate?: (val: Date) => void;
  isSimpleTask: (task: any) => boolean;
}

const CompletionDialog: React.FC<CompletionDialogProps> = ({
  selected,
  open,
  link,
  email,
  username,
  password,
  doneBy,
  completedAt,
  clientEmail,
  lastUsedPassword,
  agents,
  agentSearchTerm,
  setLink,
  setEmail,
  setUsername,
  setPassword,
  setDoneBy,
  setAgentSearchTerm,
  setCompletedAt,
  resetModal,
  submit,
  setLastUsedAgent,
  setLastUsedDate,
  isSimpleTask,
}) => {
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
                <div className="text-white font-black text-xl truncate">
                  {selected?.name}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-16 font-medium">
              Provide completion details below. This task will be auto-approved upon submission.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="space-y-8 px-6 pb-6">
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
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Email</label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={clientEmail || "email@example.com"}
                    className="rounded-2xl h-12 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="rounded-2xl h-12 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all font-medium"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Password</label>
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

          {/* Agent + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <UserRound className="h-4 w-4 text-blue-600" />
                </div>
                Done by (Agent) *
              </label>
              <Select
                value={doneBy}
                onValueChange={(value) => {
                  setDoneBy(value);
                  setLastUsedAgent?.(value);
                }}
              >
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
                      .filter((agent) => {
                        const search = agentSearchTerm.toLowerCase();
                        return (
                          !search ||
                          agent.name?.toLowerCase().includes(search)
                        );
                      })
                      .sort((a, b) => {
                        if (a.id === doneBy) return -1;
                        if (b.id === doneBy) return 1;
                        return 0;
                      })
                      .map((agent) => (
                        <SelectItem
                          key={agent.id}
                          value={agent.id}
                          className="rounded-lg py-2 px-2 my-1 hover:bg-gray-100 focus:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center gap-4 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div
                              className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                                agent.id === doneBy
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              {agent.name || "Unnamed Agent"}
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
                onChange={(date: Date | null) => {
                  const newDate = date || new Date();
                  setCompletedAt(newDate);
                  setLastUsedDate?.(newDate);
                }}
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

        {/* Footer */}
        <DialogFooter className="pt-8 border-t-2 border-slate-100 px-6 pb-6 gap-4">
          <Button
            variant="outline"
            onClick={resetModal}
            className="rounded-2xl h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-8"
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            className="ml-2 bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 rounded-2xl h-14 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-8"
            disabled={!doneBy}
            onClick={submit}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Submit Completion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompletionDialog;
