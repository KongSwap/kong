<script lang="ts">
  let links: Array<{platform: string; url: string}> = [];
  let newPlatform = '';
  let newUrl = '';
  let inputError = '';

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

<div class="space-y-4 custom-links-section group">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Connect Your Community
    </h3>
  </div>
  
  <form on:submit|preventDefault={addLink} class="space-y-3">
    <div class="flex gap-2 transition-shadow duration-300 hover:shadow-glow">
      <input
        type="text"
        bind:value={newPlatform}
        placeholder="Platform (e.g. Discord)"
        class="flex-1 px-4 py-3 transition-all duration-200 border bg-kong-bg-light border-kong-border/30 rounded-xl placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
      />
      <input
        type="text"
        bind:value={newUrl}
        placeholder="Full URL"
        class="flex-1 px-4 py-3 transition-all duration-200 border bg-kong-bg-light border-kong-border/30 rounded-xl placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
      />
    </div>
    
    {#if inputError}
      <p class="flex items-center gap-2 text-sm text-kong-accent-red">
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        {inputError}
      </p>
    {/if}
    
    <button
      type="submit"
      class="w-full px-6 py-3 font-medium text-white transition-all duration-300 rounded-xl 
             bg-gradient-to-r from-kong-primary/90 to-kong-accent-blue/90 hover:from-kong-primary 
             hover:to-kong-accent-blue hover:shadow-glow active:scale-[0.98]"
    >
      <span class="drop-shadow-sm">+ Add Link</span>
    </button>
  </form>

  <div class="space-y-3 added-links">
    {#each links as link, index (index)}
      <div class="flex items-center justify-between p-4 transition-all duration-200 border rounded-lg bg-kong-bg-light/30 border-kong-border/20 hover:border-kong-primary/30 group/link">
        <div class="flex-1 pr-4">
          <p class="flex items-center gap-2 mb-1 font-semibold text-kong-text-primary">
            <span class="w-2 h-2 rounded-full bg-kong-primary animate-pulse"></span>
            {link.platform}
          </p>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm break-words text-kong-accent-blue hover:text-kong-accent-blue/80 
                  transition-colors flex items-center gap-1.5"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
            {link.url}
          </a>
        </div>
        <button
          on:click={() => removeLink(index)}
          class="p-1.5 text-kong-text-secondary hover:text-kong-accent-red rounded-full 
                transition-colors duration-150 hover:bg-kong-bg-light/20"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    {:else}
      <div class="py-6 text-center rounded-lg bg-kong-bg-light/5">
        <p class="italic text-kong-text-secondary/70">
          No links yet - your community awaits!
        </p>
      </div>
    {/each}
  </div>
</div>

<style>
  .custom-links-section {
    margin-top: 1.5rem;
    border-radius: 1rem;
    background: linear-gradient(
      145deg,
      rgba(var(--bg-dark), 0.8) 0%,
      rgba(var(--bg-light), 0.4) 100%
    );
    backdrop-filter: blur(4px);
    border: 1px solid rgba(var(--border), 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .shadow-glow {
    box-shadow: 0 0 20px rgba(var(--primary), 0.15);
  }
</style>
