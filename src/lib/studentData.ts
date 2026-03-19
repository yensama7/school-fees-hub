export interface Student {
  id: string;
  name: string;
  fees: number;
  grade: string;
}

export const students: Record<string, Student> = {
  STD001: {
    id: "STD001",
    name: "John Adeyemi",
    fees: 75000,
    grade: "Grade 5",
  },
  STD002: {
    id: "STD002",
    name: "Sarah Adeyemi",
    fees: 85000,
    grade: "Grade 8",
  },
};

export function lookupStudent(id: string): Student | null {
  return students[id.toUpperCase()] ?? null;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}
