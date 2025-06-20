<script lang="ts">
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { fade, fly } from "svelte/transition";
  import ButtonV2 from "./ButtonV2.svelte";
  import DialogPortal from "./DialogPortal.svelte";

  let {
    title,
    showClose = true,
    closeLabel = "Close",
    open = $bindable(false),
    onClose = (source: "backdrop" | "button") => {},
    children = [],
    transparent = false,
  } = $props<{
    title: string;
    showClose?: boolean;
    closeLabel?: string;
    open: boolean;
    onClose?: (source: "backdrop" | "button") => void;
    children: any;
    transparent?: boolean;
  }>();

  let isOpen = $state(open);
  $effect(() => {
    isOpen = open;
  });

  function handleBackdropClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    isOpen = false;
    open = false;
    onClose("backdrop");
  }

  function handleCloseClick() {
    isOpen = false;
    open = false;
    onClose("button");
  }
</script>

{#if isOpen}
  <DialogPortal>
    <div
      role="dialog"
      class="fixed inset-0 flex items-center justify-center bg-kong-bg-primary/80 backdrop-blur-md z-[1000]"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
     onclick={handleBackdropClick}
    >
      <div
        class="{$panelRoundness} bg-gradient-to-b from-kong-bg-secondary to-kong-bg-primary flex flex-col justify-between gap-4 p-6 max-w-[90%] w-[480px] border border-kong-border shadow-2xl"
        role="document"
        in:fly={{ y: 20, duration: 300, delay: 100 }}
        out:fly={{ y: 20, duration: 200 }}
        onclick={(e) => e.stopPropagation()}
      >
      
        <div class="flex items-center justify-between">
          <h2
            class="text-kong-text-primary m-0 text-2xl font-semibold leading-tight"
          >
            {title}
          </h2>
        </div>
        <div class="text-kong-text-secondary leading-normal">
          {@render children?.()}
        </div>
        {#if showClose}
          <ButtonV2
            label={closeLabel}
            theme="primary"
            variant="solid"
            size="lg"
            onclick={handleCloseClick}
          />
        {/if}
      </div>
    </div>
  </DialogPortal>
{/if}
