<script lang="ts">
  import { tokenInfo } from '../stores/token-info';
  
  const currentYear = new Date().getFullYear();
  
  // todo get from token info
  const socialLinks = [
    { name: 'Twitter', url: '#', icon: 'fa-twitter' },
    { name: 'Discord', url: '#', icon: 'fa-discord' },
    { name: 'Telegram', url: '#', icon: 'fa-telegram' },
  ];

</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</svelte:head>

<footer class="w-full bg-[var(--card-bg)] border-t border-white/10 p-4 fixed bottom-0 left-0 right-0 z-10">
  <div class="max-w-[var(--max-width)] mx-auto px-[var(--container-padding)] flex justify-between items-center text-gray-500 text-sm md:flex-row md:text-left">
    <div>
      <p>© {currentYear} {$tokenInfo.name}</p>
    </div>
    <div>
      <p>
        Built on the 
        <a href="https://internetcomputer.org" target="_blank" rel="noopener noreferrer" class="text-[var(--text-green)] no-underline hover:text-white transition-colors duration-200">
          Internet Computer
        </a> 
        and launched on 
        <a href="https://www.kongswap.io/launch" target="_blank" rel="noopener noreferrer" class="text-[var(--text-green)] no-underline hover:text-white transition-colors duration-200">
          KongSwap
        </a>
      </p>
    </div>
    <div class="flex gap-4 mt-2 md:mt-0">
      {#each socialLinks as social (social.name)}
        <a 
          href={social.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          aria-label={social.name}
          class="text-lg text-gray-500 transition-colors duration-200 hover:text-white"
        >
          <i class={`fa-brands ${social.icon}`}></i>
        </a>
      {/each}
    </div>
  </div>
</footer>
