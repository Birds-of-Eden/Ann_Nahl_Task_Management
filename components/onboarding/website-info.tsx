"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { StepProps } from "@/types/onboarding"
import { Globe, Link as LinkIcon } from "lucide-react"

export function WebsiteInfo({ formData, updateFormData, onNext, onPrevious }: StepProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg mb-4">
          <Globe className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent">
          Website Information
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Please provide your website URLs to help us understand your online presence.
        </p>
      </div>

      {/* Websites Card */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-xl border border-blue-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <LinkIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Your Websites</h2>
        </div>

        <div className="space-y-6">
          <div className="group">
            <Label htmlFor="website" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              Primary Website
            </Label>
            <Input
              id="website"
              value={formData.website || ""}
              onChange={(e) => updateFormData({ website: e.target.value })}
              placeholder="https://example.com"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 rounded-xl"
              inputMode="url"
            />
          </div>

          <div className="group">
            <Label htmlFor="website2" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-500" />
              Secondary Website
            </Label>
            <Input
              id="website2"
              value={formData.website2 || ""}
              onChange={(e) => updateFormData({ website2: e.target.value })}
              placeholder="https://example2.com"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all duration-200 rounded-xl"
              inputMode="url"
            />
          </div>

          <div className="group">
            <Label htmlFor="website3" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-500" />
              Third Website
            </Label>
            <Input
              id="website3"
              value={formData.website3 || ""}
              onChange={(e) => updateFormData({ website3: e.target.value })}
              placeholder="https://example3.com"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 transition-all duration-200 rounded-xl"
              inputMode="url"
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 hover:text-blue-700 hover:border-blue-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={onNext}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
        >
          Continue to Next Step
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
