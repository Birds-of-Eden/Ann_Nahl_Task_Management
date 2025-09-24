"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"
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
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Social Media Profiles</h1>
        <p className="text-gray-500 mt-2">Add your social media profiles to enhance your online presence.</p>
      </div>

      <div className="space-y-4">
        {socialLinks.map((link, index) => (
          <div key={index} className="flex flex-col gap-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor={`platform-${index}`}>Platform</Label>
                <Select value={link.platform} onValueChange={(value) => updateSocialLink(index, "platform", value)}>
                  <SelectTrigger className="mt-1">
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
                <Label htmlFor={`url-${index}`}>URL</Label>
                <Input
                  id={`url-${index}`}
                  value={link.url}
                  onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                  placeholder="https://platform.com/username"
                  className="mt-1"
                />
              </div>

              {socialLinks.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeSocialLink(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`username-${index}`}>Username</Label>
                <Input
                  id={`username-${index}`}
                  value={link.username || ""}
                  onChange={(e) => updateSocialLink(index, "username", e.target.value)}
                  placeholder="Account username/handle"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`email-${index}`}>Email</Label>
                <Input
                  type="email"
                  id={`email-${index}`}
                  value={link.email || ""}
                  onChange={(e) => updateSocialLink(index, "email", e.target.value)}
                  placeholder="login@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`phone-${index}`}>Phone</Label>
                <Input
                  id={`phone-${index}`}
                  value={link.phone || ""}
                  onChange={(e) => updateSocialLink(index, "phone", e.target.value)}
                  placeholder="e.g. +1 555 123 4567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`password-${index}`}>Password</Label>
                <Input
                  type="password"
                  id={`password-${index}`}
                  value={link.password || ""}
                  onChange={(e) => updateSocialLink(index, "password", e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor={`notes-${index}`}>Notes</Label>
                <Input
                  id={`notes-${index}`}
                  value={link.notes || ""}
                  onChange={(e) => updateSocialLink(index, "notes", e.target.value)}
                  placeholder="Any additional info or recovery notes"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addSocialLink} className="w-full bg-transparent">
          <Plus className="h-4 w-4 mr-2" />
          Add Another Social Link
        </Button>
      </div>

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}
