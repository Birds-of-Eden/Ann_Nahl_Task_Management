"use client";

import { useEffect, useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CheckCircle, Sparkles, Calendar, Clock, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "react-datepicker";

interface PackageData {
  id: string;
  name: string;
  description: string;
  totalMonths: number;
  _count?: {
    clients: number;
    templates: number;
  };
  templates?: Array<{
    id: string;
    name: string;
  }>;
}

export function PackageInfo({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: any) {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string>(
    formData.packageId || ""
  );
  const [selectedPackageData, setSelectedPackageData] =
    useState<PackageData | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch("/api/packages");
        const data = await res.json();
        setPackages(data);
        toast.success("Packages loaded successfully!");
      } catch (error) {
        console.error("Error fetching packages:", error);
        toast.error("Failed to load packages");
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePackageSelect = (packageId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    setSelectedPackage(packageId);
    setSelectedPackageData(pkg);

    // If there's a start date, update the due date based on package duration
    if (formData.startDate) {
      const startDate = new Date(formData.startDate);
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (pkg.totalMonths || 0));
      updateFormData({
        packageId,
        templateId: "", // Reset template when package changes
        dueDate: dueDate.toISOString(),
      });
    } else {
      updateFormData({
        packageId,
        templateId: "", // Reset template when package changes
      });
    }

    toast.success("Package selected successfully!");
  };

  // Helper function to calculate and format duration text
  const calculateDurationText = useCallback((startDateStr: string, endDateStr: string) => {
    try {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      
      // Calculate difference in months
      const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                    (end.getMonth() - start.getMonth());
      
      // Calculate remaining days
      const startMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const daysInStartMonth = startMonth.getDate();
      const days = end.getDate() - start.getDate();
      
      // Adjust for negative days
      const adjustedDays = days < 0 ? days + daysInStartMonth : days;
      
      const monthsText = months > 0 ? `${months} month${months > 1 ? 's' : ''}` : '';
      const daysText = adjustedDays > 0 ? `${adjustedDays} day${adjustedDays > 1 ? 's' : ''}` : '';
      
      return `(${monthsText}${months > 0 && days > 0 ? ' and ' : ''}${daysText})`;
    } catch (error) {
      console.error('Error calculating duration:', error);
      return '';
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg mb-4 animate-pulse">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Select Package
          </h1>
          <p className="text-gray-600 text-lg">Loading available packages...</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Select Your Package
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Choose the perfect package that aligns with your project needs and business goals.
        </p>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-32 h-32 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
            <Package className="w-16 h-16 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            No Packages Available
          </h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            Please contact support to set up packages for your organization.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {packages.map((pkg, index) => (
            <Card
              key={pkg.id}
              className={`relative overflow-hidden cursor-pointer transition-all duration-500 group ${
                selectedPackage === pkg.id
                  ? "ring-4 ring-blue-500 shadow-2xl scale-105 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
                  : "hover:shadow-xl hover:-translate-y-2 bg-white"
              }`}
              onClick={() => handlePackageSelect(pkg.id)}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Selection Badge */}
              {selectedPackage === pkg.id && (
                <div className="absolute top-4 right-4 z-10 animate-in zoom-in duration-300">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-2 shadow-lg">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}

              {/* Top Gradient Bar */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
              </div>

              {/* Glow Effect on Hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-purple-400/0 group-hover:from-blue-400/10 group-hover:to-purple-400/10 transition-all duration-500" />

              <CardHeader className="pb-4 pt-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {pkg.name}
                    </CardTitle>
                    {pkg.totalMonths && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold">
                        <Clock className="w-4 h-4" />
                        <span>{pkg.totalMonths} Months Duration</span>
                      </div>
                    )}
                  </div>
                </div>
                <CardDescription className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {pkg.description ||
                    "A comprehensive package designed to meet your business needs and exceed expectations."}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 pb-6">
                {/* Stats Section */}
                <div className="flex items-center gap-3 mb-5">
                  {pkg._count?.templates && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{pkg._count.templates} Templates</span>
                    </div>
                  )}
                  {pkg._count?.clients && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{pkg._count.clients} Clients</span>
                    </div>
                  )}
                </div>

                <Button
                  className={`w-full h-12 font-semibold transition-all duration-300 ${
                    selectedPackage === pkg.id
                      ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-purple-50 text-gray-700 hover:text-blue-700 border-2 border-gray-200 hover:border-blue-300"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePackageSelect(pkg.id);
                  }}
                >
                  {selectedPackage === pkg.id ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Selected
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Select Package
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Date Selection Card */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-xl border border-blue-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Project Timeline</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group">
            <Label htmlFor="startDate" className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Start Date
            </Label>
            <DatePicker
              id="startDate"
              selected={formData.startDate ? new Date(formData.startDate) : null}
              onChange={(date: Date | null) => {
                if (!date) {
                  updateFormData({ startDate: "", dueDate: "" });
                  return;
                }

                const startDate = date.toISOString();
                let dueDate = "";

                // If a package is selected, calculate due date based on package duration
                if (selectedPackageData?.totalMonths) {
                  const due = new Date(date);
                  due.setMonth(due.getMonth() + selectedPackageData.totalMonths);
                  dueDate = due.toISOString();
                }

                updateFormData({
                  startDate,
                  dueDate: dueDate || formData.dueDate,
                });
              }}
              dateFormat="MMMM d, yyyy"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              placeholderText="Select start date"
              className="w-full h-12 border-2 border-gray-200 rounded-xl px-4 py-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200"
              maxDate={formData.dueDate ? new Date(formData.dueDate) : undefined}
              disabled={!selectedPackage}
              required
            />
            {!selectedPackage && (
              <p className="mt-1 text-sm text-gray-500">
                Please select a package first
              </p>
            )}
          </div>

          <div className="group">
            <Label htmlFor="dueDate" className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Due Date
            </Label>
            <DatePicker
              id="dueDate"
              selected={formData.dueDate ? new Date(formData.dueDate) : null}
              onChange={(date: Date | null) => {
                updateFormData({ 
                  dueDate: date ? date.toISOString() : "" 
                });
              }}
              dateFormat="MMMM d, yyyy"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              placeholderText="Select due date"
              className="w-full h-12 border-2 border-gray-200 rounded-xl px-4 py-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200"
              minDate={formData.startDate ? new Date(formData.startDate) : new Date(new Date().setHours(0, 0, 0, 0))}
              disabled={!formData.startDate}
              required
            />
            {!formData.startDate && (
              <p className="mt-1 text-sm text-gray-500">
                Please select a start date first
              </p>
            )}
          </div>
        </div>

        {selectedPackageData?.totalMonths && formData.startDate && formData.dueDate && (
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Package Duration: {selectedPackageData.totalMonths} months
                </p>
                <p className="text-sm text-green-700 font-medium">
                  {calculateDurationText(formData.startDate, formData.dueDate)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-700 hover:border-blue-400 transition-all duration-200 rounded-xl"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedPackage}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          Continue to Next Step
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
