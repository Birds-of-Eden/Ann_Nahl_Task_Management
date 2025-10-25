// components/clients/clientsID/template-customization/customize-dialog.tsx
"use client";

import { useState } from "react";
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

const ASSET_TYPES = [
  { value: "social_site", label: "Social Site" },
  { value: "web2_site", label: "Web 2.0 Site" },
  { value: "other_asset", label: "Other Asset" },
  { value: "graphics_design", label: "Graphics Design" },
  { value: "content_writing", label: "Content Writing" },
  { value: "youtube_video_optimization", label: "YouTube Video" },
  { value: "guest_posting", label: "Guest Posting" },
];

interface NewAsset {
  type: string;
  name: string;
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
  const [newAssets, setNewAssets] = useState<NewAsset[]>([]);
  const [replacements, setReplacements] = useState<Replacement[]>([]);

  const handleAddAsset = () => {
    setNewAssets([
      ...newAssets,
      {
        type: "social_site",
        name: "",
        url: "",
        description: "",
        isRequired: true,
        defaultPostingFrequency: 4,
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Customize Template for {clientName}
          </DialogTitle>
          <DialogDescription>
            Add new assets or replace existing ones. This will create a custom template for this client only.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="add" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add New Assets</TabsTrigger>
            <TabsTrigger value="replace">Replace Assets</TabsTrigger>
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
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3 bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Asset #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAsset(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Asset Type *</Label>
                        <Select
                          value={asset.type}
                          onValueChange={(value) =>
                            handleUpdateAsset(index, "type", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Asset Name *</Label>
                        <Input
                          value={asset.name}
                          onChange={(e) =>
                            handleUpdateAsset(index, "name", e.target.value)
                          }
                          placeholder="e.g., Instagram Profile"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>URL</Label>
                        <Input
                          value={asset.url}
                          onChange={(e) =>
                            handleUpdateAsset(index, "url", e.target.value)
                          }
                          placeholder="https://..."
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          value={asset.description}
                          onChange={(e) =>
                            handleUpdateAsset(index, "description", e.target.value)
                          }
                          placeholder="Optional description"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Posting Frequency (per month)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          value={asset.defaultPostingFrequency}
                          onChange={(e) =>
                            handleUpdateAsset(
                              index,
                              "defaultPostingFrequency",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={asset.defaultIdealDurationMinutes}
                          onChange={(e) =>
                            handleUpdateAsset(
                              index,
                              "defaultIdealDurationMinutes",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
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
                {replacements.map((replacement, index) => (
                  <div
                    key={index}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3 bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Replacement #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveReplacement(index)}
                        className="h-8 w-8 p-0"
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
                ))}

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
