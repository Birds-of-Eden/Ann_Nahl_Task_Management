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
import { Package, CheckCircle, Sparkles } from "lucide-react";
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
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Select Package
          </h1>
          <p className="text-gray-500 mt-2">Loading available packages...</p>
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
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Select Package
        </h1>
        <p className="text-gray-500 mt-2">
          Choose the package that best suits your project needs and
          requirements.
        </p>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
            <Package className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Packages Available
          </h3>
          <p className="text-gray-500">
            Please contact support to set up packages for your organization.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                selectedPackage === pkg.id
                  ? "ring-2 ring-blue-500 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50"
                  : "hover:shadow-md"
              }`}
              onClick={() => handlePackageSelect(pkg.id)}
            >
              {selectedPackage === pkg.id && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="bg-blue-500 rounded-full p-1">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>

              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  {pkg.name}
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 line-clamp-3">
                  {pkg.description ||
                    "A comprehensive package designed to meet your business needs."}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-4">
                    {pkg._count?.templates && (
                      <Badge variant="secondary" className="text-xs">
                        {pkg._count.templates} Templates
                      </Badge>
                    )}
                    {pkg._count?.clients && (
                      <Badge variant="outline" className="text-xs">
                        {pkg._count.clients} Clients
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  className={`w-full transition-all duration-200 ${
                    selectedPackage === pkg.id
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md"
                      : "bg-gradient-to-r from-gray-100 to-gray-200 hover:from-blue-100 hover:to-purple-100 text-gray-700 hover:text-blue-700"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePackageSelect(pkg.id);
                  }}
                >
                  {selectedPackage === pkg.id ? "Selected" : "Select Package"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex gap-6">
          {/* Start Date */}
          <div className="flex-1">
            <Label htmlFor="startDate" className="mb-1 block">
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
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Due Date */}
          <div className="flex-1">
            <Label htmlFor="dueDate" className="mb-1 block">
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
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="text-sm text-gray-600">
            <p>
              <span className="font-medium">Package Duration:</span> {selectedPackageData.totalMonths} months
            </p>
            <p className="text-green-600">
              {calculateDurationText(formData.startDate, formData.dueDate)}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-6">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-700 hover:border-blue-300"
        >
          Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedPackage}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
