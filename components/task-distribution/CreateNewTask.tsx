"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ListTodo, AlertCircle, CheckCircle, Loader, CalendarDays, ChevronDown, ChevronUp, Check, X } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ValidationErrors {
  cycleCount?: string
  dueDate?: string
  siteAssetTypes?: string
}

interface CreateNewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  clientId: string
}

const SITE_ASSET_TYPES = [
  { value: "social_site", label: "Social Site" },
  { value: "web2_site", label: "Web2 Site" },
  { value: "other_asset", label: "Other Asset" },
  { value: "graphics_design", label: "Graphics Design" },
  { value: "content_studio", label: "Content Studio" },
  { value: "content_writing", label: "Content Writing" },
  { value: "backlinks", label: "Backlinks" },
  { value: "completed_com", label: "Completed.com" },
  { value: "youtube_video_optimization", label: "YouTube Video Optimization" },
  { value: "monitoring", label: "Monitoring" },
  { value: "review_removal", label: "Review Removal" },
  { value: "summary_report", label: "Summary Report" },
  { value: "guest_posting", label: "Guest Posting" },
];

export function CreateNewTaskModal({ isOpen, onClose, onSuccess, clientId }: CreateNewTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [selectedSiteAssetTypes, setSelectedSiteAssetTypes] = useState<string[]>([])

  const validateForm = (formData: FormData): boolean => {
    const errors: ValidationErrors = {}
    const cycleCountRaw = formData.get("cycleCount") as string
    const dueDate = formData.get("dueDate") as string

    const cycleCount = parseInt(cycleCountRaw)

    if (!cycleCountRaw?.trim()) {
      errors.cycleCount = "Number of cycles is required"
    } else if (isNaN(cycleCount) || cycleCount < 1 || cycleCount > 100) {
      errors.cycleCount = "Number of cycles must be between 1 and 100"
    }

    if (!dueDate?.trim()) {
      errors.dueDate = "Due date is required"
    } else {
      const selectedDate = new Date(dueDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (selectedDate < today) {
        errors.dueDate = "Due date cannot be in the past"
      }
    }

    if (selectedSiteAssetTypes.length === 0) {
      errors.siteAssetTypes = "Please select at least one site asset type"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    if (!validateForm(formData)) {
      toast.error("Please fix the validation errors", {
        description: "Check the form fields and try again",
        icon: <AlertCircle className="h-4 w-4" />,
      })
      return
    }

    const cycleCount = parseInt(formData.get("cycleCount") as string)
    const dueDate = formData.get("dueDate") as string

    try {
      setLoading(true)

      const res = await fetch("/api/createnewtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          cycleCount,
          dueDate,
          siteAssetTypes: selectedSiteAssetTypes,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json) {
        throw new Error(json.message || "Unknown error occurred")
      }

      toast.success("Tasks created successfully!", {
        description: `${json.created} manual task(s) created`,
        icon: <CheckCircle className="h-4 w-4" />,
      })

      form.reset()
      setSelectedSiteAssetTypes([])
      setValidationErrors({})
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error("Failed to create tasks", {
        description: error.message || "Unexpected error",
        icon: <AlertCircle className="h-4 w-4" />,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string) => {
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSelectAll = () => {
    setSelectedSiteAssetTypes(SITE_ASSET_TYPES.map(type => type.value))
    if (validationErrors.siteAssetTypes) {
      setValidationErrors(prev => ({ ...prev, siteAssetTypes: undefined }))
    }
  }

  const handleClearAll = () => {
    setSelectedSiteAssetTypes([])
  }

  const handleSiteAssetTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setSelectedSiteAssetTypes(prev => [...prev, type])
    } else {
      setSelectedSiteAssetTypes(prev => prev.filter(t => t !== type))
    }
    if (validationErrors.siteAssetTypes) {
      setValidationErrors(prev => ({ ...prev, siteAssetTypes: undefined }))
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setSelectedSiteAssetTypes([])
      setValidationErrors({})
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-sky-600 to-cyan-600 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <ListTodo className="h-5 w-5" />
              </div>
              <span>Create New Tasks</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 pt-1">
              Configure and schedule new tasks for the client
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pt-4">
          <div className="p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl border border-sky-200 dark:border-sky-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <ListTodo className="w-5 h-5 text-sky-600" />
                </div>
                <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                  Total Tasks to Create
                </span>
              </div>
              <span className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                {selectedSiteAssetTypes.length}
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh] px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-sm font-medium">Due Date *</Label>
              <div className="relative">
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  className={cn(
                    "h-10 pl-3 pr-10",
                    validationErrors.dueDate && "border-destructive"
                  )}
                  onChange={() => handleInputChange("dueDate")}
                />
                <CalendarDays className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              {validationErrors.dueDate && (
                <ErrorText text={validationErrors.dueDate} />
              )}
            </div>
            
            {/* Hidden input for cycleCount */}
            <input type="hidden" name="cycleCount" value="1" />
            
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-8 gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs h-8 gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear All
                </Button>
              </div>
              
              <div className="space-y-2">
                {SITE_ASSET_TYPES.map((type) => (
                  <div
                    key={type.value}
                    className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all duration-200"
                  >
                    <Label className="font-medium text-gray-700 dark:text-gray-300 text-sm flex-1 cursor-pointer">
                      {type.label}
                    </Label>
                    <Checkbox
                      id={`asset-${type.value}`}
                      checked={selectedSiteAssetTypes.includes(type.value)}
                      onCheckedChange={(checked) => 
                        handleSiteAssetTypeChange(type.value, checked === true)
                      }
                      className="h-5 w-5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  </div>
                ))}
              </div>
              
              {validationErrors.siteAssetTypes && (
                <div className="mt-3">
                  <ErrorText text={validationErrors.siteAssetTypes} />
                </div>
              )}
            </div>
          </form>
        </ScrollArea>

        <div className="border-t bg-muted/30 px-6 py-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-w-[100px] h-11 font-semibold"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading || selectedSiteAssetTypes.length === 0}
            className="min-w-[140px] h-11 font-semibold bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 gap-2"
            onClick={(e) => {
              const form = e.currentTarget.closest('form');
              if (form) form.requestSubmit();
            }}
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <ListTodo className="h-5 w-5" />
                Create Tasks
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Reusable error component
function ErrorText({ text }: { text: string }) {
  return (
    <p className="text-sm text-destructive flex items-center gap-1.5 mt-1.5 font-medium">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </p>
  )
}