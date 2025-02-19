<script lang="ts">
  import { goto } from "$app/navigation";
import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  export let type: "info" | "warning" | "success" | "error" = "info";
  export let dismissible = true;
  export let href: string = "#";

  const isVisible = writable(true);

  const bgColors = {
    info: "bg-blue-500/50",
    warning: "bg-yellow-500/50",
    success: "bg-green-500/50",
    error: "bg-red-500/50"
  };

  const textColors = {
    info: "text-white",
    warning: "text-white",
    success: "text-white",
    error: "text-white"
  };

  function dismiss() {
    $isVisible = false;
  }
</script>

{#if $isVisible}
  <div 
    class="w-full {bgColors[type]}" 
    role="alert"
  >
    <div class="container mx-auto px-4 py-2 flex items-center justify-between">
      <button class="flex items-center gap-2" onclick={() => goto(href)}>
        {#if $$slots.icon}
          <div class="flex-shrink-0">
            <slot name="icon" />
          </div>
        {/if}
        <span class="{textColors[type]} font-medium text-sm md:text-base">
          <slot>Default alert message</slot>
        </span>
      </button>
      {#if dismissible}
        <button
          onclick={dismiss}
          class="{textColors[type]} hover:opacity-75 transition-opacity"
          aria-label="Dismiss alert"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if}
