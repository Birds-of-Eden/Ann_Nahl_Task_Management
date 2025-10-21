"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { StepProps } from "@/types/onboarding";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, BookOpen } from "lucide-react";

type ArticleTopic = {
  topicname: string;
};

export function ArticlesSelection({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  // Locally managed topics and selections
  const [topics, setTopics] = useState<ArticleTopic[]>(() =>
    Array.isArray(formData.articleTopics) ? [...formData.articleTopics] : []
  );
  const [selected, setSelected] = useState<number[]>(() =>
    Array.isArray(formData.selectedArticles)
      ? [...formData.selectedArticles]
      : []
  );

  // Sync local topics if parent formData changes while mounted
  useEffect(() => {
    setTopics(
      Array.isArray(formData.articleTopics) ? [...formData.articleTopics] : []
    );
  }, [formData.articleTopics]);


  const handleUpdateTopic = (index: number, value: string) => {
    setTopics((prev) =>
      prev.map((t, i) => (i === index ? { ...t, topicname: value } : t))
    );
  };

  const handleAddTopic = () => {
    setTopics((prev) => [
      ...prev,
      {
        topicname: "",
      },
    ]);
  };

  const handleRemoveTopic = (index: number) => {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    // Normalize topics: trim topicname
    const normalizedTopics = topics
      .map((t) => ({
        topicname: (t.topicname || "").trim(),
      }))
      .filter((t) => t.topicname.length > 0);

    updateFormData({
      articleTopics: normalizedTopics,
      selectedArticles: [], // No longer used but keeping for backward compatibility
    });
    onNext();
  };

  const hasTopics = useMemo(() => (topics?.length ?? 0) > 0, [topics]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-lg mb-4">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-rose-600 bg-clip-text text-transparent">
          Article Topics
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Manage your article topics to organize and categorize your content effectively.
        </p>
      </div>

      {/* Topics Card */}
      <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-xl border border-orange-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Topics</h2>
            <p className="text-sm text-gray-600">Add and manage article topics</p>
          </div>
        </div>

        {!hasTopics && (
          <div className="text-center py-12 border-2 border-dashed border-orange-200 rounded-xl bg-orange-50/50">
            <BookOpen className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No topics yet. Add topics to get started.</p>
          </div>
        )}

        {hasTopics && (
          <div className="space-y-4">
            {topics!.map((topic, idx) => (
              <div
                key={`${topic.topicname}-${idx}`}
                className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:border-orange-300 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-500" />
                      Article Topic
                    </Label>
                    <textarea
                      className="w-full border-2 border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 rounded-xl px-4 py-3 transition-all duration-200 resize-none"
                      value={topic.topicname}
                      onChange={(e) =>
                        handleUpdateTopic(idx, e.target.value)
                      }
                      placeholder="e.g. Leadership, Technology, Marketing..."
                      rows={2}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveTopic(idx)}
                    className="h-10 w-10 text-red-500 hover:text-white hover:bg-red-500 border-2 border-red-300 hover:border-red-500 rounded-xl transition-all duration-200 flex-shrink-0 mt-7"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6">
          <Button 
            onClick={handleAddTopic} 
            className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Topic
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700 hover:border-orange-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={handleNext}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-orange-600 via-red-600 to-rose-600 hover:from-orange-700 hover:via-red-700 hover:to-rose-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
        >
          Continue to Next Step
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
