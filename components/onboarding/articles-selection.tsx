"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { StepProps } from "@/types/onboarding";
import { useEffect, useMemo, useState } from "react";

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
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Articles Topics</h1>
        <p className="text-gray-500 mt-2">
          Manage your article topics here and select which ones to include.
        </p>
      </div>

      <div>
        {!hasTopics && (
          <div className="text-sm text-gray-500">
            No topics yet. Add topics to get started.
          </div>
        )}

        {hasTopics && (
          <div className="grid grid-cols-1 gap-4">
            {topics!.map((topic, idx) => (
              <div
                key={`${topic.topicname}-${idx}`}
                className="flex items-center p-4 border rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Label className="text-base font-medium">
                      Article Topic
                    </Label>
                    <input
                      className="flex-1 border rounded-md px-3 py-2"
                      value={topic.topicname}
                      onChange={(e) =>
                        handleUpdateTopic(idx, e.target.value)
                      }
                      placeholder="e.g. Leadership, Technology, Marketing..."
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveTopic(idx)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button variant="outline" onClick={handleAddTopic}>
            Add Topic
          </Button>
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={handleNext}>Next</Button>
      </div>
    </div>
  );
}
