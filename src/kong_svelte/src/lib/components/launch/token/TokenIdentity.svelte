<script lang="ts">
  import { compressImage } from "$lib/utils/imageUtils";
  import { toastStore } from "$lib/stores/toastStore";
  
  // Basic token parameters
  export let name: string = "";
  export let symbol: string = "";
  export let logo: string = "";

  // Logo file handling
  let logoPreview: string = logo; // Initialize from the logo prop
  let isCompressing = false;
  
  // Make sure logoPreview stays in sync with logo when coming back to this step
  $: logoPreview = logo || logoPreview;

  async function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      try {
        isCompressing = true;
        
        // Check file size before compression
        const fileSizeMB = file.size / (1024 * 1024);
        console.log(`Original file size: ${fileSizeMB.toFixed(2)}MB`);
        
        // Compress the image
        const compressedDataUrl = await compressImage(file, {
          maxWidthOrHeight: 800,
          maxSizeMB: 0.5, // 1MB max size
          useWebWorker: true
        });
        
        logoPreview = compressedDataUrl;
        logo = compressedDataUrl;
        
        isCompressing = false;
      } catch (error) {
        console.error('Error processing image:', error);
        toastStore.error('Failed to process image. Please try another file.');
        isCompressing = false;
      }
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3 mb-6">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Token Identity & Branding
    </h3>
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    <!-- Left Column: Name & Symbol -->
    <div class="space-y-6">
      <!-- Token Name -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Token Name <span class="text-kong-accent-red">*</span>
        </label>
        
        <!-- Name Input with Icon -->
        <div class="relative">
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg class="w-5 h-5 text-kong-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <input
            type="text"
            bind:value={name}
            class="w-full py-3 pl-10 pr-4 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
            placeholder="e.g., Kong Token, Bitcoin, USD Coin"
            maxlength="40"
          />
        </div>
        
        <!-- Name Examples -->
        {#if !name}
          <div class="flex flex-wrap gap-2 mt-3">
            <div class="px-3 py-1 text-xs border rounded-lg bg-kong-bg-dark/50 border-kong-border/30 text-kong-text-secondary">
              e.g., Kong Token
            </div>
            <div class="px-3 py-1 text-xs border rounded-lg bg-kong-bg-dark/50 border-kong-border/30 text-kong-text-secondary">
              e.g., Internet Computer Token
            </div>
            <div class="px-3 py-1 text-xs border rounded-lg bg-kong-bg-dark/50 border-kong-border/30 text-kong-text-secondary">
              e.g., Proof of Work Token
            </div>
          </div>
        {/if}
        
        <div class="flex justify-between mt-2 text-xs text-kong-text-secondary/50">
          <span class="flex items-center gap-1.5">
            {#if name.length === 0}
              <span class="w-2 h-2 rounded-full bg-kong-accent-red/80 animate-pulse"></span>
              Required
            {:else}
              <span class="w-2 h-2 rounded-full bg-kong-primary/80"></span>
              {name.length}/40
            {/if}
          </span>
          <span>Full display name of your token</span>
        </div>
      </div>

      <!-- Token Symbol -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Token Symbol <span class="text-kong-accent-red">*</span>
        </label>
        
        <!-- Symbol Input with Styling -->
        <div class="relative">
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span class="font-mono text-sm font-bold text-kong-primary/70">$</span>
          </div>
          <input
            type="text"
            bind:value={symbol}
            class="w-full py-3 pl-10 pr-4 font-mono text-sm font-medium uppercase transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
            placeholder="e.g., BTC, ETH, USDC"
            maxlength="10"
            on:input={(e) => {
              const target = e.target as HTMLInputElement;
              target.value = target.value.toUpperCase();
            }}
          />
        </div>
        
        <!-- Symbol Examples -->
        {#if !symbol}
          <div class="flex flex-wrap gap-2 mt-3">
            <div class="px-3 py-1 text-xs border rounded-lg bg-kong-bg-dark/50 border-kong-border/30 text-kong-text-secondary">
              e.g., KONG
            </div>
            <div class="px-3 py-1 text-xs border rounded-lg bg-kong-bg-dark/50 border-kong-border/30 text-kong-text-secondary">
              e.g., POW
            </div>
            <div class="px-3 py-1 text-xs border rounded-lg bg-kong-bg-dark/50 border-kong-border/30 text-kong-text-secondary">
              e.g., ICP
            </div>
          </div>
        {/if}
        
        <div class="flex justify-between mt-2 text-xs text-kong-text-secondary/50">
          <span class="flex items-center gap-1.5">
            {#if symbol.length === 0}
              <span class="w-2 h-2 rounded-full bg-kong-accent-red/80 animate-pulse"></span>
              Required
            {:else}
              <span class="w-2 h-2 rounded-full bg-kong-primary/80"></span>
              {symbol.length}/10
            {/if}
          </span>
          <span>Short ticker symbol (e.g., BTC)</span>
        </div>
      </div>
    </div>

    <!-- Right Column: Logo -->
    <div>
      <!-- Logo Upload -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-3 text-sm font-medium text-kong-text-primary/80">
          Token Logo
        </label>
        <label class="flex flex-col items-center justify-center w-full h-48 overflow-hidden transition-all duration-200 border-2 border-dashed cursor-pointer rounded-xl border-kong-border/30 hover:border-kong-primary/50 group">
          {#if isCompressing}
            <div class="flex flex-col items-center">
              <div class="w-8 h-8 border-4 border-t-kong-primary rounded-full animate-spin"></div>
              <span class="mt-3 text-xs text-kong-text-secondary/60">Compressing image...</span>
            </div>
          {:else if logoPreview}
            <div class="flex flex-col items-center">
              <div class="flex mb-3 space-x-6">
                <!-- Round preview -->
                <div class="relative w-24 h-24 overflow-hidden transition-transform duration-300 border rounded-full group-hover:scale-105 border-kong-border/20">
                  <img 
                    src={logoPreview} 
                    alt="Token logo round" 
                    class="object-cover w-full h-full"
                  />
                </div>
                <!-- Square preview -->
                <div class="relative w-24 h-24 overflow-hidden transition-transform duration-300 border rounded-xl group-hover:scale-105 border-kong-border/20">
                  <img 
                    src={logoPreview} 
                    alt="Token logo square" 
                    class="object-cover w-full h-full"
                  />
                </div>
              </div>
              <span class="text-xs text-kong-text-secondary/60">Click to change</span>
            </div>
          {:else}
            <div class="text-center">
              <div class="mb-2 text-kong-text-secondary/50">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <span class="text-xs text-kong-text-secondary/60">Click to upload</span>
              <span class="block text-xs text-kong-text-secondary/40">PNG, JPG (max 2MB, will be compressed)</span>
            </div>
          {/if}
          <input type="file" accept="image/*" on:change={handleLogoUpload} class="hidden" />
        </label>
      </div>
    </div>
  </div>
</div> 
