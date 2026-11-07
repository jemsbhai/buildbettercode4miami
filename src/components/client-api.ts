import type { ValidationIssue } from "@/lib/types";

export class ApiError extends Error {
  constructor(message: string, public issues: ValidationIssue[] = []) { super(message); }
}

export async function apiRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(result?.error ?? `Request failed (${response.status}). Please try again.`, result?.issues ?? []);
  return result as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function formatMetric(value: number, unit: string) {
  return unit === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
