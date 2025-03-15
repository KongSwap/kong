import { toastStore } from "$lib/stores/toastStore";

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toastStore.info("Copied to clipboard");
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
} 