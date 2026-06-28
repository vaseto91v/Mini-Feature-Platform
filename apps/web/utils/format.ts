export type AccentColor =
  | "blue"
  | "green"
  | "purple"
  | "amber"
  | "teal"
  | "red"
  | "gray";

const ACCENTS: AccentColor[] = [
  "blue",
  "green",
  "purple",
  "amber",
  "teal",
  "red",
  "gray",
];

// Literal class maps so Tailwind's JIT can see them (dynamic `bg-accent-${x}`
// names would otherwise be purged).
export const ACCENT_SOLID: Record<AccentColor, string> = {
  blue: "bg-accent-blue text-white",
  green: "bg-accent-green text-white",
  purple: "bg-accent-purple text-white",
  amber: "bg-accent-amber text-white",
  teal: "bg-accent-teal text-white",
  red: "bg-accent-red text-white",
  gray: "bg-accent-gray text-white",
};

export const ACCENT_SOFT: Record<AccentColor, string> = {
  blue: "bg-accent-blue-soft text-accent-blue",
  green: "bg-accent-green-soft text-accent-green",
  purple: "bg-accent-purple-soft text-accent-purple",
  amber: "bg-accent-amber-soft text-accent-amber",
  teal: "bg-accent-teal-soft text-accent-teal",
  red: "bg-accent-red-soft text-accent-red",
  gray: "bg-accent-gray-soft text-accent-gray",
};

/** Deterministic accent color from an arbitrary string (e.g. project id). */
export function accentFor(value: string): AccentColor {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return ACCENTS[Math.abs(hash) % ACCENTS.length]!;
}

/** 1-3 letter monogram from a name ("Mini Feature Platform" → "MFP"). */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Initials from an email or name for avatars. */
export function initials(value: string): string {
  const name = value.split("@")[0] ?? value;
  const parts = name.split(/[.\-_\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Compact relative time ("just now", "5m", "3h", "2d", or a date). */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Group key for the activity feed ("Today" / "Yesterday" / date). */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}
