<script lang="ts">
    import { goto } from '$app/navigation';
import { t } from '$lib/services/translations';
    import { fade } from 'svelte/transition';

    function handleImageError(event: Event) {
        const img = event.target as HTMLImageElement;
        img.src = '/titles/kong_logo.png';
    }
</script>
  
<div class="logo-container" transition:fade>
  <button 
    on:click={() => goto('/')}
    class="flex items-center gap-3 group transition-all duration-300"
  >
    <div class="logo-image-container">
      <picture>
        <source srcset="/titles/kong_logo.webp" type="image/webp">
        <source srcset="/titles/kong_logo.png" type="image/png">
        <img 
          src="/titles/kong_logo.png"
          alt={$t('nav.logoAlt')}
          class="w-10 h-10 object-contain transform group-hover:scale-110 transition-transform duration-300"
          style="-webkit-backface-visibility: hidden; -webkit-transform: translateZ(0);"
          on:error={handleImageError}
        />
      </picture>
    </div>
    <span class="logo-text">
      {$t('nav.logo')}
    </span>
  </button>
</div>
  
<style lang="postcss">
  .logo-container {
    @apply relative flex items-center;
  }
  
  .logo-image-container {
    @apply relative flex items-center justify-center w-10 h-10 rounded-full overflow-hidden;
    background: linear-gradient(135deg, rgba(var(--kong-green-rgb), 0.2), rgba(var(--kong-yellow-rgb), 0.2));
    -webkit-transform: translateZ(0);
    -webkit-backface-visibility: hidden;
  }
  
  .logo-text {
    @apply text-2xl font-alumni font-bold text-white;
    @apply group-hover:text-kong-yellow transition-colors duration-300;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
</style>
