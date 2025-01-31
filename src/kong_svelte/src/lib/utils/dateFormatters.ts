import { formatDistance } from "date-fns";

export function formatTimestamp(timestamp: string): string {
  if (!timestamp) {
    return "N/A";
  }

  try {
    // Ensure we're parsing as UTC by appending Z if not present
    const txDate = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
    
    // Format in local timezone with date and time
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use local timezone
    });

    return formatter.format(txDate);
  } catch (e) {
    console.error("Error formatting timestamp:", e);
    return "N/A";
  }
} 