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

<div class="language-selector inline-block p-2 " use:clickOutside={() => { isOpen = false; }}>
  <!-- Dropdown Button -->
  <Button
    text={$localeStore.toUpperCase()}
    variant="yellow"
    size="medium"
    state={isOpen ? 'selected' : 'default'}
    onClick={toggleDropdown}
  >
    <div class="button-content flex items-center gap-2">
      {#each languages as { code, flag: Flag }}
        {#if $localeStore === code}
          <Flag class="flag w-5 h-5" />
          <span class="language-code ">{$localeStore.toUpperCase()}</span>
        {/if}
      {/each}
    </div>
  </Button>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div 
      class="language-dropdown right-0 w-48 bg-white rounded-md shadow-lg"
      in:fly={{ y: -10, duration: 150 }}
      out:fly={{ y: -10, duration: 150 }}
    >
          <ul class="language-list text-lg bg-[#64AD3B] fixed" role="listbox">
            {#each languages as { code, name, flag: Flag }}
              <li
                class="language-option w-[150px] flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-100"
                role="option"
                tabindex="0"
                aria-selected={get(localeStore) === code}
                on:click={() => changeLanguage(code)}
                on:keydown={(e) => (e.key === "Enter" || e.key === " ") && changeLanguage(code)}
              >
                <Flag class="flag w-5 h-5" />
                <span class="text-black">{name}</span>
                {#if get(localeStore) === code}
                  <svg class="checkmark w-4 h-4 ml-auto text-green-500" viewBox="0 0 24 24">
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

<style>
  .language-selector {
    position: relative;
    width: 120px;
    color: white;
  }

  .button-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .flag {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .language-code {
    font-size: 0.8rem;
  }

  .language-dropdown {
    /* Ensures dropdown appears above other elements */
    top: 100%;
    right: 0;
    margin-top: 0.5rem; /* Adjust as needed */
    width: 180px; /* Match Panel width */
    z-index: 1005;
  }

  .language-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1005;
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 0.375rem; /* Equivalent to rounded-md */
    transition: background-color 0.2s;
  }

  .language-option:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .checkmark {
    /* Additional styling if needed */
  }
</style>
