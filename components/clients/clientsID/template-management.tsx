// components/clients/clientsID/template-management.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Layers,
  Settings,
  RefreshCw,
  Plus,
  Edit,
  Lock,
  Zap,
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Loader,
} from "lucide-react";
import { Client } from "@/types/client";
import { CustomizeTemplateDialog } from "./template-customization/customize-dialog";
import { SwitchTemplateDialog } from "./template-customization/switch-template-dialog";
import { AssetCard } from "./template-customization/asset-card";
import { CustomizationHistory } from "./template-customization/customization-history";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { toast } from "sonner";

interface TemplateManagementProps {
  clientData: Client;
  onUpdate?: () => void;
}

export function TemplateManagement({
  clientData,
  onUpdate,
}: TemplateManagementProps) {
  const { user } = useUserSession();
  const [loading, setLoading] = useState(true);
  const [templateData, setTemplateData] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const roleName = (user as any)?.role?.name ?? (user as any)?.role ?? "";
  const isClient = String(roleName).toLowerCase() === "client";
  const isAgent = String(roleName).toLowerCase() === "agent";
  const canManage = !isClient && !isAgent; // AM, Manager, Admin can manage

  useEffect(() => {
    const fetchTemplateData = async () => {
      try {
        setLoading(true);
        
        // Get assignment for this client
        const assignmentRes = await fetch(
          `/api/assignments?clientId=${clientData.id}`
        );
        const assignments = await assignmentRes.json();
        
        if (assignments && assignments.length > 0) {
          const currentAssignment = assignments[0];
          setAssignment(currentAssignment);

          if (currentAssignment.template) {
            setTemplateData(currentAssignment.template);
          }
        }
      } catch (error) {
        console.error("Error fetching template data:", error);
        toast.error("Failed to load template data");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplateData();
  }, [clientData.id, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    onUpdate?.();
  };

  const handleCustomizeSuccess = () => {
    toast.success("Template customized successfully!");
    handleRefresh();
    setCustomizeOpen(false);
  };

  const handleSwitchSuccess = () => {
    toast.success("Template switched successfully!");
    handleRefresh();
    setSwitchOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Loader className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-500">Loading template data...</p>
        </div>
      </div>
    );
  }

  if (!assignment || !templateData) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">
                No Template Assigned
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                This client does not have an assignment or template configured yet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isCustomTemplate = templateData.name?.includes("Custom") || 
                          templateData.description?.includes("cloned");
  
  const totalAssets = templateData.sitesAssets?.length || 0;
  const assetsByType = templateData.sitesAssets?.reduce((acc: any, asset: any) => {
    const type = asset.type || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {}) || {};

  // Count custom overrides
  const customOverrides = assignment.siteAssetSettings?.filter(
    (setting: any) => 
      setting.requiredFrequency !== null &&
      setting.templateSiteAsset?.defaultPostingFrequency !== setting.requiredFrequency
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Package className="h-6 w-6 text-blue-600" />
                Template Management
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage templates and assets for {clientData.name}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Current Template Overview */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Current Template
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Template Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {templateData.name}
                  </h3>
                  {isCustomTemplate && (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      Custom
                    </Badge>
                  )}
                </div>
                {templateData.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {templateData.description}
                  </p>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Layers className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Total Assets
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {totalAssets}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Custom Overrides
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {customOverrides}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Team Members
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {templateData.templateTeamMembers?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last Modified
                    </p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {templateData.updatedAt
                        ? new Date(templateData.updatedAt).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {canManage && (
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                onClick={() => setCustomizeOpen(true)}
                className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              >
                <Edit className="h-4 w-4" />
                Customize Template
              </Button>
              <Button
                onClick={() => setSwitchOpen(true)}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Switch Template
              </Button>
            </div>
          )}

          {!canManage && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <Lock className="h-4 w-4 text-slate-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isClient
                  ? "Clients can view but not modify templates"
                  : "Agents can view but not modify templates"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets List */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-600" />
            Template Assets ({totalAssets})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {templateData.sitesAssets && templateData.sitesAssets.length > 0 ? (
            <div className="space-y-6">
              {/* Group by type */}
              {Object.entries(assetsByType).map(([type, count]) => {
                const assets = templateData.sitesAssets.filter(
                  (a: any) => (a.type || "other") === type
                );
                
                return (
                  <div key={type} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {type.replace(/_/g, " ")} ({count})
                      </h4>
                    </div>
                    <div className="grid gap-4">
                      {assets.map((asset: any) => {
                        const setting = assignment.siteAssetSettings?.find(
                          (s: any) => s.templateSiteAssetId === asset.id
                        );
                        
                        return (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            setting={setting}
                            isCustomTemplate={isCustomTemplate}
                            canManage={canManage}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No assets configured in this template</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customization History */}
      <CustomizationHistory
        assignmentId={assignment.id}
        clientName={clientData.name}
      />

      {/* Dialogs */}
      <CustomizeTemplateDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        assignment={assignment}
        currentTemplate={templateData}
        clientName={clientData.name}
        onSuccess={handleCustomizeSuccess}
      />

      <SwitchTemplateDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        assignment={assignment}
        currentTemplate={templateData}
        clientName={clientData.name}
        onSuccess={handleSwitchSuccess}
      />
    </div>
  );
}
