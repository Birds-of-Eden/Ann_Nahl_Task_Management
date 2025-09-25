export interface OnboardingFormData {
  // Personal Information
  name: string;
  birthdate?: string;
  gender?: string;
  location?: string;
  company?: string;
  designation?: string;
  companyaddress?: string;
  companywebsite?: string;
  status?: string;
  // AM assignment
  amId?: string;
  startDate?: string;
  dueDate?: string;
  profilePicture?: File;
  
  // Optional: reference to an existing client to fetch dynamic data (e.g., articleTopics)
  clientId?: string;
  
  // Contact Information
  email?: string;
  phone?: string;
  password?: string;
  recoveryEmail?: string;
  
  // Website Information
  website?: string;
  website2?: string;
  website3?: string;
  
  // Biography
  biography?: string;
  
  // Image Gallery
  imageDrivelink?: string;
  
  // Social Media
  socialLinks: Array<{
    platform: string;
    url: string;
  }>;
  
  // Arbitrary additional info (will be saved to Client.otherField as JSON)
  otherField?: Array<{ title: string; data: string }>;
  
  // Package & Template
  packageId?: string;
  templateId?: string; // ✅ Added templateId field
  
  // Progress
  progress: number;

  // UI state: selected article ids (indexes in dynamic list)
  selectedArticles: number[];

  // Locally managed article topics (for ArticlesSelection step)
  articleTopics?: ArticleTopic[];
}

// Shared type for article topics used in onboarding flows
export type ArticleTopic = {
  topicname: string;
  status?: string;
  usedDate?: string | null;
  usedCount?: number;
};

export interface StepProps {
  formData: OnboardingFormData;
  updateFormData: (data: Partial<OnboardingFormData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}
