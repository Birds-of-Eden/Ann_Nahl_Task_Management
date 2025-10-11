"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Download,
  CheckCircle,
  ArrowLeft,
  User,
  Globe,
  Package,
  FileText,
  Image as ImageIcon,
  Share2,
  BookUser,
  Link as LinkIcon,
  PlusCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building,
  BadgeCheck,
  Sparkles,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AssignmentPreview } from "./assignment-preview";
import { useAuth } from "@/context/auth-context";

type AMUser = { id: string; name: string | null; email: string | null };

export function DataEntryReviewInfo({ formData, onPrevious }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [fetchedData, setFetchedData] = useState({
    packageName: "",
    templateName: "",
    amName: "",
  });
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [pkgRes, tplRes, amsRes] = await Promise.all([
          formData.packageId
            ? fetch(`/api/packages/${formData.packageId}`)
            : Promise.resolve(null),
          formData.templateId
            ? fetch(`/api/packages/templates/${formData.templateId}`)
            : Promise.resolve(null),
          fetch(`/api/users?role=am&limit=100`, { cache: "no-store" }),
        ]);

        const pkgJson = pkgRes ? await pkgRes.json() : null;
        const tplJson = tplRes ? await tplRes.json() : null;
        const amsJson = amsRes ? await amsRes.json() : { data: [] };

        if (!mounted) return;

        const amsList: AMUser[] = (amsJson?.users ?? amsJson?.data ?? [])
          .filter((u: any) => u?.role?.name === "am")
          .map((u: any) => ({
            id: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
          }));

        const foundAm = formData.amId
          ? amsList.find((u) => u.id === formData.amId)
          : null;
        const amName = foundAm
          ? foundAm.name || foundAm.email || foundAm.id
          : formData.amId || "";

        setFetchedData({
          packageName: pkgJson?.name || "",
          templateName: tplJson?.name || "",
          amName: amName,
        });
      } catch (error) {
        console.error("Failed to fetch review data:", error);
        toast.warning("Could not fetch some details like package or AM name.");
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [formData.packageId, formData.templateId, formData.amId]);

  const sections = useMemo(() => {
    const reviewSections = [];

    // Personal & Work Info
    reviewSections.push({
      id: "personal",
      icon: User,
      title: "Personal & Work Information",
      gradient: "from-blue-50 to-cyan-50",
      items: [
        { label: "Full Name", value: formData.name, icon: User },
        {
          label: "Birth Date",
          value: formData.birthdate
            ? new Date(formData.birthdate).toLocaleDateString()
            : null,
          icon: Calendar,
        },
        { label: "Gender", value: formData.gender, icon: User },
        { label: "Location", value: formData.location, icon: MapPin },
        { label: "Company", value: formData.company, icon: Building },
        { label: "Designation", value: formData.designation, icon: BadgeCheck },
        { label: "Status", value: formData.status, icon: FileText },
        { label: "Account Manager", value: fetchedData.amName, icon: User },
      ].filter((item) => item.value),
    });

    // Websites
    reviewSections.push({
      id: "websites",
      icon: Globe,
      title: "Website Information",
      gradient: "from-purple-50 to-violet-50",
      items: [
        { label: "Primary Website", value: formData.website, icon: Globe },
        { label: "Secondary Website", value: formData.website2, icon: Globe },
        { label: "Third Website", value: formData.website3, icon: Globe },
        {
          label: "Company Website",
          value: formData.companywebsite,
          icon: Building,
        },
        {
          label: "Company Address",
          value: formData.companyaddress,
          icon: MapPin,
        },
      ].filter((item) => item.value),
    });

    // Project Details
    reviewSections.push({
      id: "project",
      icon: Package,
      title: "Project Details",
      gradient: "from-green-50 to-emerald-50",
      items: [
        {
          label: "Package",
          value: fetchedData.packageName || formData.packageId,
          icon: Package,
        },
        {
          label: "Template",
          value: fetchedData.templateName || formData.templateId,
          icon: FileText,
        },
        {
          label: "Start Date",
          value: formData.startDate
            ? new Date(formData.startDate).toLocaleDateString()
            : null,
          icon: Calendar,
        },
        {
          label: "Due Date",
          value: formData.dueDate
            ? new Date(formData.dueDate).toLocaleDateString()
            : null,
          icon: Calendar,
        },
        {
          label: "Progress",
          value:
            typeof formData.progress === "number"
              ? `${formData.progress}%`
              : null,
          icon: Clock,
        },
      ].filter((item) => item.value),
    });

    reviewSections.push({
      id: "articles",
      icon: FileText,
      title: "Article Topics",
      gradient: "from-purple-50 to-indigo-50",
      items: formData.articleTopics.map((topic: any, index: number) => ({
        label: `Topic ${index + 1}`,
        value: topic.topicname,
        icon: FileText,
      })),
    });

    // Contact & Credentials
    reviewSections.push({
      id: "contact",
      icon: BookUser,
      title: "Contact & Credentials",
      gradient: "from-amber-50 to-orange-50",
      items: [
        { label: "Email", value: formData.email, icon: Mail },
        { label: "Phone", value: formData.phone, icon: Phone },
        {
          label: "Password",
          value: formData.password ? "••••••••" : null,
          icon: FileText,
        },
        { label: "Recovery Email", value: formData.recoveryEmail, icon: Mail },
      ].filter((item) => item.value),
    });

    return reviewSections.filter((s) => s.items.length > 0);
  }, [formData, fetchedData]);

  const avatarPreviewUrl = useMemo(() => {
    if (formData?.profilePicture instanceof File) {
      return URL.createObjectURL(formData.profilePicture);
    }
    return formData.avatar || null;
  }, [formData?.profilePicture, formData.avatar]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const clientData = {
        name: formData.name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        company: formData.company,
        designation: formData.designation,
        location: formData.location,
        email: formData.email || null,
        phone: formData.phone || null,
        password: formData.password || null,
        recoveryEmail: formData.recoveryEmail || null,
        website: formData.website,
        website2: formData.website2,
        website3: formData.website3,
        companywebsite: formData.companywebsite,
        companyaddress: formData.companyaddress,
        biography: formData.biography,
        imageDrivelink: formData.imageDrivelink,
        avatar: formData.avatar || null,
        progress: formData.progress,
        status: formData.status,
        packageId: formData.packageId,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        articleTopics: formData.articleTopics || [],
        amId: formData.amId || null,
        socialLinks: formData.socialLinks || [],
        otherField: (formData.otherField || []).map((r: any) => ({
          title: String(r.title || ""),
          data: String(r.data || ""),
        })),
      };

      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientData),
      });

      const clientResult = await clientRes.json();

      if (!clientRes.ok) {
        toast.error(clientResult.error || "Failed to create client.");
        setIsSaving(false);
        return;
      }

      const createdClientId: string =
        clientResult?.id ?? clientResult?.client?.id ?? clientResult?.data?.id;

      toast.success("Client created successfully!");

      if (formData.templateId && createdClientId) {
        try {
          const assignment = {
            clientId: createdClientId,
            templateId: formData.templateId,
            status: "active",
            agentIds: user?.id ? [user.id] : [],
          };

          const assignmentRes = await fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assignment),
          });

          if (assignmentRes.ok) {
            toast.success(
              `Template "${
                fetchedData.templateName || formData.templateId
              }" assigned successfully!`
            );

            try {
              const createdAssignment = await assignmentRes.json();
              const createdTasks: any[] =
                createdAssignment?.tasks ||
                createdAssignment?.data?.tasks ||
                [];
              if (Array.isArray(createdTasks) && createdTasks.length > 0) {
                const now = new Date();
                const due = new Date(now);
                due.setDate(due.getDate() + 7);

                const distributeBody = {
                  clientId: createdClientId,
                  assignments: createdTasks.map((t: any) => ({
                    taskId: t.id,
                    agentId: user?.id,
                    note: "Auto-assigned to creator after onboarding",
                    dueDate: due.toISOString(),
                  })),
                };

                const distRes = await fetch("/api/tasks/distribute", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(distributeBody),
                });

                if (distRes.ok) {
                  toast.success(`Tasks assigned to ${user?.name} successfully.`);
                } else {
                  const j = await distRes.json().catch(() => ({}));
                  console.error("Distribute failed", j);
                  toast.warning(
                    "Template assigned but auto-assignment to your user failed."
                  );
                }
              }
            } catch (e) {
              console.error("Auto-assign to data_entry failed", e);
            }
          } else {
            toast.warning(
              "Client created but template assignment failed. You can assign it manually later."
            );
          }
        } catch {
          toast.warning(
            "Client created but template assignment failed. You can assign it manually later."
          );
        }
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred during submission.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 font-[Inter] text-slate-800">
        <div className="text-center max-w-md mx-auto space-y-8">
          {/* Minimal Icon Container */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 flex items-center justify-center rounded-full border-2 border-green-500 bg-green-50">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          <div className="space-y-3">
            {/* Simplified Title */}
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Submission Successful!
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Thank you for completing the onboarding process. Your client
              information has been saved successfully.
            </p>
          </div>

          {/* Minimal Button */}
          <div className="pt-4">
            <button
              onClick={() => router.push("/data_entry")}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-300 shadow-md"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ReviewSectionCard = ({
    icon: Icon,
    title,
    children,
    gradient = "from-blue-50 to-indigo-50",
  }: any) => (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 rounded-2xl hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
      <CardHeader className="relative space-y-0 py-6 px-6 border-b-0">
        <div
          className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-5`}
        />
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 relative">{children}</CardContent>
    </Card>
  );

  const InfoItem = ({ label, value, icon: Icon }: any) => {
    if (!value) return null;

    return (
      <div className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200">
        {Icon && (
          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
            <Icon className="w-4 h-4 text-slate-600 group-hover:text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
            {label}
          </span>
          <span className="text-slate-800 font-semibold text-sm leading-relaxed break-words">
            {value}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 p-4">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">Review & Confirm</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
          Review Client's Information For Data Entry
        </h1>
        <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Please review all the information below carefully. This will be used
          to create the client profile and assign the template.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Form Sections */}
        <div className="space-y-6">
          {sections.map((section: any) => (
            <ReviewSectionCard
              key={section.id}
              icon={section.icon}
              title={section.title}
              gradient={section.gradient}
            >
              <div className="space-y-3">
                {section.items.map((item: any, idx: number) => (
                  <InfoItem key={idx} {...item} />
                ))}
              </div>
            </ReviewSectionCard>
          ))}
        </div>

        {/* Right Column - Additional Content */}
        <div className="space-y-6">
          {/* Biography */}
          {formData.biography && (
            <ReviewSectionCard
              icon={FileText}
              title="Biography"
              gradient="from-cyan-50 to-blue-50"
            >
              <p className="text-slate-700 leading-relaxed text-base bg-white p-4 rounded-xl border border-slate-200">
                {formData.biography}
              </p>
            </ReviewSectionCard>
          )}

          {/* Social Links */}
          {formData.socialLinks && formData.socialLinks.length > 0 && (
            <ReviewSectionCard
              icon={Share2}
              title="Social Media Profiles"
              gradient="from-rose-50 to-pink-50"
            >
              <div className="space-y-3">
                {formData.socialLinks.map(
                  (link: any, index: number) =>
                    link.url && (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
                      >
                        <Badge
                          variant="secondary"
                          className="font-medium bg-slate-100 text-slate-700 border-slate-200 px-3 py-1.5"
                        >
                          {link.platform}
                        </Badge>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline truncate flex-1 text-sm font-medium"
                        >
                          {link.url.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )
                )}
              </div>
            </ReviewSectionCard>
          )}

          {/* Additional Information */}
          {formData.otherField && formData.otherField.length > 0 && (
            <ReviewSectionCard
              icon={PlusCircle}
              title="Additional Information"
              gradient="from-violet-50 to-purple-50"
            >
              <div className="space-y-3">
                {formData.otherField.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <p className="font-semibold text-slate-800 text-sm mb-2">
                      {item.title}
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.data}
                    </p>
                  </div>
                ))}
              </div>
            </ReviewSectionCard>
          )}

          {/* Assets & Images */}
          {(avatarPreviewUrl || formData.imageDrivelink) && (
            <ReviewSectionCard
              icon={ImageIcon}
              title="Image Drive Link"
              gradient="from-amber-50 to-orange-50"
            >
              <div className="space-y-4">
                {avatarPreviewUrl && (
                  <div className="text-center">
                    <h4 className="text-sm font-medium text-slate-600 mb-3">
                      Profile Picture
                    </h4>
                    <div className="inline-flex p-2 bg-white rounded-2xl shadow-sm border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarPreviewUrl}
                        alt="Profile preview"
                        className="h-20 w-20 rounded-xl object-cover shadow-md"
                      />
                    </div>
                  </div>
                )}
                {formData.imageDrivelink && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-2">
                      Image Gallery
                    </h4>
                    <a
                      href={formData.imageDrivelink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:underline font-medium bg-white p-3 rounded-xl border border-slate-200 w-full"
                    >
                      <LinkIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate text-sm">
                        {formData.imageDrivelink}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </ReviewSectionCard>
          )}
        </div>
      </div>
      {/* Assignment Preview */}
      {formData.templateId && (
        <ReviewSectionCard
          icon={Package}
          title="Template Assignment Preview"
          gradient="from-indigo-50 to-blue-50"
        >
          <AssignmentPreview
            templateId={formData.templateId}
            packageId={formData.packageId || ""}
            templateName={fetchedData.templateName}
          />
        </ReviewSectionCard>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-slate-200">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-3 rounded-xl transition-all duration-300"
          size="lg"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Previous
        </Button>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Client...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirm & Create Client
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
