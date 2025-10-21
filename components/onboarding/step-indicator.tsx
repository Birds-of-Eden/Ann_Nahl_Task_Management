"use client"

import type React from "react"
import { CheckIcon, Sparkles } from 'lucide-react'
import { cn } from "@/lib/utils"

interface Step {
  id: number
  title: string
  component: React.ComponentType<any>
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepId: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100

  return (
    <nav aria-label="Progress" className="mb-16">
      {/* Progress Bar */}
      <div className="max-w-5xl mx-auto mb-8 px-4">
        <div className="relative h-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full overflow-hidden shadow-inner">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-full transition-all duration-700 ease-out shadow-lg"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="flex justify-between mt-3 px-2">
          <span className="text-sm font-semibold text-violet-600">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm font-medium text-gray-500">
            {Math.round(progress)}% Complete
          </span>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="overflow-x-auto pb-6 scrollbar-hide">
        <ol className="flex items-center justify-center gap-3 md:gap-6 min-w-max px-4">
          {steps.map((step, idx) => {
            const isCompleted = step.id < currentStep
            const isActive = step.id === currentStep

            return (
              <li key={step.title} className="relative flex flex-col items-center min-w-0 group">
                {/* Connector Line */}
                {idx !== 0 && (
                  <div className="absolute -left-4 md:-left-8 top-6 w-8 md:w-16 h-[2px] flex items-center">
                    <div className="w-full h-full bg-gray-200 rounded-full" />
                    <div 
                      className={cn(
                        "absolute inset-0 h-full rounded-full transition-all duration-500 ease-out",
                        isCompleted 
                          ? "bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 w-full" 
                          : "w-0"
                      )}
                    />
                  </div>
                )}

                {/* Step Circle Container */}
                <div className="relative">
                  {/* Glow Effect for Active Step */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 blur-xl opacity-60 animate-pulse" />
                  )}
                  
                  {/* Step Circle */}
                  <div
                    className={cn(
                      "relative z-10 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500 border-2 backdrop-blur-sm",
                      isCompleted
                        ? "bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 border-transparent shadow-xl text-white cursor-pointer hover:shadow-2xl hover:scale-110 hover:rotate-12"
                        : isActive
                          ? "bg-white border-violet-500 shadow-2xl ring-4 ring-violet-100 scale-110"
                          : "bg-white/80 border-gray-300 text-gray-400 hover:border-violet-300 hover:shadow-lg hover:scale-105",
                    )}
                    onClick={() => isCompleted && onStepClick?.(step.id)}
                    role={isCompleted ? "button" : undefined}
                    tabIndex={isCompleted ? 0 : undefined}
                    aria-label={`Step: ${step.title}`}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-6 h-6 animate-in zoom-in duration-300" />
                    ) : isActive ? (
                      <div className="relative">
                        <Sparkles className="w-5 h-5 text-violet-600 animate-pulse" />
                        <div className="absolute inset-0 w-5 h-5">
                          <div className="absolute inset-0 bg-violet-400 rounded-full animate-ping opacity-75" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">{step.id}</span>
                    )}
                  </div>

                  {/* Completion Badge */}
                  {isCompleted && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300">
                      <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
                    </div>
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-4 flex flex-col items-center">
                  <span
                    className={cn(
                      "text-sm text-center font-medium transition-all duration-300 whitespace-nowrap",
                      isCompleted
                        ? "text-violet-600 cursor-pointer group-hover:text-violet-700 group-hover:scale-105"
                        : isActive
                          ? "text-gray-900 font-bold text-base"
                          : "text-gray-500 group-hover:text-gray-700",
                    )}
                    onClick={() => isCompleted && onStepClick?.(step.id)}
                    role={isCompleted ? "button" : undefined}
                    tabIndex={isCompleted ? 0 : undefined}
                  >
                    {step.title}
                  </span>
                  {isActive && (
                    <div className="mt-1 h-1 w-8 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-in slide-in-from-bottom duration-300" />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </nav>
  )
}
