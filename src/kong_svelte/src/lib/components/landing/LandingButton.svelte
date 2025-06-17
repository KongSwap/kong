<script lang="ts">
  import type { MouseEventHandler } from 'svelte/elements';

  let {
    text = 'LAUNCH',
    onClick = () => {},
    buttonClass = '', // Allow passing extra classes
    textClass = '',
    iconClass = 'w-5 h-5 ml-2 relative z-10',
    ariaLabel = 'Launch application',
    glowClass = '' // Add prop for glow-specific styles
  } = $props<{ 
    text?: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    buttonClass?: string;
    textClass?: string;
    iconClass?: string;
    ariaLabel?: string;
    glowClass?: string; // Add prop type
  }>();

  // Base classes - Remove color/bg/border/shadow styles. Keep layout, text size/style, transitions.
  const baseButtonClass = "relative text-nowrap inline-flex items-center overflow-hidden rounded px-6 py-2.5 text-[0.9rem] font-semibold tracking-wider uppercase transition-[transform,color,background-color,border-color,box-shadow] duration-300 ease-in-out backdrop-blur-sm font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] hover:-translate-y-0.5 active:translate-y-0.5";
  const baseTextClass = "relative z-10 text-nowrap";
  const baseGlowClass = "absolute inset-0 opacity-0 z-[1] transition-opacity duration-300 ease-in-out group-hover:opacity-100 group-hover:animate-pulse";

</script>

<button 
  class="group {baseButtonClass} {buttonClass}" 
  onclick={onClick}
  aria-label={ariaLabel}
>
  <span class="{baseTextClass} {textClass}">{text}</span>
  <div class="{baseGlowClass} {glowClass}"></div>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="{iconClass}">
    <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" />
  </svg>
</button>

<style>
  /* Add group class for hover effects on glow */
  /* No need for style block anymore unless other styles are added */
</style> 