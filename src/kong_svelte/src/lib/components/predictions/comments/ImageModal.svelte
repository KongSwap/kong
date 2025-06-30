<script lang="ts">
  import { X } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";

  let { imageUrl, altText, isOpen, onClose } = $props<{
    imageUrl: string;
    altText: string;
    isOpen: boolean;
    onClose: () => void;
  }>();

  // Prevent body scroll when modal is open
  $effect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Handle escape key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeydown);
    };
  });

  // Handle backdrop click
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    onclick={handleBackdropClick}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-label="Image viewer"
  >
    <div
      class="relative max-w-[90vw] max-h-[90vh]"
      transition:scale={{ duration: 200, start: 0.9 }}
    >
      <button
        onclick={onClose}
        class="absolute -top-10 right-0 text-white hover:text-kong-text-secondary
               transition-colors p-2 rounded-lg hover:bg-white/10"
        aria-label="Close image viewer"
      >
        <X size={24} />
      </button>

      <img
        src={imageUrl}
        alt={altText}
        class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        loading="eager"
      />
    </div>
  </div>
{/if}
