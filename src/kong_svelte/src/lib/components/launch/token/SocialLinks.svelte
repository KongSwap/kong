<script lang="ts">
  export let links: Array<{platform: string; url: string}> = [];
  export let tokenName = '';
  export let tokenSymbol = '';
  
  let newPlatform = '';
  let newUrl = '';
  let inputError = '';

  // Add platform icon mapping
  const platformIcons: Record<string, string> = {
    'twitter': 'M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.24 17.29 4 16.16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98-3.56-.18-6.73-1.89-8.84-4.48-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.2 4.2 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.52 8.52 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16.16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z',
    'discord': 'M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.01 15.33c-1.1 0-2.01-1.01-2.01-2.24c0-1.23.9-2.24 2.01-2.24c1.11 0 2.01 1.01 2.01 2.24c0 1.23-.89 2.24-2.01 2.24zm7.99 0c-1.1 0-2.01-1.01-2.01-2.24c0-1.23.9-2.24 2.01-2.24c1.11 0 2.01 1.01 2.01 2.24c0 1.23-.89 2.24-2.01 2.24z',
    'telegram': 'M11.78 15.83l.15.81c.2 0 .39-.09.53-.24l1.2-1.17c1.07-.99 1.5-.35.9.27l-1.7 1.66c-.33.33-.25.6.2.6h2.13c.91 0 1.3-.4 1.3-1.04 0-.2-.05-.4-.12-.57l-4.14-10.2c-.5-1.2-1.01-1.27-1.32-1.27-.3 0-.8.1-1.22.8l-.1.15-2.4 5.6c-.2.5.05.7.5.7h.9l-1.03 4.48c-.2.9.2 1.17.8 1.17h1.24c.5 0 .7-.2.9-.6l2.1-4.48h.8zM12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2m0-2a12 12 0 0 0 0 24 12 12 0 0 0 0-24z',
    'github': 'M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.07.63-1.32-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z',
    'reddit': 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.74c.69 0 1.25.56 1.25 1.25a1.25 1.25 0 0 1-2.5 0 1.25 1.25 0 0 1 1.25-1.25zM9.71 6.05c.84 0 1.24.62 1.24 1.17 0 .55-.4 1.17-1.24 1.17S8.5 7.77 8.5 7.22c0-.55.4-1.17 1.21-1.17zm4.28 4.14c-1.03 0-1.75.51-1.75 1.51 0 .73.39 1.12 1.75 1.12 1.36 0 1.75-.39 1.75-1.12 0-1-.72-1.51-1.75-1.51zm-5.52.01c-1.03 0-1.75.51-1.75 1.51 0 .73.39 1.12 1.75 1.12 1.36 0 1.75-.39 1.75-1.12 0-1-.72-1.51-1.75-1.51zm2.55 5.34c-3.77.24-5.03-.34-5.34-.64-.06-.1-.06-.2-.04-.29.15-.55 2.58-.5 5.45-.28.06.01.12.05.16.12.05.1.03.2-.02.28-.3.4-.77.6-1.27.6s-.97-.2-1.27-.6a.26.26 0 0 1-.02-.28c.04-.07.1-.11.16-.12 2.87-.22 5.3-.27 5.45.28.02.09 0 .19-.04.29-.31.3-1.57.88-5.34.64z'
  };

  function detectPlatform(url: string) {
    const host = new URL(url).hostname;
    if (host.includes('twitter')) return 'twitter';
    if (host.includes('discord')) return 'discord';
    if (host.includes('t.me') || host.includes('telegram')) return 'telegram';
    if (host.includes('github')) return 'github';
    if (host.includes('reddit')) return 'reddit';
    return 'link';
  }

  function addLink() {
    if (!newPlatform.trim() || !newUrl.trim()) {
      inputError = 'Both fields are required';
      return;
    }
    
    // Basic URL validation
    try {
      const urlObj = new URL(newUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error();
      }
    } catch {
      newUrl = `https://${newUrl}`;
    }

    links = [...links, { platform: newPlatform.trim(), url: newUrl.trim() }];
    newPlatform = '';
    newUrl = '';
    inputError = '';
  }

  function removeLink(index: number) {
    links = links.filter((_, i) => i !== index);
  }
</script>

<div class="space-y-6 custom-links-section group">
  <!-- Header with animated pulse -->
  <div class="flex items-center gap-3 mb-6">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Connect Your Community
    </h3>
  </div>
  
  <!-- Enhanced input form with gradient focus -->
  <form on:submit|preventDefault={addLink} class="space-y-4">
    <div class="flex gap-3 transition-all duration-300 hover:shadow-glow">
      <div class="relative flex-1">
        <input
          type="text"
          bind:value={newPlatform}
          placeholder="Platform"
          class="w-full px-4 py-3 transition-all duration-200 border bg-kong-bg-light border-kong-border/30 rounded-xl placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50 peer"
        />
        <div class="absolute inset-0 transition-all duration-300 pointer-events-none rounded-xl -z-10 peer-focus:bg-gradient-to-r peer-focus:from-kong-primary/10 peer-focus:to-kong-accent-blue/10" />
      </div>
      
      <div class="relative flex-1">
        <input
          type="text"
          bind:value={newUrl}
          placeholder="Full URL"
          class="w-full px-4 py-3 transition-all duration-200 border bg-kong-bg-light border-kong-border/30 rounded-xl placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50 peer"
        />
        <div class="absolute inset-0 transition-all duration-300 pointer-events-none rounded-xl -z-10 peer-focus:bg-gradient-to-r peer-focus:from-kong-primary/10 peer-focus:to-kong-accent-blue/10" />
      </div>
    </div>

    <!-- Dynamic help text -->
    <div class="px-3 text-xs text-kong-text-secondary/60">
      {#if !newUrl}
        Try: <button type="button" on:click={() => {
          newPlatform = 'Discord';
          newUrl = 'https://discord.gg/your-server';
        }} class="text-kong-accent-blue hover:underline">Discord Server</button> • 
        <button type="button" on:click={() => {
          newPlatform = 'Telegram';
          newUrl = 'https://t.me/your-group';
        }} class="text-kong-accent-blue hover:underline">Telegram Group</button> • 
        <button type="button" on:click={() => {
          newPlatform = 'Twitter';
          newUrl = 'https://twitter.com/your-handle';
        }} class="text-kong-accent-blue hover:underline">Twitter Profile</button>
      {:else}
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4 text-kong-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {detectPlatform(newUrl).replace(/^\w/, c => c.toUpperCase())} link detected
        </span>
      {/if}
    </div>

    <!-- Enhanced error state -->
    {#if inputError}
      <div class="flex items-center gap-2 p-3 text-sm border rounded-lg bg-kong-accent-red/10 text-kong-accent-red border-kong-accent-red/20 animate-shake">
        <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        {inputError}
      </div>
    {/if}
    
    <!-- Glowing action button -->
    <button
      type="submit"
      class="flex items-center justify-center w-full gap-2 px-6 py-3 font-medium text-white transition-all duration-300 rounded-xl 
             bg-gradient-to-r from-kong-primary/90 to-kong-accent-blue/90 hover:from-kong-primary 
             hover:to-kong-accent-blue hover:shadow-glow active:scale-[0.98]"
    >
      <svg class="w-5 h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
      </svg>
      <span class="drop-shadow-sm">Add Community Link</span>
    </button>
  </form>

  <!-- Links list with platform-specific styling -->
  <div class="space-y-3 added-links">
    {#each links as link, index (index)}
      <div class="group/link relative transition-all duration-200 hover:-translate-y-0.5">
        <div class="absolute inset-0 transition-opacity duration-300 rounded-lg opacity-0 bg-gradient-to-r from-kong-primary/10 to-kong-accent-blue/10 group-hover/link:opacity-100" />
        
        <div class="relative flex items-center justify-between p-4 transition-all duration-200 border rounded-lg bg-kong-bg-light/30 border-kong-border/20 hover:border-kong-primary/30">
          <div class="flex items-center flex-1 min-w-0 gap-3">
            <!-- Platform icon -->
            <div class="p-2 rounded-lg bg-kong-bg-dark/50">
              <svg class="w-5 h-5 text-kong-primary" viewBox="0 0 24 24">
                {#if platformIcons[detectPlatform(link.url)]}
                  <path fill="currentColor" d={platformIcons[detectPlatform(link.url)]} />
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                {/if}
              </svg>
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="mb-1 text-sm font-semibold truncate text-kong-text-primary">
                {link.platform}
              </p>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm break-all text-kong-accent-blue hover:text-kong-accent-blue/80 transition-colors"
              >
                <span class="truncate">{link.url}</span>
                <svg class="flex-shrink-0 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            </div>
          </div>
          
          <button
            on:click={() => removeLink(index)}
            class="p-1.5 text-kong-text-secondary hover:text-kong-accent-red rounded-full transition-colors duration-150 hover:bg-kong-bg-light/20 ml-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {:else}
      <!-- Empty state with animation -->
      <div class="flex flex-col items-center py-8 space-y-3 text-center rounded-lg bg-kong-bg-light/5 animate-pulse-slow">
        <svg class="w-12 h-12 text-kong-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 3.999l3.316 3m3.316-3l-3.316 3M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3h.01"/>
        </svg>
        <p class="italic text-kong-text-secondary/70">
          No links yet - let's build your community! 🚀
        </p>
      </div>
    {/each}
  </div>
</div>

<style>
  .animate-shake {
    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
  }

  @keyframes shake {
    10%, 90% { transform: translateX(-1px); }
    20%, 80% { transform: translateX(2px); }
    30%, 50%, 70% { transform: translateX(-3px); }
    40%, 60% { transform: translateX(3px); }
  }

  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
