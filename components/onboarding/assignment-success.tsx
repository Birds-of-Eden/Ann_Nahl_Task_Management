"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Users, ArrowRight } from 'lucide-react';

interface AssignmentSuccessProps {
  clientName: string;
  templateName: string;
  packageName: string;
  assignmentId?: string;
}

export function AssignmentSuccess({ 
  clientName, 
  templateName, 
  packageName,
  assignmentId 
}: AssignmentSuccessProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shadow-2xl mb-4 animate-bounce">
          <CheckCircle className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Assignment Created Successfully!
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Your client has been onboarded and the template has been assigned.
        </p>
      </div>

      <Card className="overflow-hidden border-2 border-green-100 shadow-2xl bg-gradient-to-br from-white to-green-50/30 rounded-2xl">
        <CardContent className="p-8">
          <div className="space-y-6">
            {/* Client to Template Flow */}
            <div className="flex items-center justify-between p-6 bg-white rounded-xl border-2 border-green-200 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{clientName}</p>
                  <p className="text-sm text-gray-600 font-medium">Client</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-green-500" />
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{templateName}</p>
                  <p className="text-sm text-gray-600 font-medium">Template</p>
                </div>
              </div>
            </div>

            {/* Package and Assignment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-5 bg-white rounded-xl border-2 border-green-200 hover:shadow-lg transition-shadow">
                <Badge className="bg-green-100 text-green-800 border-green-300 mb-3 px-3 py-1.5 font-semibold">
                  Package
                </Badge>
                <p className="text-base font-bold text-gray-900">{packageName}</p>
              </div>
              {assignmentId && (
                <div className="text-center p-5 bg-white rounded-xl border-2 border-blue-200 hover:shadow-lg transition-shadow">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 mb-3 px-3 py-1.5 font-semibold">
                    Assignment ID
                  </Badge>
                  <p className="text-sm font-mono font-bold text-gray-900">{assignmentId}</p>
                </div>
              )}
            </div>

            {/* Next Steps */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-green-900 text-lg">Next Steps:</h4>
              </div>
              <ul className="text-base text-green-800 space-y-2.5">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Tasks have been automatically generated
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Team members have been notified
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Client will receive welcome email
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Project timeline has been established
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
