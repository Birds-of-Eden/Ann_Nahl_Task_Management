"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Share2, Mail, Phone, Lock, FileText } from "lucide-react"
import type { StepProps } from "@/types/onboarding"

interface SocialLink {
  platform: string
  url: string
  username?: string
  email?: string
  phone?: string
  password?: string
  notes?: string
}

export function SocialMediaInfo({ formData, updateFormData, onNext, onPrevious }: StepProps) {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    formData.socialLinks || [
      { platform: "", url: "", username: "", email: "", phone: "", password: "", notes: "" },
    ]
  )

  // Attempt to fetch existing social media links if a client id is present
  useEffect(() => {
    const existingId = (formData as any)?.id || (formData as any)?.clientId
    // Only fetch if we have an id and current local state is empty or placeholder
    const shouldFetch = Boolean(existingId) && (!formData.socialLinks || formData.socialLinks.length === 0)
    if (!shouldFetch) return

    let alive = true
    const run = async () => {
      try {
        const res = await fetch(`/api/clients?id=${existingId}`, { cache: "no-store" })
        if (!res.ok) return
        const client = await res.json()
        const links = Array.isArray(client?.socialMedias)
          ? client.socialMedias.map((sm: any) => ({
              platform: sm.platform || "",
              url: sm.url || "",
              username: sm.username || "",
              email: sm.email || "",
              phone: sm.phone || "",
              password: sm.password || "",
              notes: sm.notes || "",
            }))
          : []
        if (!alive) return
        if (links.length > 0) {
          setSocialLinks(links)
          updateFormData({ socialLinks: links })
        }
      } catch (e) {
        // Silent fail; we keep whatever is in formData
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [formData, updateFormData])

  // Frontend-defined platform options (string values stored to DB)
  const socialPlatforms = [
    "FACEBOOK",
    "TWITTER",
    "INSTAGRAM",
    "LINKEDIN",
    "YOUTUBE",
    "TIKTOK",
    "DISCORD",
    "OTHER",
  ]

  const formatPlatformLabel = (value: string) =>
    value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

  const addSocialLink = () => {
    const newLinks = [
      ...socialLinks,
      { platform: "", url: "", username: "", email: "", phone: "", password: "", notes: "" },
    ]
    setSocialLinks(newLinks)
    updateFormData({ socialLinks: newLinks })
  }

  const removeSocialLink = (index: number) => {
    const newLinks = socialLinks.filter((_, i) => i !== index)
    setSocialLinks(newLinks)
    updateFormData({ socialLinks: newLinks })
  }

  const updateSocialLink = (index: number, field: keyof SocialLink, value: string) => {
    const newLinks = [...socialLinks]
    newLinks[index] = { ...newLinks[index], [field]: value }
    setSocialLinks(newLinks)
    updateFormData({ socialLinks: newLinks })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg mb-4">
          <Share2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 bg-clip-text text-transparent">
          Social Media Profiles
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Add your social media profiles to enhance your online presence and connectivity.
        </p>
      </div>

      <div className="space-y-6">
        {socialLinks.map((link, index) => (
          <div key={index} className="bg-gradient-to-br from-white to-pink-50/30 rounded-2xl shadow-lg border border-pink-100 p-6 space-y-4 hover:shadow-xl transition-all duration-300">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor={`platform-${index}`} className="text-sm font-semibold text-gray-700">Platform</Label>
                <Select value={link.platform} onValueChange={(value) => updateSocialLink(index, "platform", value)}>
                  <SelectTrigger className="mt-2 h-12 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {socialPlatforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {formatPlatformLabel(platform)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-2">
                <Label htmlFor={`url-${index}`} className="text-sm font-semibold text-gray-700">URL</Label>
                <Input
                  id={`url-${index}`}
                  value={link.url}
                  onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                  placeholder="https://platform.com/username"
                  className="mt-2 h-12 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl"
                  inputMode="url"
                />
              </div>

              {socialLinks.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeSocialLink(index)}
                  className="h-12 w-12 text-red-500 hover:text-white hover:bg-red-500 border-2 border-red-300 hover:border-red-500 rounded-xl transition-all duration-200"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`username-${index}`} className="text-sm font-semibold text-gray-700">Username</Label>
                <Input
                  id={`username-${index}`}
                  value={link.username || ""}
                  onChange={(e) => updateSocialLink(index, "username", e.target.value)}
                  placeholder="Account username/handle"
                  className="mt-2 h-11 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor={`email-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-pink-500" />
                  Email
                </Label>
                <Input
                  type="email"
                  id={`email-${index}`}
                  value={link.email || ""}
                  onChange={(e) => updateSocialLink(index, "email", e.target.value)}
                  placeholder="login@example.com"
                  className="mt-2 h-11 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl"
                  inputMode="email"
                />
              </div>
              <div>
                <Label htmlFor={`phone-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-pink-500" />
                  Phone
                </Label>
                <Input
                  id={`phone-${index}`}
                  value={link.phone || ""}
                  onChange={(e) => updateSocialLink(index, "phone", e.target.value)}
                  placeholder="e.g. +1 555 123 4567"
                  className="mt-2 h-11 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl"
                  inputMode="tel"
                />
              </div>
              <div>
                <Label htmlFor={`password-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-pink-500" />
                  Password
                </Label>
                <Input
                  type="password"
                  id={`password-${index}`}
                  value={link.password || ""}
                  onChange={(e) => updateSocialLink(index, "password", e.target.value)}
                  placeholder="••••••••"
                  className="mt-2 h-11 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor={`notes-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-pink-500" />
                  Notes
                </Label>
                <Input
                  id={`notes-${index}`}
                  value={link.notes || ""}
                  onChange={(e) => updateSocialLink(index, "notes", e.target.value)}
                  placeholder="Any additional info or recovery notes"
                  className="mt-2 h-11 border-2 border-gray-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-xl"
                />
              </div>
            </div>
          </div>
        ))}

        <Button 
          type="button" 
          onClick={addSocialLink} 
          className="w-full h-14 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Another Social Link
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-pink-50 hover:to-rose-50 hover:text-pink-700 hover:border-pink-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={onNext}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 hover:from-pink-700 hover:via-rose-700 hover:to-red-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
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
