import { formatDistance } from "date-fns";

export function formatTimestamp(timestamp: string): string {
  if (!timestamp) {
    return "N/A";
  }

  try {
    const txDate = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + "Z");
    const now = new Date();

    return formatDistance(txDate, now, {
      addSuffix: true,
      includeSeconds: true,
    });
  } catch (e) {
    console.error("Error formatting timestamp:", e);
    return "N/A";
  }
} 