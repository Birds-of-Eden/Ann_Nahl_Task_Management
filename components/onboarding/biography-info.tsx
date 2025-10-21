"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { StepProps } from "@/types/onboarding";
import { Sparkles, FileText, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { hasPermissionClient } from "@/lib/permissions-client";
import { useAuth } from "@/context/auth-context";

export function BiographyInfo({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();

  const handleGenerateBio = async () => {
    setIsGenerating(true);
    let progress = 0;

    // Show initial toast
    const toastId = toast.loading("Generating biography: 0% complete");

    // Update progress every 2 seconds
    const progressInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5; // Random progress between 5-20%

      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
      }

      toast.loading(`Generating biography: ${progress}% complete`, {
        id: toastId,
      });
    }, 2000);

    // Mock AI generation with a timeout
    setTimeout(() => {
      const generatedBio = `I am ${
        formData.name || "a passionate professional"
      } with extensive experience in ${formData.company || "my field"}. ${
        formData.designation
          ? `As a ${formData.designation}, I bring `
          : "I bring "
      }a unique blend of expertise and innovation to every project.

My journey has been marked by continuous learning and growth, always striving to deliver exceptional results. I believe in the power of collaboration and building meaningful relationships with clients and colleagues alike.

${
  formData.location ? `Based in ${formData.location}, I ` : "I "
}am committed to excellence and take pride in helping businesses achieve their goals through strategic thinking and creative solutions.

When I'm not working, I enjoy exploring new technologies, staying updated with industry trends, and contributing to community initiatives that make a positive impact.`;

      updateFormData({ biography: generatedBio });
      setIsGenerating(false);
      clearInterval(progressInterval);

      // Show completion toast
      toast.success("Your AI-generated biography is ready!", {
        id: toastId,
        duration: 5000,
      });
    }, 8000); // 8 seconds for generation
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent">
          Your Biography
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Tell us about yourself or let our AI help you create a compelling
          biography that stands out.
        </p>
      </div>

      {/* Biography Card */}
      <div className="bg-gradient-to-br from-white to-amber-50/30 rounded-2xl shadow-xl border border-amber-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your Story</h2>
              <p className="text-sm text-gray-600">Share your professional journey</p>
            </div>
          </div>
          {hasPermissionClient(
            user?.permissions,
            "generate_biography"
          ) && (
            <Button
              onClick={handleGenerateBio}
              disabled={isGenerating}
              className="relative group overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white shadow-lg"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </span>
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <Label htmlFor="biography" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Biography
          </Label>
          <Textarea
            id="biography"
            value={formData.biography || ""}
            onChange={(e) => updateFormData({ biography: e.target.value })}
            placeholder="Write about yourself, your experience, achievements, and what makes you unique..."
            className="min-h-[320px] resize-none border-2 border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 rounded-xl text-base leading-relaxed"
            disabled={isGenerating}
          />

          <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Pro tip:</span> This biography will be used across your profiles and marketing
              materials. Make it engaging, authentic, and professional to leave a lasting impression.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:text-amber-700 hover:border-amber-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={onNext}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-700 hover:via-orange-700 hover:to-red-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
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
