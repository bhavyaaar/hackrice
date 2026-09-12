import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { supabase } from "./supabase";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    ...(extra ?? {}),
    Authorization: token ? `Bearer ${token}` : "",
  };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders({
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  });
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) message = body.detail;
    } catch {
      /* use raw body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function bootstrap() {
  return api("/api/me/bootstrap", { method: "POST" });
}

export function studentState() {
  return api<StudentState>("/api/student-state");
}

export function chat(agent: "compass" | "horizon" | "anchor", message: string) {
  return api<{ reply: string; student_state: StudentState }>(`/api/agents/${agent}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function simulatePurchase(amount = 42.5, description = "Late-night DoorDash") {
  return api("/api/simulate-purchase", {
    method: "POST",
    body: JSON.stringify({ amount, description }),
  });
}

export function horizonSimulate(extra_monthly: number) {
  return api("/api/agents/horizon/simulate", {
    method: "POST",
    body: JSON.stringify({ extra_monthly }),
  });
}

export async function scanAwardLetter(uri: string, _name = "award-letter.jpg", _type?: string | null) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const form = new FormData();
  form.append("file", new File(uri));
  const res = await expoFetch(`${API}/api/documents/scan`, {
    method: "POST",
    headers: { Authorization: token ? `Bearer ${token}` : "" },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) message = body.detail;
    } catch {
      /* use raw body */
    }
    throw new Error(message);
  }
  return res.json();
}

export type StudentState = {
  balance: number;
  avg_daily_spend: number;
  days_until_next_disbursement: number | null;
  runway_shortfall_date: string | null;
  projected_balance_at_next_disbursement: number | null;
  safe_to_spend: number;
  upcoming_bills: { payee: string; amount: number }[];
  spending_by_category: Record<string, number>;
  loan_summary: { principal: number; subsidized: number; unsubsidized: number; rate: number } | null;
  concepts_understood: string[];
};
