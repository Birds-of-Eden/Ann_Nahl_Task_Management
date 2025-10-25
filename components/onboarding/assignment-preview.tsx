"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock, Users, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AssignmentPreviewProps {
  templateId: string;
  packageId: string;
  templateName: string;
}

interface TemplateDetails {
  id: string;
  name: string;
  description: string;
  status: string;
  sitesAssets: Array<{
    id: number;
    name: string;
    type: string;
    isRequired: boolean;
    defaultPostingFrequency: number;
    defaultIdealDurationMinutes: number;
  }>;
  templateTeamMembers: Array<{
    agent: {
      name: string;
      email: string;
    };
    role: string;
  }>;
}

export function AssignmentPreview({
  templateId,
  packageId,
  templateName,
}: AssignmentPreviewProps) {
  const [templateDetails, setTemplateDetails] =
    useState<TemplateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingAssignments, setExistingAssignments] = useState<number>(0);

  useEffect(() => {
    const fetchTemplateDetails = async () => {
      if (!templateId) return;

      setLoading(true);
      try {
        // Fetch template details with related data
        const templateRes = await fetch(
          `/api/packages/templates/${templateId}?include=sitesAssets,templateTeamMembers`
        );
        if (templateRes.ok) {
          const templateData = await templateRes.json();
          setTemplateDetails(templateData);
        }

        // Fetch existing assignments count
        const assignmentsRes = await fetch(
          `/api/assignments?templateId=${templateId}`
        );
        if (assignmentsRes.ok) {
          const assignmentsData = await assignmentsRes.json();
          setExistingAssignments(assignmentsData.length);
        }
      } catch (error) {
        console.error("Error fetching template details:", error);
        toast.error("Failed to load template details");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplateDetails();
  }, [templateId]);

  if (loading) {
    return (
      <Card className="overflow-hidden border-2 border-indigo-100 shadow-xl rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white py-6">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <FileText className="w-7 h-7" />
            Assignment Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-6 w-3/4 rounded-lg" />
          <Skeleton className="h-6 w-1/2 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!templateDetails) {
    return (
      <Card className="overflow-hidden border-2 border-red-100 shadow-xl rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 text-white py-6">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <AlertCircle className="w-7 h-7" />
            Assignment Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <p className="text-gray-600 text-base">
            Unable to load template details.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CardContent className="p-0 space-y-6">
        {/* Template Overview */}
        <div className="bg-white p-6 rounded-xl border-2 border-indigo-200">
          <h3 className="font-bold text-xl mb-3 flex items-center gap-2 text-gray-900">
            <CheckCircle className="w-6 h-6 text-green-500" />
            {templateDetails.name}
          </h3>
          <p className="text-gray-600 mb-4 leading-relaxed">
            {templateDetails.description}
          </p>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="bg-indigo-100 text-indigo-800 border-indigo-300 px-3 py-1.5 font-semibold"
            >
              {templateDetails.status}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-800 border-gray-300 px-3 py-1.5 font-semibold"
            >
              {existingAssignments} existing assignments
            </Badge>
          </div>
        </div>

        {/* Sites & Assets */}
        {templateDetails.sitesAssets &&
          templateDetails.sitesAssets.length > 0 && (
            <div className="bg-white p-6 rounded-xl border-2 border-blue-200">
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900">
                <Clock className="w-5 h-5 text-blue-500" />
                Sites & Assets ({templateDetails.sitesAssets.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templateDetails.sitesAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-900">
                        {asset.name}
                      </span>
                      {asset.isRequired && (
                        <Badge
                          variant="destructive"
                          className="text-xs font-semibold"
                        >
                          Required
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 space-y-1.5">
                      <div className="font-medium">Type: {asset.type}</div>
                      {asset.defaultPostingFrequency && (
                        <div>
                          Frequency: {asset.defaultPostingFrequency}/month
                        </div>
                      )}
                      {asset.defaultIdealDurationMinutes && (
                        <div>
                          Duration: {asset.defaultIdealDurationMinutes} min
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Assignment Info */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-indigo-900 text-lg">
              What happens next?
            </h4>
          </div>
          <ul className="text-base text-indigo-800 space-y-2.5">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              An assignment will be automatically created
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Team members will be notified
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Tasks will be generated based on template assets
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              You'll receive a confirmation email
            </li>
          </ul>
        </div>
      </CardContent>
    </div>
  );
}
