// components/onboarding/template-selection.tsx

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Package, Sparkles, Clock, Users, FileText, Layers, TrendingUp } from "lucide-react";
import type { StepProps } from "@/types/onboarding";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string;
  status: string;
  packageId: string;
  _count?: {
    sitesAssets: number;
    templateTeamMembers: number;
  };
}

export function TemplateSelection({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    formData.templateId || ""
  );

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!formData.packageId) {
        toast.error("Please select a package first");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/packages/templates?packageId=${formData.packageId}`
        );
        const data = await res.json();

        if (res.ok) {
          setTemplates(data);
          if (data.length === 0) {
            toast.info("No templates found for this package");
          }
        } else {
          toast.error("Failed to fetch templates");
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast.error("Something went wrong while fetching templates");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [formData.packageId]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    updateFormData({ templateId });
    toast.success("Template selected successfully!");
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "archived":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg mb-4 animate-pulse">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
            Select Template
          </h1>
          <p className="text-gray-600 text-lg">
            Loading available templates for your package...
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
          Select Your Template
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Choose a template that perfectly aligns with your project requirements and business goals.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-32 h-32 bg-gradient-to-br from-purple-100 via-fuchsia-100 to-pink-100 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
            <FileText className="w-16 h-16 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            No Templates Available
          </h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            There are no templates available for the selected package. Please
            contact support or try a different package.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {templates.map((template, index) => (
            <Card
              key={template.id}
              className={`relative overflow-hidden cursor-pointer transition-all duration-500 group ${
                selectedTemplate === template.id
                  ? "ring-4 ring-purple-500 shadow-2xl scale-105 bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-50"
                  : "hover:shadow-xl hover:-translate-y-2 bg-white"
              }`}
              onClick={() => handleTemplateSelect(template.id)}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Selection Badge */}
              {selectedTemplate === template.id && (
                <div className="absolute top-4 right-4 z-10 animate-in zoom-in duration-300">
                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-full p-2 shadow-lg">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}

              {/* Top Gradient Bar */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
              </div>

              {/* Glow Effect on Hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/0 to-pink-400/0 group-hover:from-purple-400/10 group-hover:to-pink-400/10 transition-all duration-500" />

              <CardHeader className="pb-4 pt-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${getStatusColor(
                          template.status
                        )}`}
                      >
                        {template.status || "Active"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {template.description ||
                    "A comprehensive template designed to meet your project needs and deliver exceptional results."}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 pb-6">
                {/* Stats Section */}
                <div className="flex items-center gap-3 mb-5">
                  {template._count?.sitesAssets && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{template._count.sitesAssets} Assets</span>
                    </div>
                  )}
                  {template._count?.templateTeamMembers && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg text-xs font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {template._count.templateTeamMembers} Members
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  className={`w-full h-12 font-semibold transition-all duration-300 ${
                    selectedTemplate === template.id
                      ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-700 text-white shadow-xl"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 hover:from-purple-50 hover:to-pink-50 text-gray-700 hover:text-purple-700 border-2 border-gray-200 hover:border-purple-300"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTemplateSelect(template.id);
                  }}
                >
                  {selectedTemplate === template.id ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Selected
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Select Template
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-700 hover:border-purple-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
