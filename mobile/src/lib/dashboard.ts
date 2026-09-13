import type { StudentProfile, StudentState } from "./api";

const CATEGORY_LABEL: Record<string, string> = {
  food_delivery: "Food delivery",
  coffee: "Coffee",
  groceries: "Groceries",
  nightlife: "Going out",
  rideshare: "Rides",
  campus_bookstore: "Bookstore",
  subscriptions: "Subscriptions",
  gym: "Gym",
  phone: "Phone",
  clothes: "Clothes",
  other: "Everything else",
};

export function monthsUntilGraduation(flags?: StudentProfile | null) {
  const year = Number(flags?.graduation_year);
  if (year >= 2020 && year <= 2040) {
    const end = new Date(year, 4, 15);
    const now = new Date();
    const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    return Math.max(1, months);
  }
  const byYear: Record<string, number> = {
    first_year: 36,
    sophomore: 24,
    junior: 12,
    senior: 5,
    grad: 18,
  };
  const key = flags?.class_year || "";
  return byYear[key] ?? 24;
}

export function prettyDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function topLeak(state: StudentState | null) {
  const bars = categoryBars(state);
  if (!bars.length) return null;
  const top = bars[0];
  const safe = Number(state?.safe_to_spend ?? 0);
  const pct = safe > 0 ? Math.round((top.amount / safe) * 100) : 0;
  return { key: top.key, label: top.label, amount: top.amount, pct };
}

export const CATEGORY_COLOR: Record<string, string> = {
  food_delivery: "#E85D4C",
  coffee: "#C4A35A",
  groceries: "#22A36B",
  nightlife: "#E11D8F",
  rideshare: "#3B82F6",
  campus_bookstore: "#F5A524",
  subscriptions: "#8B5CF6",
  gym: "#0EA5E9",
  phone: "#64748B",
  clothes: "#EC4899",
  other: "#14B8A6",
};

export function categoryBars(state: StudentState | null) {
  const buckets = state?.spending_by_category ?? {};
  const entries = Object.entries(buckets)
    .filter(([, amount]) => Number(amount) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const max = entries[0]?.[1] ?? 0;
  return entries.map(([key, amount]) => ({
    key,
    label: CATEGORY_LABEL[key] ?? key.replaceAll("_", " "),
    amount,
    fill: max > 0 ? amount / max : 0,
    share: total > 0 ? amount / total : 0,
    color: CATEGORY_COLOR[key] ?? CATEGORY_COLOR.other,
  }));
}

export function dailyCap(state: StudentState | null) {
  const days = state?.days_until_next_disbursement;
  const balance = Number(state?.balance ?? 0);
  if (days == null || days <= 0) return null;
  return Math.round((balance / days) * 100) / 100;
}

export function spendChips(cap: number | null) {
  const base = cap && cap > 8 ? cap : 20;
  const amounts = [Math.max(8, Math.round(base * 0.45)), Math.round(base), Math.round(base * 1.75)];
  return [...new Set(amounts)];
}

export function billsBeforeAid(state: StudentState | null) {
  const flags = state?.profile_flags;
  const aid = state?.next_disbursement_date?.slice(0, 10);
  const days = state?.days_until_next_disbursement;
  let reserved = 0;
  const names: string[] = [];
  for (const bill of state?.upcoming_bills ?? []) {
    const due =
      bill.next_due?.slice(0, 10) ||
      nextDueFromRecurring(typeof bill.recurring_date === "number" ? bill.recurring_date : Number(bill.recurring_date))
        ?.toISOString()
        .slice(0, 10);
    const beforeAid = aid && due ? due <= aid : bill.days_until != null && days != null ? bill.days_until <= days : true;
    if (!beforeAid) continue;
    reserved += billAmount(bill, flags);
    if (bill.payee) names.push(bill.payee);
  }
  return { reserved, names };
}

export function todaySpendable(state: StudentState | null) {
  const days = state?.days_until_next_disbursement;
  if (days == null) return null;
  const { reserved, names } = billsBeforeAid(state);
  const leftover = Math.max(0, Number(state?.balance ?? 0) - reserved);
  const today = Math.max(0, Math.floor(leftover / Math.max(days, 1)));
  return {
    today,
    leftover,
    reserved,
    days,
    aidLabel: prettyDate(state?.next_disbursement_date) || "next aid",
    billNames: names.slice(0, 2),
    yes: today > 0,
  };
}

export function insightLine(state: StudentState | null): string | null {
  if (!state) return null;
  const flags = state.profile_flags;
  const leak = topLeak(state);
  const daysSince = state.days_since_last_disbursement;
  const food = state.spending_by_category?.food_delivery ?? 0;
  const safe = Number(state.safe_to_spend ?? 0);

  if (flags?.international || flags?.has_ssn === false) {
    return "Advice assumes no typical US work-study. Treat refunds as timed cash, not extra lifestyle money.";
  }
  if (flags?.pell && daysSince != null && daysSince <= 10) {
    return `Pell/aid hit about ${daysSince} days ago. That refund is for the stretch to the next drop — not a green light to spend the whole balance.`;
  }
  if (leak && leak.key === "food_delivery" && food > 0 && (flags?.anchor_nags_doordash || food > safe * 0.25)) {
    return `Food delivery is $${Math.round(food)} over the last 30 days.`;
  }
  return null;
}

export function offTrackBy(state: StudentState | null) {
  const projected = state?.projected_balance_at_next_disbursement;
  if (projected != null && projected < 0) return Math.abs(Math.round(projected));
  return null;
}

export function sparkPoints(state: StudentState | null, maxPoints = 28) {
  const series = state?.balance_series ?? [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const endIso = (state?.next_disbursement_date || state?.runway_shortfall_date || todayIso).slice(0, 10);
  let window = series.filter((point) => point.date >= todayIso && point.date <= endIso);
  if (window.length < 2) {
    window = series.filter((point) => point.date >= todayIso).slice(0, 45);
  }
  if (window.length <= maxPoints) return window;
  const sampled = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round((i / (maxPoints - 1)) * (window.length - 1));
    sampled.push(window[idx]);
  }
  return sampled;
}

export function nextDueFromRecurring(day?: number | null, from = new Date()) {
  if (day == null || day < 1) return null;
  const year = from.getFullYear();
  const month = from.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  let candidate = new Date(year, month, Math.min(day, last), 12);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  if (candidate < start) {
    const nextLast = new Date(year, month + 2, 0).getDate();
    candidate = new Date(year, month + 1, Math.min(day, nextLast), 12);
  }
  return candidate;
}

export function upcomingRows(state: StudentState | null, flags?: StudentProfile) {
  const rows: {
    id: string;
    title: string;
    subtitle: string;
    amountLabel: string;
    icon: string;
    kind: "aid" | "bill";
  }[] = [];

  if (state?.next_disbursement_date) {
    const days = state.days_until_next_disbursement ?? daysUntil(state.next_disbursement_date);
    rows.push({
      id: "aid",
      title: "Next aid",
      subtitle: prettyDate(state.next_disbursement_date),
      amountLabel: days != null ? `${days}d` : "—",
      icon: "↓",
      kind: "aid",
    });
  }

  for (const bill of state?.upcoming_bills ?? []) {
    const amount = billAmount(bill, flags);
    const split = flags?.splits_rent && /housing|rent/i.test(bill.payee);
    const due =
      bill.next_due ||
      nextDueFromRecurring(typeof bill.recurring_date === "number" ? bill.recurring_date : Number(bill.recurring_date))
        ?.toISOString()
        .slice(0, 10);
    rows.push({
      id: `${bill.payee}-${due ?? bill.recurring_date}`,
      title: bill.payee,
      subtitle: [due ? prettyDate(due) : null, split ? "your half" : null].filter(Boolean).join(" · ") || "Bill",
      amountLabel: `$${amount.toFixed(2)}`,
      icon: /netflix|spotify/i.test(bill.payee) ? "▶" : "⌂",
      kind: "bill",
    });
  }

  return rows;
}

export function billAmount(bill: { payee: string; amount: number }, flags?: StudentProfile) {
  const housing = /housing|rent/i.test(bill.payee);
  if (flags?.splits_rent && housing) return Number(bill.amount) / 2;
  return Number(bill.amount);
}

export function initialsFrom(hello: string, display?: string | null) {
  const fromHello = hello.replace(/^Hi,?\s*/i, "").trim();
  const source = fromHello || display || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "NS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
