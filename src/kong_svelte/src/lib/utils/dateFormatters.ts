import { formatDistance } from "date-fns";

export function formatTimestamp(timestamp: string): string {
  if (!timestamp) {
    return "N/A";
  }

  try {
    let txDate: Date;
    
    // Check if the timestamp is a Unix timestamp (milliseconds)
    if (/^\d{13}$/.test(timestamp)) {
      txDate = new Date(parseInt(timestamp));
    } else {
      // Handle ISO string format
      txDate = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
    }
    
    // Validate that we have a valid date
    if (isNaN(txDate.getTime())) {
      console.warn("Invalid date value received:", timestamp);
      return "N/A";
    }

    // Check if the date is in the future
    const now = new Date();
    if (txDate > now) {
      console.warn("Future timestamp detected, using current time:", timestamp);
      txDate = now;
    }
    
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
    console.error("Error formatting timestamp:", e, "Input:", timestamp);
    return "N/A";
  }
} 