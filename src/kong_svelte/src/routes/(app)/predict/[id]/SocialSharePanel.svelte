<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { X, Facebook, Copy } from "lucide-svelte";
  import {
    shareToTwitter,
    shareToFacebook,
    shareToReddit,
    shareToTikTok,
    shareToTelegram,
    copyLinkToClipboard
  } from "$lib/utils/socialShareUtils";

  export let marketUrl: string;
  export let marketQuestion: string = "Prediction Market";

  function handleShareToTwitter() {
    shareToTwitter(marketUrl, marketQuestion);
  }
  function handleShareToFacebook() {
    shareToFacebook(marketUrl);
  }
  function handleShareToReddit() {
    shareToReddit(marketUrl, marketQuestion);
  }
  function handleShareToTikTok() {
    shareToTikTok(marketUrl);
  }
  function handleShareToTelegram() {
    shareToTelegram(marketUrl, marketQuestion);
  }
  function handleCopyLinkToClipboard() {
    copyLinkToClipboard(marketUrl);
  }
</script>

<Panel
  variant="transparent"
  className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
>
  <div>
    <h3 class="text-sm font-medium text-kong-text-secondary mb-3">
      Share Market
    </h3>
    <div class="grid grid-cols-3 gap-3">
      <!-- X Button -->
      <button
        on:click={handleShareToTwitter}
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-black hover:bg-gray-900 text-white font-medium transition-colors"
        aria-label="Share to X"
      >
        <X class="w-5 h-5" />
        <span class="text-xs">X</span>
      </button>

      <!-- Telegram Button -->
      <button
        on:click={handleShareToTelegram}
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#0088cc] hover:bg-[#0077b3] text-white font-medium transition-colors"
        aria-label="Share to Telegram"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        ><path
            d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="0"
          /><path
            d="M5.5 12.5l3 1.5L9 17.5l4-5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          /><path
            d="M9 17.5l9-9-5 1-4.65 5.48"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          /></svg
        >
        <span class="text-xs">Telegram</span>
      </button>

      <!-- TikTok Button -->
      <button
        on:click={handleShareToTikTok}
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#000000] hover:bg-gray-900 text-white font-medium transition-colors"
        aria-label="Share to TikTok"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
          />
        </svg>
        <span class="text-xs">TikTok</span>
      </button>

      <!-- Facebook Button -->
      <button
        on:click={handleShareToFacebook}
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#1877F2] hover:bg-[#0E65D9] text-white font-medium transition-colors"
        aria-label="Share to Facebook"
      >
        <Facebook class="w-5 h-5" />
        <span class="text-xs">Facebook</span>
      </button>

      <!-- Reddit Button -->
      <button
        on:click={handleShareToReddit}
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#FF4500] hover:bg-[#E03D00] text-white font-medium transition-colors"
        aria-label="Share to Reddit"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        ><path
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="0"
          /><path
            d="M17.05 13.2c0-.2.05-.5.05-.85 0-2.8-3.11-5.05-6.95-5.05s-7 2.25-7 5.05c0 2.75 3.11 5.05 7 5.05a7.66 7.66 0 004.28-1.2 4.77 4.77 0 002.62-3z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          /><path
            d="M13.9 14.09a1.13 1.13 0 01-1.9 0M11.95 14.89a2.84 2.84 0 01-1.9-.7"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          /><circle
            cx="9.25"
            cy="13"
            r="1.25"
            fill="currentColor"
          /><circle
            cx="14.75"
            cy="13"
            r="1.25"
            fill="currentColor"
          /><path
            d="M18.55 10.65a1.5 1.5 0 10-3 0"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          /><circle
            cx="17.05"
            cy="8.8"
            r="1.25"
            fill="currentColor"
          /></svg
        >
        <span class="text-xs">Reddit</span>
      </button>

      <!-- Copy Link Button -->
      <button
        on:click={handleCopyLinkToClipboard}
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-kong-bg-secondary hover:bg-kong-bg-secondary text-kong-text-primary font-medium transition-colors"
        aria-label="Copy Link"
      >
        <Copy class="w-5 h-5" />
        <span class="text-xs">Copy Link</span>
      </button>
    </div>
  </div>
</Panel> 