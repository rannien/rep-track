export type Season = "halloween";

// Local date, not UTC: all of October.
export function seasonOn(date: Date): Season | null {
  return date.getMonth() === 9 ? "halloween" : null;
}
