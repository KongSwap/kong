<script lang="ts">
  import kongLogo from "$lib/assets/kong_logo.png";
  import Dialog from "./Dialog.svelte";

  export let open = false;
  export let onClose: (arg: { source: 'backdrop' | 'button' }) => void;
</script>

<Dialog 
  title="Install Kong" 
  bind:open
  onClose={(source) => onClose({ source })}
  closeLabel="Done"
  showClose={true}
>
  <div class="flex flex-col items-center gap-8 py-3 md:gap-8">
    <div class="flex items-center gap-4">
      <div class="relative flex pb-3.5">
        <img src={kongLogo} alt="Kong Logo" class="relative z-[1] h-[76px] w-[76px] rounded-2xl shadow-lg sm:h-16 sm:w-16 sm:rounded-[14px]" />
        <div class="absolute bottom-0 left-1/2 h-5 w-4/5 -translate-x-1/2 blur-sm" style="background: radial-gradient(ellipse at center, rgb(var(--color-k-light-blue) / 0.2) 0%, transparent 70%);"></div>
      </div>
      <div class="flex flex-col pb-5">
        <div class="text-lg font-medium">KongSwap</div>
        <div class="text-sm text-white/60">Rumble in the crypto jungle</div>
      </div>
    </div>
    
    <div class="flex w-full flex-col gap-6">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-k-light-blue/15 text-sm font-semibold text-k-light-blue">1</span>
          <h3 class="m-0 text-base font-medium text-white sm:text-sm">Open Share Menu</h3>
        </div>
        <div class="flex items-center gap-3 pl-9 text-white/70 sm:pl-8">
          <span class="inline-flex items-center text-k-light-blue/90">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </span>
          <p class="m-0 text-[0.9375rem] leading-normal sm:text-sm">Tap the <span class="font-medium text-k-light-blue">Share button</span> in Safari's toolbar</p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-k-light-blue/15 text-sm font-semibold text-k-light-blue">2</span>
          <h3 class="m-0 text-base font-medium text-white sm:text-sm">Find Add to Home Screen</h3>
        </div>
        <div class="flex items-center gap-3 pl-9 text-white/70 sm:pl-8">
          <span class="inline-flex items-center text-k-light-blue/90">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M12 8v8"/>
              <path d="M8 12h8"/>
            </svg>
          </span>
          <p class="m-0 text-[0.9375rem] leading-normal sm:text-sm">Scroll down and tap <span class="font-medium text-k-light-blue">Add to Home Screen</span></p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-k-light-blue/15 text-sm font-semibold text-k-light-blue">3</span>
          <h3 class="m-0 text-base font-medium text-white sm:text-sm">Install Kong</h3>
        </div>
        <div class="flex items-center gap-3 pl-9 text-white/70 sm:pl-8">
          <span class="inline-flex items-center text-k-light-blue/90">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14"/>
              <path d="M12 5l7 7-7 7"/>
            </svg>
          </span>
          <p class="m-0 text-[0.9375rem] leading-normal sm:text-sm">Tap <span class="font-medium text-k-light-blue">Add</span> to install Kong on your device</p>
        </div>
      </div>
    </div>
  </div>
</Dialog>

<style lang="postcss">
  /* Only keeping this style since it's a complex gradient that's harder to do with Tailwind */
  .icon-reflection {
    background: radial-gradient(ellipse at center, theme(colors.k-light-blue / 20%) 0%, transparent 70%);
  }
</style> 