"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface ExportClientTxtButtonProps {
  clientData: Record<string, any>;
}

export default function ExportClientTxtButton({
  clientData,
}: ExportClientTxtButtonProps) {
  const handleExportTxt = () => {
    if (!clientData) return alert("No client data to export!");
    const allowedFields = [
      "name",
      "birthdate",
      "gender",
      "company",
      "designation",
      "location",
      "email",
      "phone",
      "password",
      "recoveryEmail",
      "websites",
      "biography",
      "imageDrivelink",
      "articleTopics",
      "companywebsite",
      "companyaddress",
      "status",
      "otherField",
      "socialMedia",
    ];
    const filteredData = allowedFields.reduce<Record<string, any>>((acc, field) => {
      if (clientData[field] !== undefined) acc[field] = clientData[field];
      return acc;
    }, {});
    const textContent = formatToText(filteredData);

    // Create and download file
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filteredData.name || "client"}_details.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Recursive text formatter
  const formatToText = (obj: any, indent = 0): string => {
    const spacing = "  ".repeat(indent);
    let output = "";

    for (const key in obj) {
      const value = obj[key];
      if (Array.isArray(value)) {
        output += `${spacing}${key}:\n`;
        value.forEach((item, idx) => {
          output += `${spacing}  [${idx + 1}]\n${formatToText(item, indent + 2)}`;
        });
      } else if (typeof value === "object" && value !== null) {
        output += `${spacing}${key}:\n${formatToText(value, indent + 1)}`;
      } else {
        output += `${spacing}${key}: ${value ?? ""}\n`;
      }
    }

    return output;
  };

  return (
    <Button
      onClick={handleExportTxt}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all px-5 py-2 font-semibold"
    >
      <FileDown className="h-5 w-5" />
      Export Client's Details as TXT
    </Button>
  );
}
