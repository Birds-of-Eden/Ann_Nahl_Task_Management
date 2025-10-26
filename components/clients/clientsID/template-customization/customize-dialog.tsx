// components/clients/clientsID/template-customization/customize-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useUserSession } from "@/lib/hooks/use-user-session";

interface CustomizeTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: any;
  currentTemplate: any;
  clientName: string;
  onSuccess?: () => void;
}

// Asset types will be loaded dynamically from API
interface AssetTypeOption {
  value: string;
  label: string;
}

interface NewAsset {
  type: string;
  name: string;
  customName: string;  // User's custom name
  url: string;
  description: string;
  isRequired: boolean;
  defaultPostingFrequency: number;
  defaultIdealDurationMinutes: number;
}

interface Replacement {
  oldAssetId: number;
  newAssetName: string;
  newAssetUrl: string;
  defaultPostingFrequency: number;
}

export function CustomizeTemplateDialog({
  open,
  onOpenChange,
  assignment,
  currentTemplate,
  clientName,
  onSuccess,
}: CustomizeTemplateDialogProps) {
  const { user } = useUserSession();
  const [loading, setLoading] = useState(false);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([]);
  const [customTemplateName, setCustomTemplateName] = useState("");  // Custom template name
  const [newAssets, setNewAssets] = useState<NewAsset[]>([]);
  const [replacements, setReplacements] = useState<Replacement[]>([]);

  // Load all available asset types from API
  useEffect(() => {
    const fetchAssetTypes = async () => {
      try {
        setLoadingAssetTypes(true);
        const response = await fetch("/api/asset-types");
        if (response.ok) {
          const data = await response.json();
          // Transform enum values to readable labels
          const types = data.assetTypes.map((type: string) => ({
            value: type,
            label: formatAssetTypeLabel(type),
          }));
          setAssetTypes(types);
        } else {
          // Fallback to default types if API fails
          setAssetTypes(getDefaultAssetTypes());
        }
      } catch (error) {
        console.error("Error fetching asset types:", error);
        // Fallback to default types
        setAssetTypes(getDefaultAssetTypes());
      } finally {
        setLoadingAssetTypes(false);
      }
    };

    if (open) {
      fetchAssetTypes();
    }
  }, [open]);

  // Format asset type enum to readable label
  const formatAssetTypeLabel = (type: string): string => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Default fallback asset types
  const getDefaultAssetTypes = (): AssetTypeOption[] => [
    { value: "social_site", label: "Social Site" },
    { value: "web2_site", label: "Web 2.0 Site" },
    { value: "other_asset", label: "Other Asset" },
    { value: "graphics_design", label: "Graphics Design" },
    { value: "content_writing", label: "Content Writing" },
    { value: "youtube_video_optimization", label: "YouTube Video" },
    { value: "guest_posting", label: "Guest Posting" },
  ];

  const handleAddAsset = () => {
    setNewAssets([
      ...newAssets,
      {
        type: "social_site",
        name: "",  // Will be set from asset type selection
        customName: "",  // User can customize this
        url: "",
        description: "",
        isRequired: true,
        defaultPostingFrequency: 3,  // Changed from 4 to 3
        defaultIdealDurationMinutes: 30,
      },
    ]);
  };

  const handleRemoveAsset = (index: number) => {
    setNewAssets(newAssets.filter((_, i) => i !== index));
  };

  const handleUpdateAsset = (index: number, field: keyof NewAsset, value: any) => {
    const updated = [...newAssets];
    updated[index] = { ...updated[index], [field]: value };
    setNewAssets(updated);
  };

  const handleAddReplacement = () => {
    if (currentTemplate.sitesAssets?.length > 0) {
      setReplacements([
        ...replacements,
        {
          oldAssetId: currentTemplate.sitesAssets[0].id,
          newAssetName: "",
          newAssetUrl: "",
          defaultPostingFrequency: 4,
        },
      ]);
    }
  };

  const handleRemoveReplacement = (index: number) => {
    setReplacements(replacements.filter((_, i) => i !== index));
  };

  const handleUpdateReplacement = (index: number, field: keyof Replacement, value: any) => {
    const updated = [...replacements];
    updated[index] = { ...updated[index], [field]: value };
    setReplacements(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (newAssets.length === 0 && replacements.length === 0) {
      toast.error("Please add at least one new asset or replacement");
      return;
    }

    // Validate new assets
    for (const asset of newAssets) {
      if (!asset.name.trim()) {
        toast.error("All new assets must have a name");
        return;
      }
    }

    // Validate replacements
    for (const replacement of replacements) {
      if (!replacement.newAssetName.trim()) {
        toast.error("All replacements must have a new name");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/assignments/${assignment.id}/customize-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-actor-id": user?.id || "",
          },
          body: JSON.stringify({
            newAssets: newAssets.length > 0 ? newAssets : undefined,
            replacements: replacements.length > 0 ? replacements : undefined,
            customTemplateName: customTemplateName.trim() || undefined,  // Send custom name if provided
            idempotencyKey: `customize-${assignment.id}-${Date.now()}`,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        onSuccess?.();
        setNewAssets([]);
        setReplacements([]);
      } else {
        toast.error(data.message || "Failed to customize template");
      }
    } catch (error) {
      console.error("Error customizing template:", error);
      toast.error("An error occurred while customizing template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Customize Template
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                  {clientName}
                </Badge>
              </div>
              <p className="text-sm font-normal text-slate-500 mt-1">
                Current Template: <span className="font-semibold">{currentTemplate.name}</span>
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            ✨ Add new assets or replace existing ones to create a personalized template.
            <br />
            💡 Your changes will only affect <span className="font-semibold">{clientName}</span> - other clients remain unchanged.
          </DialogDescription>
        </DialogHeader>

        {/* Custom Template Name Field */}
        <div className="space-y-2 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl">
          <Label htmlFor="customTemplateName" className="text-sm font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Custom Template Name
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
              Optional
            </Badge>
          </Label>
          <Input
            id="customTemplateName"
            value={customTemplateName}
            onChange={(e) => setCustomTemplateName(e.target.value)}
            placeholder={`${currentTemplate.name} - Custom (${clientName})`}
            className="border-2 border-purple-300 focus:border-purple-500 bg-white dark:bg-slate-800 font-medium"
          />
          <p className="text-xs text-purple-700 dark:text-purple-400 flex items-start gap-1">
            <span>💡</span>
            <span>
              If not provided, a default name will be generated: <span className="font-semibold">"{currentTemplate.name} - Custom ({clientName})"</span>
            </span>
          </p>
        </div>

        <Tabs defaultValue="add" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="add" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              <Plus className="h-4 w-4" />
              Add New Assets
            </TabsTrigger>
            <TabsTrigger value="replace" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
              <Sparkles className="h-4 w-4" />
              Replace Assets
            </TabsTrigger>
          </TabsList>

          {/* Add New Assets Tab */}
          <TabsContent value="add" className="space-y-4 mt-4">
            {newAssets.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <Plus className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No new assets added yet</p>
                <Button onClick={handleAddAsset} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Asset
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {newAssets.map((asset, index) => (
                  <div
                    key={index}
                    className="p-5 border-2 border-blue-200 dark:border-blue-700 rounded-xl space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:bg-gradient-to-br dark:from-blue-900/20 dark:to-indigo-900/20 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 px-3 py-1">
                          ✨ New Asset #{index + 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100">
                          {assetTypes.find(t => t.value === asset.type)?.label || formatAssetTypeLabel(asset.type)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAsset(index)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          📦 Asset Type *
                        </Label>
                        <Select
                          value={asset.type}
                          onValueChange={(value) => {
                            handleUpdateAsset(index, "type", value);
                            // Auto-fill name based on type if name is empty
                            if (!asset.name) {
                              const typeName = assetTypes.find(t => t.value === value)?.label || formatAssetTypeLabel(value);
                              handleUpdateAsset(index, "name", typeName);
                            }
                          }}
                        >
                          <SelectTrigger className="border-2 font-medium" disabled={loadingAssetTypes}>
                            <SelectValue placeholder={loadingAssetTypes ? "Loading types..." : "Select asset type"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[400px] overflow-y-auto">
                            {loadingAssetTypes ? (
                              <div className="p-4 text-center text-sm text-slate-500">
                                <Loader className="h-4 w-4 animate-spin mx-auto mb-2" />
                                Loading asset types...
                              </div>
                            ) : assetTypes.length === 0 ? (
                              <div className="p-4 text-center text-sm text-slate-500">
                                No asset types available
                              </div>
                            ) : (
                              assetTypes.map((type) => (
                                <SelectItem 
                                  key={type.value} 
                                  value={type.value} 
                                  className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900"
                                >
                                  {type.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">Select the type of asset you want to add</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Asset Name *
                          <Badge variant="outline" className="text-xs">
                            Auto-filled
                          </Badge>
                        </Label>
                        <Input
                          value={asset.name}
                          onChange={(e) =>
                            handleUpdateAsset(index, "name", e.target.value)
                          }
                          placeholder="e.g., Facebook, Instagram"
                          className="bg-slate-100 dark:bg-slate-800"
                        />
                        <p className="text-xs text-slate-500">Default template asset name</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          Custom Name
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                            Optional
                          </Badge>
                        </Label>
                        <Input
                          value={asset.customName}
                          onChange={(e) =>
                            handleUpdateAsset(index, "customName", e.target.value)
                          }
                          placeholder="Enter your custom name (e.g., My Company Facebook Page)"
                          className="border-blue-300 focus:border-blue-500"
                        />
                        <p className="text-xs text-blue-600">💡 If provided, this custom name will be used instead of the default</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          🔗 URL
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Input
                          value={asset.url}
                          onChange={(e) =>
                            handleUpdateAsset(index, "url", e.target.value)
                          }
                          placeholder="https://example.com/your-asset"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500">Link to the asset (if applicable)</p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label className="flex items-center gap-2">
                          📝 Description
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        </Label>
                        <Textarea
                          value={asset.description}
                          onChange={(e) =>
                            handleUpdateAsset(index, "description", e.target.value)
                          }
                          placeholder="Add any notes or special instructions for this asset..."
                          rows={2}
                          className="resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          🗓️ Posting Frequency (per month)
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                            {asset.defaultPostingFrequency}x
                          </Badge>
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            value={asset.defaultPostingFrequency}
                            onChange={(e) =>
                              handleUpdateAsset(
                                index,
                                "defaultPostingFrequency",
                                parseInt(e.target.value) || 3
                              )
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-slate-600">tasks/month</span>
                        </div>
                        <p className="text-xs text-slate-500">Recommended: 3-7 tasks per month</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          ⏱️ Duration (minutes)
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                            {asset.defaultIdealDurationMinutes}min
                          </Badge>
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="5"
                            max="480"
                            step="5"
                            value={asset.defaultIdealDurationMinutes}
                            onChange={(e) =>
                              handleUpdateAsset(
                                index,
                                "defaultIdealDurationMinutes",
                                parseInt(e.target.value) || 30
                              )
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-slate-600">minutes</span>
                        </div>
                        <p className="text-xs text-slate-500">Estimated time to complete each task</p>
                      </div>

                      <div className="flex items-center space-x-2 col-span-2">
                        <Checkbox
                          id={`required-${index}`}
                          checked={asset.isRequired}
                          onCheckedChange={(checked) =>
                            handleUpdateAsset(index, "isRequired", checked)
                          }
                        />
                        <Label htmlFor={`required-${index}`} className="cursor-pointer">
                          This asset is required
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}

                <Button onClick={handleAddAsset} variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Asset
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Replace Assets Tab */}
          <TabsContent value="replace" className="space-y-4 mt-4">
            {!currentTemplate.sitesAssets || currentTemplate.sitesAssets.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No assets available to replace</p>
              </div>
            ) : replacements.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <Plus className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No replacements added yet</p>
                <Button onClick={handleAddReplacement} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Replacement
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {replacements.map((replacement, index) => {
                  const selectedOldAsset = currentTemplate.sitesAssets?.find(
                    (a: any) => a.id === replacement.oldAssetId
                  );
                  return (
                  <div
                    key={index}
                    className="p-4 border border-amber-200 dark:border-amber-700 rounded-lg space-y-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:bg-gradient-to-br dark:from-amber-900/20 dark:to-orange-900/20 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                          Replacement #{index + 1}
                        </Badge>
                        {selectedOldAsset && (
                          <span className="text-xs text-slate-500">
                            Replacing: <span className="font-semibold">{selectedOldAsset.name}</span>
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveReplacement(index)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Replace Asset *</Label>
                        <Select
                          value={replacement.oldAssetId.toString()}
                          onValueChange={(value) =>
                            handleUpdateReplacement(
                              index,
                              "oldAssetId",
                              parseInt(value)
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currentTemplate.sitesAssets.map((asset: any) => (
                              <SelectItem key={asset.id} value={asset.id.toString()}>
                                {asset.name} ({asset.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>New Asset Name *</Label>
                        <Input
                          value={replacement.newAssetName}
                          onChange={(e) =>
                            handleUpdateReplacement(
                              index,
                              "newAssetName",
                              e.target.value
                            )
                          }
                          placeholder="New asset name"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>New Asset URL</Label>
                        <Input
                          value={replacement.newAssetUrl}
                          onChange={(e) =>
                            handleUpdateReplacement(
                              index,
                              "newAssetUrl",
                              e.target.value
                            )
                          }
                          placeholder="https://..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Posting Frequency (per month)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          value={replacement.defaultPostingFrequency}
                          onChange={(e) =>
                            handleUpdateReplacement(
                              index,
                              "defaultPostingFrequency",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
                })}

                <Button onClick={handleAddReplacement} variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Replacement
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {(newAssets.length > 0 || replacements.length > 0) && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-blue-900 dark:text-blue-300">
                Changes Summary
              </h4>
            </div>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {customTemplateName.trim() && (
                <p>• Custom template name: <span className="font-semibold">"{customTemplateName}"</span></p>
              )}
              {newAssets.length > 0 && (
                <p>• Will add {newAssets.length} new asset(s)</p>
              )}
              {replacements.length > 0 && (
                <p>• Will replace {replacements.length} existing asset(s)</p>
              )}
              <p>• Will create a custom template for this client</p>
              <p>• All settings will be preserved</p>
              <p>• Other clients using the same template will not be affected</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (newAssets.length === 0 && replacements.length === 0)}
            className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Customizing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Apply Customization
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
