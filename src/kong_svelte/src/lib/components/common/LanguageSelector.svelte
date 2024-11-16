<script lang="ts">
  import { Us, Es } from "svelte-flags";
  import { settingsStore } from "$lib/services/settings/settingsStore";
  import { fly } from "svelte/transition";
  import Button from './Button.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { get } from 'svelte/store';

  let isOpen: boolean = false;
  let currentLang;
  settingsStore.currentLanguage.subscribe(value => {
    if(!value) {
      settingsStore.updateSetting('default_language', 'en');
    }
    currentLang = value;
  });

  const languages = [
    { code: "en", name: "English", flag: Us },
    { code: "es", name: "Español", flag: Es },
  ];

  function changeLanguage(lang: string) {
    settingsStore.updateSetting('default_language', lang as 'en' | 'es');
    isOpen = false;
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }
</script>

<div class="relative inline-block p-2 w-[120px] text-white" use:clickOutside={() => { isOpen = false; }}>
  <!-- Dropdown Button -->
  <Button
    text={$settingsStore.default_language}
    variant="yellow"
    size="medium"
    state={isOpen ? 'selected' : 'default'}
    onClick={toggleDropdown}
  >
    <div class="flex items-center gap-2">
      {#each languages as { code, flag: Flag }}
        {#if currentLang === code}
          <Flag class="w-5 h-5 flex-shrink-0" />
          <span class="text-sm">{code.toUpperCase()}</span>
        {/if}
      {/each}
    </div>
  </Button>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div 
      class="absolute left-10 w-[180px] rounded-md shadow-lg z-[9999]"
      in:fly={{ y: -10, duration: 150 }}
      out:fly={{ y: -10, duration: 150 }}
    >
      <ul 
        class="z-999 flex flex-col gap-2 text-lg bg-[#eece00] border-2 border-black rounded-xl p-4 relative"
        role="listbox"
      >
        {#each languages as { code, name, flag: Flag }}
          <li
            class="w-[150px] flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-black/5 transition-colors duration-200"
            role="option"
            tabindex="0"
            aria-selected={get(settingsStore.currentLanguage) === code}
            on:click={() => changeLanguage(code)}
            on:keydown={(e) => (e.key === "Enter" || e.key === " ") && changeLanguage(code)}
          >
            <Flag class="w-5 h-5 flex-shrink-0" />
            <span class="text-black">{name}</span>
            {#if get(settingsStore.currentLanguage) === code}
              <svg class="w-4 h-4 ml-auto text-green-500" viewBox="0 0 24 24">
                <path 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                  stroke-width="2.5" 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
