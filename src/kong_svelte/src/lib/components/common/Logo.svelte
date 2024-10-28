<script lang="ts">
    import { t } from '$lib/translations';
    import { fade } from 'svelte/transition';

    function handleImageError(event: Event) {
        const img = event.target as HTMLImageElement;
        img.src = '/tokens/KONG.svg';
    }
</script>
  
<div class="logo-container" transition:fade>
  <a 
    href="/" 
    class="flex items-center gap-3 group transition-all duration-300"
  >
    <div class="logo-image-container">
      <img 
        src="/tokens/KONG.svg"
        alt={$t('nav.logoAlt')}
        class="w-10 h-10 object-contain transform group-hover:scale-110 transition-transform duration-300"
        on:error={handleImageError}
      />
    </div>
    <span class="logo-text">
      {$t('nav.logo')}
    </span>
  </a>
</div>
  
<style lang="postcss">
  .logo-container {
    @apply relative flex items-center;
  }
  
  .logo-image-container {
    @apply relative flex items-center justify-center w-10 h-10 rounded-full overflow-hidden;
    @apply bg-gradient-to-br from-kong-green/20 to-kong-yellow/20;
  }
  
  .logo-text {
    @apply text-2xl font-alumni font-bold text-white;
    @apply group-hover:text-kong-yellow transition-colors duration-300;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
</style>
