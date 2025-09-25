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
    Briefcase,
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

type AMUser = { id: string; name: string | null; email: string | null };

export function DataEntryReviewInfo({ formData, onPrevious }: any) {
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [fetchedData, setFetchedData] = useState({ packageName: "", templateName: "", amName: "" });
    const router = useRouter();

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                const [pkgRes, tplRes, amsRes] = await Promise.all([
                    formData.packageId ? fetch(`/api/packages/${formData.packageId}`) : Promise.resolve(null),
                    formData.templateId ? fetch(`/api/packages/templates/${formData.templateId}`) : Promise.resolve(null),
                    fetch(`/api/users?role=am&limit=100`, { cache: "no-store" })
                ]);

                const pkgJson = pkgRes ? await pkgRes.json() : null;
                const tplJson = tplRes ? await tplRes.json() : null;
                const amsJson = amsRes ? await amsRes.json() : { data: [] };

                if (!mounted) return;

                const amsList: AMUser[] = (amsJson?.users ?? amsJson?.data ?? [])
                    .filter((u: any) => u?.role?.name === "am")
                    .map((u: any) => ({ id: u.id, name: u.name ?? null, email: u.email ?? null }));

                const foundAm = formData.amId ? amsList.find(u => u.id === formData.amId) : null;
                const amName = foundAm ? (foundAm.name || foundAm.email || foundAm.id) : (formData.amId || "");

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
        return () => { mounted = false; };
    }, [formData.packageId, formData.templateId, formData.amId]);

    const sections = useMemo(() => {
        const reviewSections = [];

        // Personal & Work Info
        reviewSections.push({
            id: 'personal',
            icon: User,
            title: "Personal & Work Information",
            gradient: "from-blue-50 to-cyan-50",
            items: [
                { label: "Full Name", value: formData.name, icon: User },
                { label: "Birth Date", value: formData.birthdate ? new Date(formData.birthdate).toLocaleDateString() : null, icon: Calendar },
                { label: "Gender", value: formData.gender, icon: User },
                { label: "Location", value: formData.location, icon: MapPin },
                { label: "Company", value: formData.company, icon: Building },
                { label: "Designation", value: formData.designation, icon: BadgeCheck },
                { label: "Status", value: formData.status, icon: FileText },
                { label: "Account Manager", value: fetchedData.amName, icon: User },
            ].filter(item => item.value),
        });
        
        // Websites
        reviewSections.push({
            id: 'websites',
            icon: Globe,
            title: "Website Information",
            gradient: "from-purple-50 to-violet-50",
            items: [
                { label: "Primary Website", value: formData.website, icon: Globe },
                { label: "Secondary Website", value: formData.website2, icon: Globe },
                { label: "Third Website", value: formData.website3, icon: Globe },
                { label: "Company Website", value: formData.companywebsite, icon: Building },
                { label: "Company Address", value: formData.companyaddress, icon: MapPin },
            ].filter(item => item.value),
        });

        // Project Details
        reviewSections.push({
            id: 'project',
            icon: Package,
            title: "Project Details",
            gradient: "from-green-50 to-emerald-50",
            items: [
                { label: "Package", value: fetchedData.packageName || formData.packageId, icon: Package },
                { label: "Template", value: fetchedData.templateName || formData.templateId, icon: FileText },
                { label: "Start Date", value: formData.startDate ? new Date(formData.startDate).toLocaleDateString() : null, icon: Calendar },
                { label: "Due Date", value: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : null, icon: Calendar },
                { label: "Progress", value: typeof formData.progress === "number" ? `${formData.progress}%` : null, icon: Clock },
            ].filter(item => item.value),
        });
        
        // Contact & Credentials
        reviewSections.push({
            id: 'contact',
            icon: BookUser,
            title: "Contact & Credentials",
            gradient: "from-amber-50 to-orange-50",
            items: [
                 { label: "Email", value: formData.email, icon: Mail },
                 { label: "Phone", value: formData.phone, icon: Phone },
                 { label: "Password", value: formData.password ? "••••••••" : null, icon: FileText },
                 { label: "Recovery Email", value: formData.recoveryEmail, icon: Mail },
            ].filter(item => item.value),
        });
        
        return reviewSections.filter(s => s.items.length > 0);
    }, [formData, fetchedData]);

    const avatarPreviewUrl = useMemo(() => {
        if (formData?.profilePicture instanceof File) {
            return URL.createObjectURL(formData.profilePicture);
        }
        return formData.avatar || null;
    }, [formData?.profilePicture, formData.avatar]);

    const handleDownload = () => {
        const dataStr = JSON.stringify(formData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `client-data-${formData.name}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Data downloaded successfully!");
    };

    const handleSubmit = async () => {
        setIsSaving(true);
      
        try {
            const clientData = {
                name: formData.name,
                birthdate: formData.birthdate,
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
                amId: formData.amId || null,
                socialLinks: formData.socialLinks || [],
                otherField: (formData.otherField || []).map((r: any) => ({ title: String(r.title || ""), data: String(r.data || "") })),
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

            const createdClientId: string = clientResult?.id ?? clientResult?.client?.id ?? clientResult?.data?.id;

            toast.success("Client created successfully!");

            if (formData.templateId && createdClientId) {
                try {
                    const assignment = {
                        id: `assignment-${Date.now()}`,
                        templateId: formData.templateId,
                        clientId: createdClientId,
                        assignedAt: new Date().toISOString(),
                        status: "active",
                    };

                    const assignmentRes = await fetch("/api/assignments", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(assignment),
                    });

                    if (assignmentRes.ok) {
                        toast.success(`Template "${fetchedData.templateName || formData.templateId}" assigned successfully!`);

                        try {
                            const createdAssignment = await assignmentRes.json();
                            const createdTasks: any[] = createdAssignment?.tasks || createdAssignment?.data?.tasks || [];
                            if (Array.isArray(createdTasks) && createdTasks.length > 0) {
                                const usersRes = await fetch(`/api/users?role=data_entry&limit=50`, { cache: "no-store" });
                                const usersJson = await usersRes.json().catch(() => ({}));
                                const dataEntryUsers: any[] = (usersJson?.users ?? usersJson?.data ?? []).filter(
                                    (u: any) => u?.role?.name?.toLowerCase() === "data_entry"
                                );

                                if (dataEntryUsers.length === 0) {
                                    toast.warning("No data_entry users found. You can manually distribute tasks later.");
                                } else {
                                    const dataEntryAssignee = dataEntryUsers[0];
                                    const now = new Date();
                                    const due = new Date(now);
                                    due.setDate(due.getDate() + 7);

                                    const distributeBody = {
                                        clientId: createdClientId,
                                        assignments: createdTasks.map((t: any) => ({
                                            taskId: t.id,
                                            agentId: dataEntryAssignee.id,
                                            note: "Auto-assigned to data_entry after onboarding",
                                            dueDate: due.toISOString(),
                                        })),
                                    };

                                    const distRes = await fetch("/api/tasks/distribute", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(distributeBody),
                                    });

                                    if (distRes.ok) {
                                        toast.success("Tasks routed to data_entry successfully.");
                                    } else {
                                        const j = await distRes.json().catch(() => ({}));
                                        console.error("Distribute failed", j);
                                        toast.warning("Template assigned but auto-distribution to data_entry failed.");
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Auto-assign to data_entry failed", e);
                        }
                    } else {
                        toast.warning("Client created but template assignment failed. You can assign it manually later.");
                    }
                } catch {
                    toast.warning("Client created but template assignment failed. You can assign it manually later.");
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
            <div className="min-h-[60vh] flex items-center justify-center px-4">
                <div className="text-center space-y-8 max-w-2xl mx-auto">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-full shadow-2xl">
                            <CheckCircle className="h-20 w-20 text-white" />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h2 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            Submission Successful!
                        </h2>
                        <p className="text-slate-600 text-lg leading-relaxed">
                            Thank you for completing the onboarding process. Your client information has been saved successfully and is ready for processing.
                        </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        <Button 
                            onClick={() => router.push("/admin/clients")} 
                            size="lg"
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3 rounded-xl"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Back to Dashboard
                        </Button>
                        <Button 
                            onClick={handleDownload} 
                            variant="outline"
                            size="lg"
                            className="border-slate-300 hover:bg-slate-50 text-slate-700 px-8 py-3 rounded-xl transition-all duration-300"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Download JSON
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const ReviewSectionCard = ({ icon: Icon, title, children, gradient = "from-blue-50 to-indigo-50" }: any) => (
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 rounded-2xl hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
            <CardHeader className="relative space-y-0 py-6 px-6 border-b-0">
                <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-5`} />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                        {title}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-6 relative">
                {children}
            </CardContent>
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
                    Please review all the information below carefully. This will be used to create the client profile and assign the template.
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
                        <ReviewSectionCard icon={FileText} title="Biography" gradient="from-cyan-50 to-blue-50">
                            <p className="text-slate-700 leading-relaxed text-base bg-white p-4 rounded-xl border border-slate-200">
                                {formData.biography}
                            </p>
                        </ReviewSectionCard>
                    )}

                    {/* Social Links */}
                    {formData.socialLinks && formData.socialLinks.length > 0 && (
                        <ReviewSectionCard icon={Share2} title="Social Media Profiles" gradient="from-rose-50 to-pink-50">
                            <div className="space-y-3">
                                {formData.socialLinks.map((link: any, index: number) => link.url && (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
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
                                            {link.url.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </ReviewSectionCard>
                    )}
                    
                    {/* Additional Information */}
                    {formData.otherField && formData.otherField.length > 0 && (
                         <ReviewSectionCard icon={PlusCircle} title="Additional Information" gradient="from-violet-50 to-purple-50">
                             <div className="space-y-3">
                                 {formData.otherField.map((item: any, index: number) => (
                                     <div key={index} className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
                                         <p className="font-semibold text-slate-800 text-sm mb-2">{item.title}</p>
                                         <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{item.data}</p>
                                     </div>
                                 ))}
                             </div>
                         </ReviewSectionCard>
                    )}

                    {/* Assets & Images */}
                    {(avatarPreviewUrl || formData.imageDrivelink) && (
                        <ReviewSectionCard icon={ImageIcon} title="Media Assets" gradient="from-amber-50 to-orange-50">
                             <div className="space-y-4">
                                {avatarPreviewUrl && (
                                    <div className="text-center">
                                        <h4 className="text-sm font-medium text-slate-600 mb-3">Profile Picture</h4>
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
                                         <h4 className="text-sm font-medium text-slate-600 mb-2">Image Gallery</h4>
                                         <a 
                                            href={formData.imageDrivelink} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:underline font-medium bg-white p-3 rounded-xl border border-slate-200 w-full"
                                         >
                                            <LinkIcon className="h-4 w-4 flex-shrink-0" />
                                            <span className="truncate text-sm">{formData.imageDrivelink}</span>
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
                <ReviewSectionCard icon={Package} title="Template Assignment Preview" gradient="from-indigo-50 to-blue-50">
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
                        onClick={handleDownload} 
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-3 rounded-xl"
                        size="lg"
                    >
                        <Download className="w-5 h-5 mr-2" />
                        Download
                    </Button>
                    
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

// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { toast } from "sonner";
// import { Download, CheckCircle, ArrowLeft, User, Globe, Package, FileText, Image as ImageIcon, Share2 } from "lucide-react";
// import { useRouter } from "next/navigation";
// import { AssignmentPreview } from "./assignment-preview";

// type AMUser = { id: string; name: string | null; email: string | null };

// export function DataEntryReviewInfo({ formData, onPrevious }: any) {
//   const [isSaving, setIsSaving] = useState(false);
//   const [isSubmitted, setIsSubmitted] = useState(false);
//   const [packageName, setPackageName] = useState("");
//   const [templateName, setTemplateName] = useState("");
//   const [ams, setAms] = useState<AMUser[]>([]);
//   const [amName, setAmName] = useState<string | null>(null);
//   const router = useRouter();

//   // Resolve AM list + names for display
//   useEffect(() => {
//     let mounted = true;
//     const load = async () => {
//       try {
//         // packages/templates
//         if (formData.packageId) {
//           const r = await fetch(`/api/packages/${formData.packageId}`);
//           const j = await r.json();
//           if (mounted && j?.name) setPackageName(j.name);
//         }
//         if (formData.templateId) {
//           const r = await fetch(`/api/packages/templates/${formData.templateId}`);
//           const j = await r.json();
//           if (mounted && j?.name) setTemplateName(j.name);
//         }

//         // AMs
//         const res = await fetch(`/api/users?role=am&limit=100`, { cache: "no-store" });
//         const json = await res.json();
//         const raw = (json?.users ?? json?.data ?? []) as any[];
//         const list: AMUser[] = raw
//           .filter((u) => u?.role?.name === "am")
//           .map((u) => ({ id: u.id, name: u.name ?? null, email: u.email ?? null }));
//         if (!mounted) return;
//         setAms(list);
//         if (formData.amId) {
//           const found = list.find((u) => u.id === formData.amId);
//           setAmName(found ? (found.name || found.email || found.id) : formData.amId);
//         }
//       } catch {
//         // non-blocking
//       }
//     };
//     load();
//     return () => {
//       mounted = false;
//     };
//   }, [formData.packageId, formData.templateId, formData.amId]);

//   const handleDownload = () => {
//     const jsonData = JSON.stringify(formData, null, 2);
//     const blob = new Blob([jsonData], { type: "application/json" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "client-onboarding-data.json";
//     document.body.appendChild(a);
//     a.click();
//     URL.revokeObjectURL(url);
//     document.body.removeChild(a);
//     toast.success("JSON file downloaded successfully!");
//   };

//   const handleSubmit = async () => {
//     setIsSaving(true);
  
//     try {
//       const clientData = {
//         // core
//         name: formData.name,
//         birthdate: formData.birthdate,
//         company: formData.company,
//         designation: formData.designation,
//         location: formData.location,
  
//         // contact / credentials (new)
//         email: formData.email || null,
//         phone: formData.phone || null,
//         password: formData.password || null,
//         recoveryEmail: formData.recoveryEmail || null,
  
//         // websites + meta
//         website: formData.website,
//         website2: formData.website2,
//         website3: formData.website3,
//         companywebsite: formData.companywebsite,
//         companyaddress: formData.companyaddress,
//         biography: formData.biography,
//         imageDrivelink: formData.imageDrivelink,
  
//         // avatar stays string (NOT binary) for now
//         avatar: formData.avatar || null,
  
//         // project
//         progress: formData.progress,
//         status: formData.status,
//         packageId: formData.packageId,
//         startDate: formData.startDate,
//         dueDate: formData.dueDate,

//         // AM (new)
//         amId: formData.amId || null,

//         // socials
//         socialLinks: formData.socialLinks || [],

//         // other arbitrary pairs
//         otherField: (formData.otherField || []).map((r: any) => ({ title: String(r.title || ""), data: String(r.data || "") })),
//       };

//       const clientRes = await fetch("/api/clients", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(clientData),
//       });

//       const clientResult = await clientRes.json();

//       if (!clientRes.ok) {
//         toast.error(clientResult.error || "Failed to create client.");
//         return;
//       }

//       const createdClientId: string =
//         clientResult?.id ?? clientResult?.client?.id ?? clientResult?.data?.id;

//       toast.success("Client created successfully!");

//       // auto-assign template (unchanged)
//       if (formData.templateId && createdClientId) {
//         try {
//           const assignment = {
//             id: `assignment-${Date.now()}`,
//             templateId: formData.templateId,
//             clientId: createdClientId,
//             assignedAt: new Date().toISOString(),
//             status: "active",
//           };

//           const assignmentRes = await fetch("/api/assignments", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(assignment),
//           });

//           if (assignmentRes.ok) {
//             toast.success(`Template "${templateName || formData.templateId}" assigned successfully!`);

//             // Auto-distribute created tasks to a data_entry user so they show up in the data_entry dashboard
//             try {
//               const createdAssignment = await assignmentRes.json();
//               const createdTasks: any[] = createdAssignment?.tasks || createdAssignment?.data?.tasks || [];
//               if (Array.isArray(createdTasks) && createdTasks.length > 0) {
//                 // find a data_entry user
//                 const usersRes = await fetch(`/api/users?role=data_entry&limit=50`, { cache: "no-store" });
//                 const usersJson = await usersRes.json().catch(() => ({}));
//                 const dataEntryUsers: any[] = (usersJson?.users ?? usersJson?.data ?? []).filter(
//                   (u: any) => u?.role?.name?.toLowerCase() === "data_entry"
//                 );

//                 if (dataEntryUsers.length === 0) {
//                   toast.warning("No data_entry users found. You can manually distribute tasks later.");
//                 } else {
//                   const dataEntryAssignee = dataEntryUsers[0];
//                   const now = new Date();
//                   const due = new Date(now);
//                   due.setDate(due.getDate() + 7);

//                   const distributeBody = {
//                     clientId: createdClientId,
//                     assignments: createdTasks.map((t: any) => ({
//                       taskId: t.id,
//                       agentId: dataEntryAssignee.id,
//                       note: "Auto-assigned to data_entry after onboarding",
//                       dueDate: due.toISOString(),
//                     })),
//                   };

//                   const distRes = await fetch("/api/tasks/distribute", {
//                     method: "POST",
//                     headers: { "Content-Type": "application/json" },
//                     body: JSON.stringify(distributeBody),
//                   });

//                   if (distRes.ok) {
//                     toast.success("Tasks routed to data_entry successfully.");
//                   } else {
//                     const j = await distRes.json().catch(() => ({}));
//                     console.error("Distribute failed", j);
//                     toast.warning("Template assigned but auto-distribution to data_entry failed.");
//                   }
//                 }
//               }
//             } catch (e) {
//               console.error("Auto-assign to data_entry failed", e);
//               // non-blocking
//             }
//           } else {
//             toast.warning("Client created but template assignment failed. You can assign it manually later.");
//           }
//         } catch {
//           toast.warning("Client created but template assignment failed. You can assign it manually later.");
//         }
//       }

//       setIsSubmitted(true);
//     } catch (err) {
//       console.error(err);
//       toast.error("Something went wrong.");
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   // Preview: build a local preview URL if we have a File
//   const avatarPreviewUrl = useMemo(() => {
//     if (formData?.profilePicture instanceof File) {
//       return URL.createObjectURL(formData.profilePicture);
//     }
//     return null;
//   }, [formData?.profilePicture]);

//   if (isSubmitted) {
//     return (
//       <div className="text-center space-y-8 py-12">
//         <div className="flex justify-center">
//           <div className="rounded-full bg-gradient-to-r from-green-100 to-emerald-100 p-6">
//             <CheckCircle className="h-20 w-20 text-green-600" />
//           </div>
//         </div>
//         <div>
//           <h2 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">
//             Submission Successful!
//           </h2>
//           <p className="text-gray-500 max-w-2xl mx-auto text-lg">
//             Thank you for completing the onboarding process. Your client information has been saved successfully and is ready for processing.
//           </p>
//         </div>
//         <div className="flex justify-center gap-4">
//           <Button onClick={handleDownload} variant="outline" className="hover:bg-green-50 hover:text-green-700 hover:border-green-300">
//             <Download className="w-4 h-4 mr-2" />
//             Download JSON
//           </Button>
//           <Button
//             onClick={() => router.push("/admin/clients")}
//             className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
//           >
//             <ArrowLeft className="w-4 h-4 mr-2" />
//             Back to Dashboard
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   const sections = [
//     {
//       title: "Personal Information",
//       icon: User,
//       color: "from-blue-500 to-cyan-500",
//       items: [
//         { label: "Full Name", value: formData.name },
//         { label: "Birth Date", value: formData.birthdate ? new Date(formData.birthdate).toLocaleDateString() : null },
//         { label: "Location", value: formData.location },
//         { label: "Company", value: formData.company },
//         { label: "Designation", value: formData.designation },
//         { label: "Status", value: formData.status },
//         { label: "Account Manager", value: amName },
//       ].filter((i) => i.value),
//     },
//     {
//       title: "Website Information",
//       icon: Globe,
//       color: "from-purple-500 to-pink-500",
//       items: [
//         { label: "Primary Website", value: formData.website },
//         { label: "Secondary Website", value: formData.website2 },
//         { label: "Third Website", value: formData.website3 },
//         { label: "Company Website", value: formData.companywebsite },
//         { label: "Company Address", value: formData.companyaddress },
//       ].filter((i) => i.value),
//     },
//     {
//       title: "Project Details",
//       icon: Package,
//       color: "from-green-500 to-emerald-500",
//       items: [
//         { label: "Package", value: packageName || formData.packageId },
//         { label: "Template", value: templateName || formData.templateId },
//         { label: "Start Date", value: formData.startDate ? new Date(formData.startDate).toLocaleDateString() : null },
//         { label: "Due Date", value: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : null },
//         { label: "Progress", value: typeof formData.progress === "number" ? `${formData.progress}%` : null },
//       ].filter((i) => i.value),
//     },
//     {
//       title: "Contact & Credentials (Optional)",
//       icon: FileText,
//       color: "from-amber-500 to-orange-500",
//       items: [
//         { label: "Email", value: formData.email },
//         { label: "Phone", value: formData.phone },
//         // Do not display raw password in review for safety; show masked
//         { label: "Password", value: formData.password ? "********" : null },
//         { label: "Recovery Email", value: formData.recoveryEmail },
//       ].filter((i) => i.value),
//     },
//   ];

//   return (
//     <div className="space-y-8">
//       <div className="text-center">
//         <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
//           Review Client's Information For Data Entry
//         </h1>
//         <p className="text-gray-500 text-lg">Please review all the information below before submitting your onboarding details.</p>
//       </div>

//       <div className="grid gap-6">
//         {sections.filter(Boolean).map(
//           (section, index) =>
//             (section as any).items.length > 0 && (
//               <Card key={index} className="overflow-hidden border-0 shadow-lg">
//                 <CardHeader className={`bg-gradient-to-r ${(section as any).color} text-white`}>
//                   <CardTitle className="flex items-center gap-3 text-xl">
//                     {/** @ts-ignore */}
//                     <section.icon className="w-6 h-6" />
//                     {(section as any).title}
//                   </CardTitle>
//                 </CardHeader>
//                 <CardContent className="p-6">
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                     {(section as any).items.map((item: any, itemIndex: number) => (
//                       <div key={itemIndex} className="flex flex-col">
//                         <span className="text-sm font-medium text-gray-500 mb-1">{item.label}</span>
//                         <span className="text-gray-900 font-medium break-words">{item.value}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </CardContent>
//               </Card>
//             ),
//         )}

//         {/* Biography */}
//         {formData.biography && (
//           <Card className="overflow-hidden border-0 shadow-lg">
//             <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
//               <CardTitle className="flex items-center gap-3 text-xl">
//                 <FileText className="w-6 h-6" />
//                 Biography
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="p-6">
//               <div className="prose prose-sm max-w-none">
//                 <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{formData.biography}</p>
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {/* Image Drive Link */}
//         {formData.imageDrivelink && (
//           <Card className="overflow-hidden border-0 shadow-lg">
//             <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
//               <CardTitle className="flex items-center gap-3 text-xl">
//                 <ImageIcon className="w-6 h-6" />
//                 Image Gallery
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="p-6">
//               <a
//                 href={formData.imageDrivelink}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="text-blue-600 hover:text-blue-800 hover:underline break-all font-medium"
//               >
//                 {formData.imageDrivelink}
//               </a>
//             </CardContent>
//           </Card>
//         )}

//         {/* Avatar Preview (from file) */}
//         {avatarPreviewUrl && (
//           <Card className="overflow-hidden border-0 shadow-lg">
//             <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
//               <CardTitle className="flex items-center gap-3 text-xl">
//                 <ImageIcon className="w-6 h-6" />
//                 Profile Picture
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="p-6">
//               {/* eslint-disable-next-line @next/next/no-img-element */}
//               <img src={avatarPreviewUrl} alt="Avatar preview" className="h-24 w-24 rounded-full object-cover border" />
//             </CardContent>
//           </Card>
//         )}

//         {/* Social links */}
//         {formData.socialLinks && formData.socialLinks.length > 0 && (
//           <Card className="overflow-hidden border-0 shadow-lg">
//             <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
//               <CardTitle className="flex items-center gap-3 text-xl">
//                 <Share2 className="w-6 h-6" />
//                 Social Media
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="p-6">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {formData.socialLinks.map(
//                   (link: any, index: number) =>
//                     link.platform &&
//                     link.url && (
//                       <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
//                         <Badge variant="secondary" className="font-medium">
//                           {link.platform}
//                         </Badge>
//                         <a
//                           href={link.url}
//                           target="_blank"
//                           rel="noopener noreferrer"
//                           className="text-blue-600 hover:text-blue-800 hover:underline truncate flex-1"
//                         >
//                           {link.url}
//                         </a>
//                       </div>
//                     ),
//                 )}
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {formData.templateId && (
//           <AssignmentPreview templateId={formData.templateId} packageId={formData.packageId || ""} templateName={templateName} />
//         )}
//       </div>

//       <div className="flex justify-between pt-8">
//         <Button
//           variant="outline"
//           onClick={onPrevious}
//           className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-700 hover:border-purple-300"
//         >
//           Previous
//         </Button>
//         <Button
//           onClick={handleSubmit}
//           disabled={isSaving}
//           className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg px-8"
//         >
//           {isSaving ? "Saving..." : "Submit"}
//         </Button>
//       </div>
//     </div>
//   );
// }
