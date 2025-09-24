"use client";

import { useEffect, useMemo, useState, FC, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Clock
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AssignmentPreview } from "./assignment-preview";
import { Badge } from "@/components/ui/badge";

// --- TYPE DEFINITIONS ---
type AMUser = { id: string; name: string | null; email: string | null };
type SocialLink = { platform: string; url: string };
type OtherField = { title: string; data: string };

interface OnboardingData {
    name: string;
    birthdate?: string;
    company?: string;
    designation?: string;
    location?: string;
    gender?: 'male' | 'female' | 'other';
    email?: string;
    phone?: string;
    password?: string;
    recoveryEmail?: string;
    website?: string;
    website2?: string;
    website3?: string;
    companywebsite?: string;
    companyaddress?: string;
    biography?: string;
    imageDrivelink?: string;
    avatar?: string | null;
    profilePicture?: File | null;
    progress?: number;
    status?: string;
    packageId?: string;
    templateId?: string;
    startDate?: string;
    dueDate?: string;
    amId?: string;
    socialLinks?: SocialLink[];
    otherField?: OtherField[];
}

interface ReviewInfoProps {
    formData: OnboardingData;
    onPrevious: () => void;
}

interface InfoItemProps {
    label: string;
    value?: ReactNode;
    icon?: React.ElementType;
}

interface ReviewSectionProps {
    icon: React.ElementType;
    title: string;
    children: ReactNode;
    gradient?: string;
}

// --- COLOR SCHEME CONSTANTS ---
const COLORS = {
    primary: {
        gradient: "from-indigo-600 to-purple-600",
        light: "bg-indigo-50",
        medium: "bg-indigo-100",
        dark: "text-indigo-700",
        border: "border-indigo-200"
    },
    success: {
        gradient: "from-emerald-500 to-teal-600",
        light: "bg-emerald-50",
        dark: "text-emerald-700",
        border: "border-emerald-200"
    },
    warning: {
        light: "bg-amber-50",
        dark: "text-amber-700",
        border: "border-amber-200"
    },
    neutral: {
        light: "bg-slate-50",
        medium: "bg-slate-100",
        dark: "text-slate-700",
        border: "border-slate-200"
    }
} as const;

// --- REUSABLE SUB-COMPONENTS ---

const ReviewSectionCard: FC<ReviewSectionProps> = ({ 
    icon: Icon, 
    title, 
    children,
    gradient = "from-blue-50 to-indigo-50"
}) => (
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

const InfoItem: FC<InfoItemProps> = ({ label, value, icon: Icon }) => {
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

const StatusBadge: FC<{ status?: string; progress?: number }> = ({ status, progress }) => {
    if (!status) return null;
    
    const statusConfig = {
        active: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: BadgeCheck },
        pending: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
        draft: { color: "bg-slate-100 text-slate-800 border-slate-200", icon: FileText },
        completed: { color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: CheckCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const StatusIcon = config.icon;
    
    return (
        <Badge variant="outline" className={`${config.color} px-3 py-1.5 rounded-full font-medium`}>
            <StatusIcon className="w-3 h-3 mr-1.5" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {progress !== undefined && ` • ${progress}%`}
        </Badge>
    );
};

// --- MAIN COMPONENT ---

export function ReviewInfo({ formData, onPrevious }: ReviewInfoProps) {
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
                { label: "Gender", value: formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : null, icon: User },
                { label: "Location", value: formData.location, icon: MapPin },
                { label: "Company", value: formData.company, icon: Building },
                { label: "Designation", value: formData.designation, icon: BadgeCheck },
            ].filter(item => item.value),
        });
        
        // Contact & Credentials
        reviewSections.push({
            id: 'contact',
            icon: BookUser,
            title: "Contact & Credentials",
            gradient: "from-emerald-50 to-teal-50",
            items: [
                 { label: "Email", value: formData.email, icon: Mail },
                 { label: "Phone", value: formData.phone, icon: Phone },
                 { label: "Password", value: formData.password ? "••••••••" : null, icon: FileText },
                 { label: "Recovery Email", value: formData.recoveryEmail, icon: Mail },
            ].filter(item => item.value),
        });

        // Websites
        reviewSections.push({
            id: 'websites',
            icon: Globe,
            title: "Websites & Addresses",
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
            icon: Briefcase,
            title: "Project Details",
            gradient: "from-orange-50 to-amber-50",
            items: [
                { label: "Package", value: fetchedData.packageName || formData.packageId, icon: Package },
                { label: "Template", value: fetchedData.templateName || formData.templateId, icon: FileText },
                { label: "Account Manager", value: fetchedData.amName, icon: User },
                { label: "Start Date", value: formData.startDate ? new Date(formData.startDate).toLocaleDateString() : null, icon: Calendar },
                { label: "Due Date", value: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : null, icon: Calendar },
            ].filter(item => item.value),
        });
        
        return reviewSections.filter(s => s.items.length > 0);
    }, [formData, fetchedData]);

    const avatarPreviewUrl = useMemo(() => {
        if (formData.profilePicture instanceof File) {
            return URL.createObjectURL(formData.profilePicture);
        }
        return formData.avatar || null;
    }, [formData.profilePicture, formData.avatar]);

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
            const { profilePicture, ...restOfData } = formData;
            const clientRes = await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(restOfData),
            });

            const clientResult = await clientRes.json();
            if (!clientRes.ok) {
                toast.error(clientResult.error || "Failed to create client.");
                setIsSaving(false);
                return;
            }
            toast.success("Client created successfully!");

            const createdClientId: string = clientResult?.id ?? clientResult?.client?.id ?? clientResult?.data?.id;

            if (formData.templateId && createdClientId) {
                const assignmentRes = await fetch("/api/assignments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        templateId: formData.templateId,
                        clientId: createdClientId,
                        status: "active",
                    }),
                });

                if (assignmentRes.ok) {
                    toast.success("Template assigned successfully!");
                } else {
                    toast.warning("Client created but template assignment failed.");
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
                            Successfully Submitted!
                        </h2>
                        <p className="text-slate-600 text-lg leading-relaxed">
                            The client information has been saved and the template has been assigned successfully. 
                            You can now manage this client from the dashboard.
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

    return (
        <div className="space-y-8 p-4">
            {/* Header Section */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold">Review & Confirm</span>
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    Almost There!
                </h1>
                <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
                    Please review all the information below carefully. This will be used to create the client profile and assign the template.
                </p>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left Column - Form Sections */}
                <div className="space-y-6">
                    {sections.map(section => (
                        <ReviewSectionCard 
                            key={section.id} 
                            icon={section.icon} 
                            title={section.title}
                            gradient={section.gradient}
                        >
                            <div className="space-y-3">
                                {section.items.map((item, idx) => (
                                    <InfoItem key={idx} {...item} />
                                ))}
                            </div>
                        </ReviewSectionCard>
                    ))}
                </div>

                {/* Right Column - Additional Content */}
                <div className="space-y-6">
                    {/* Social Links */}
                    {formData.socialLinks && formData.socialLinks.length > 0 && (
                        <ReviewSectionCard icon={Share2} title="Social Media Profiles" gradient="from-rose-50 to-pink-50">
                            <div className="space-y-3">
                                {formData.socialLinks.map((link, index) => link.url && (
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
                                 {formData.otherField.map((item, index) => (
                                     <div key={index} className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
                                         <p className="font-semibold text-slate-800 text-sm mb-2">{item.title}</p>
                                         <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{item.data}</p>
                                     </div>
                                 ))}
                             </div>
                         </ReviewSectionCard>
                    )}

                    {/* Biography */}
                    {formData.biography && (
                        <ReviewSectionCard icon={FileText} title="Biography" gradient="from-cyan-50 to-blue-50">
                            <p className="text-slate-700 leading-relaxed text-base bg-white p-4 rounded-xl border border-slate-200">
                                {formData.biography}
                            </p>
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