export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = new Date(startDate);
  let daysToAdd = workingDays;

  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) daysToAdd--;
  }
  return result;
}

export function addCalendarDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
}

export function extractCycleNumber(taskName: string): number {
  const match = taskName.match(/\s*-\s*(\d+)$/i);
  return match ? Number.parseInt(match[1], 10) : 1;
}

export type CadenceMode = "initial" | "renewal";


export function calculateTaskDueDate(anchor: Date, cycleNumber: number, mode: CadenceMode = "initial"): Date {
  const n = Math.max(1, Math.floor(cycleNumber));

  if (mode === "initial") {
    if (n === 1) return addWorkingDays(anchor, 10);
    const prev = calculateTaskDueDate(anchor, n - 1, "initial");
    return addWorkingDays(prev, 5);
  }

  const workingDayOffset = 1 + (n - 1) * 7;
  return addWorkingDays(anchor, workingDayOffset);
}

export const calculateInitialDueDate = (anchor: Date, n: number) =>
  calculateTaskDueDate(anchor, n, "initial");
export const calculateRenewalDueDate = (anchor: Date, n: number) =>
  calculateTaskDueDate(anchor, n, "renewal");
