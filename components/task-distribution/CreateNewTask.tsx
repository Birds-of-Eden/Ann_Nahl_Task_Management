"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ListTodo, AlertCircle, CheckCircle, Loader, CalendarDays } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"

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
  { value: "monthly_report", label: "Monthly Report" },
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-blue-600" />
            Create Manual Tasks
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-6">
                  {/* Cycle Count Field */}
                  <div className="grid gap-2">
                    <Label htmlFor="cycleCount">Number of Cycles *</Label>
                    {/* Always 1 cycle: keep input visible but fixed to 1 and disabled */}
                    <Input
                      id="cycleCount"
                      name="cycleCount_display"
                      type="number"
                      value={1}
                      disabled
                      className={validationErrors.cycleCount ? "border-red-500" : ""}
                    />
                    {/* Submit value through hidden input to satisfy server-side validation */}
                    <input type="hidden" name="cycleCount" value="1" />
                    {validationErrors.cycleCount && <ErrorText text={validationErrors.cycleCount} />}
                  </div>

                  {/* Due Date Field */}
                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">Due Date *</Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      className={validationErrors.dueDate ? "border-red-500" : ""}
                      onChange={() => handleInputChange("dueDate")}
                      required
                    />
                    {validationErrors.dueDate && <ErrorText text={validationErrors.dueDate} />}
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <CalendarDays className="h-4 w-4" />
                      <span>Selected due date will be used for the created tasks</span>
                    </div>
                  </div>

                  {/* Site Asset Types Selection */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Site Asset Types *</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAll}
                          className="text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleClearAll}
                          className="text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto border rounded-md p-3">
                      {SITE_ASSET_TYPES.map((type) => (
                        <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSiteAssetTypes.includes(type.value)}
                            onChange={(e) => handleSiteAssetTypeChange(type.value, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{type.label}</span>
                        </label>
                      ))}
                    </div>
                    {validationErrors.siteAssetTypes && <ErrorText text={validationErrors.siteAssetTypes} />}
                    <p className="text-sm text-slate-500">
                      Select the types of tasks you want to create for each cycle
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                        Creating Tasks...
                      </>
                    ) : (
                      <>
                        <ListTodo className="h-4 w-4 mr-2" />
                        Create Tasks
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Reusable error component
function ErrorText({ text }: { text: string }) {
  return (
    <p className="text-sm text-red-500 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      {text}
    </p>
  )
}