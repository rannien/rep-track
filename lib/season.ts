export type Season = "halloween" | "thanksgiving";

// Local date, not UTC: all of October, then all of November.
export function seasonOn(date: Date): Season | null {
  const month = date.getMonth();
  if (month === 9) return "halloween";
  if (month === 10) return "thanksgiving";
  return null;
}
