import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { NativeModules } from "react-native";
import { supabase } from "./supabase";

function packagerHostname(): string | null {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptURL) {
    try {
      const host = new URL(scriptURL).hostname;
      if (isLanHost(host)) return host;
    } catch {
      /* ignore */
    }
  }
  const hostUri = Constants.expoGoConfig?.debuggerHost || Constants.expoConfig?.hostUri || "";
  const host = String(hostUri).split(":")[0];
  return isLanHost(host) ? host : null;
}

function isLanHost(host: string) {
  if (!host || host === "localhost" || host === "127.0.0.1") return false;
  if (host.includes("exp.direct") || host.includes("ngrok") || host.includes("expo.dev")) return false;
  return true;
}

function resolveApiBase() {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
  try {
    const url = new URL(configured);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      const host = packagerHostname();
      if (host) {
        url.hostname = host;
        return url.origin;
      }
    }
  } catch {
    /* keep configured */
  }
  return configured;
}

const API = resolveApiBase();

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
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      `Can't reach the API at ${API}. Restart uvicorn with --host 0.0.0.0 and put the phone on the same network as the laptop (iPhone hotspot is most reliable).`,
    );
  }
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

export type SignupProfile = {
  full_name?: string;
  school?: string;
  class_year?: ClassYear;
  housing?: Housing;
  first_gen?: boolean;
  international?: boolean;
  has_ssn?: boolean;
  pell?: boolean;
  work_study_eligible?: boolean;
};

export async function bootstrap(input?: string | SignupProfile) {
  const extra = typeof input === "string" ? { full_name: input } : (input ?? {});
  const { data } = await supabase.auth.getUser();
  const authName = nameFromAuthUser(data.user);
  const full_name = (extra.full_name || authName).trim();
  return api<{ student: { profile_flags?: StudentProfile }; state: StudentState; created: boolean }>("/api/me/bootstrap", {
    method: "POST",
    body: JSON.stringify({ ...extra, full_name }),
  });
}

export function nameFromAuthUser(user: { user_metadata?: Record<string, unknown>; identities?: { identity_data?: Record<string, unknown> }[] } | null | undefined) {
  const meta = user?.user_metadata ?? {};
  const ident = user?.identities?.[0]?.identity_data ?? {};
  for (const value of [meta.full_name, meta.fullName, meta.name, ident.full_name, ident.fullName, ident.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function nameFromAccessToken(token?: string | null) {
  if (!token) return "";
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
    const meta = (json.user_metadata ?? {}) as Record<string, unknown>;
    for (const value of [meta.full_name, meta.fullName, meta.name, json.full_name, json.name]) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    /* ignore malformed tokens */
  }
  return "";
}

export function firstNameFrom(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(/\s+/)[0];
    }
  }
  return "";
}

export function studentState() {
  return api<StudentState>("/api/student-state");
}

export type AnchorCard = {
  verdict: "go" | "stretch" | "skip";
  headline: string;
  why: string;
  extra_after: number | null;
  days_to_aid: number | null;
  takeaways: string[];
  watch: string[];
  next_step: string;
};

export type ChatTurn = {
  id: string;
  at: string;
  message: string;
  reply: string;
  card?: AnchorCard | null;
};

export function chat(agent: "compass" | "horizon" | "anchor", message: string) {
  return api<{ reply: string; card?: AnchorCard | null; history?: ChatTurn[]; student_state: StudentState }>(
    `/api/agents/${agent}/chat`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}

export function agentHistory(agent: "compass" | "horizon" | "anchor") {
  return api<{ agent: string; turns: ChatTurn[] }>(`/api/agents/${agent}/history`);
}

export function simulatePurchase(amount = 42.5, description = "Late-night DoorDash") {
  return api("/api/simulate-purchase", {
    method: "POST",
    body: JSON.stringify({ amount, description }),
  });
}

export type PayoffPreview = {
  extra_monthly?: number;
  monthly_payment?: number;
  months?: number;
  interest_paid?: number;
  error?: string;
};

export function horizonSimulate(extra_monthly: number) {
  return api<{
    preview: PayoffPreview;
    plan: PayoffPreview;
    baseline: PayoffPreview;
    interest_saved: number | null;
    months_saved: number | null;
    student_state: StudentState;
  }>("/api/agents/horizon/simulate", {
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
  return res.json() as Promise<ScanPayload>;
}

export function saveDocument(body: { storage_path: string; ocr_text: string; extracted: Record<string, unknown> }) {
  return api<{ document: SavedDocument; saved: boolean }>("/api/documents/save", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listDocuments() {
  return api<SavedDocument[]>("/api/documents");
}

export function getProfile() {
  return api<ProfilePayload>("/api/me/profile");
}

export function updateProfile(body: Partial<StudentProfile>) {
  return api<ProfilePayload>("/api/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type ScanPayload = {
  storage_path: string;
  ocr_text: string;
  extracted: Record<string, unknown>;
  explanation?: string | null;
  saved?: boolean;
};

export type SavedDocument = {
  id: string;
  student_id: string;
  storage_path: string;
  ocr_text: string | null;
  extracted_json: Record<string, unknown> | null;
  created_at: string;
};

export type ClassYear = "first_year" | "sophomore" | "junior" | "senior" | "grad";
export type Housing = "on_campus" | "off_campus";
export type SpendStyle = "strict" | "buffer_20";

export type StudentProfile = {
  full_name: string;
  school: string;
  class_year: ClassYear | "";
  graduation_year: string;
  housing: Housing | "";
  first_gen: boolean;
  international: boolean;
  has_ssn: boolean;
  pell: boolean;
  work_study_eligible: boolean;
  safe_to_spend_style: SpendStyle;
  notify_bills: boolean;
  notify_aid: boolean;
  anchor_nags_doordash: boolean;
  splits_rent: boolean;
  handled_bills?: string[];
};

export type ProfilePayload = {
  profile: StudentProfile;
  loan_summary: StudentState["loan_summary"];
  concepts_understood: string[];
};

export type StudentState = {
  balance: number;
  avg_daily_spend: number;
  days_until_next_disbursement: number | null;
  runway_shortfall_date: string | null;
  projected_balance_at_next_disbursement: number | null;
  safe_to_spend: number;
  upcoming_bills: {
    payee: string;
    amount: number;
    recurring_date?: number;
    next_due?: string | null;
    days_until?: number | null;
  }[];
  spending_by_category: Record<string, number>;
  loan_summary: { principal: number; subsidized: number; unsubsidized: number; rate: number } | null;
  concepts_understood: string[];
  profile_flags?: StudentProfile;
  display_name?: string;
  next_disbursement_date?: string | null;
  last_disbursement_date?: string | null;
  days_since_last_disbursement?: number | null;
  upcoming_inflows?: {
    id: string;
    kind: string;
    label: string;
    date: string;
    amount: number;
    days_until: number;
    cadence_days?: number;
  }[];
  next_inflow?: {
    id: string;
    kind: string;
    label: string;
    date: string;
    amount: number;
    days_until: number;
    cadence_days?: number;
  } | null;
  balance_series?: { date: string; balance: number; kind?: string }[];
  warning?: string;
};
