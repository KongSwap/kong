<script lang="ts">
  import { Us, Es } from "svelte-flags";
  import { localeStore, switchLocale } from "$lib/services/translations";
  import { fly } from "svelte/transition";
  import Button from './Button.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { get } from 'svelte/store';

  let isOpen: boolean = false;

  const languages = [
    { code: "en", name: "English", flag: Us },
    { code: "es", name: "Español", flag: Es },
  ];

  function changeLanguage(lang: string) {
    switchLocale(lang);
    isOpen = false;
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }
</script>

<div class="relative inline-block p-2 w-[120px] text-white" use:clickOutside={() => { isOpen = false; }}>
  <!-- Dropdown Button -->
  <Button
    text={$localeStore.toUpperCase()}
    variant="yellow"
    size="medium"
    state={isOpen ? 'selected' : 'default'}
    onClick={toggleDropdown}
  >
    <div class="flex items-center gap-2">
      {#each languages as { code, flag: Flag }}
        {#if $localeStore === code}
          <Flag class="w-5 h-5 flex-shrink-0" />
          <span class="text-sm">{$localeStore.toUpperCase()}</span>
        {/if}
      {/each}
    </div>
  </Button>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div 
      class="absolute top-full right-0 mt-2 w-[180px] bg-white rounded-md shadow-lg z-[1005]"
      in:fly={{ y: -10, duration: 150 }}
      out:fly={{ y: -10, duration: 150 }}
    >
      <ul class="flex flex-col gap-2 text-lg bg-[#eece00] border-2 border-black rounded-xl p-4 fixed z-[1005]" role="listbox">
        {#each languages as { code, name, flag: Flag }}
          <li
            class="w-[150px] flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-black/5 transition-colors duration-200"
            role="option"
            tabindex="0"
            aria-selected={get(localeStore) === code}
            on:click={() => changeLanguage(code)}
            on:keydown={(e) => (e.key === "Enter" || e.key === " ") && changeLanguage(code)}
          >
            <Flag class="w-5 h-5 flex-shrink-0" />
            <span class="text-black">{name}</span>
            {#if get(localeStore) === code}
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
