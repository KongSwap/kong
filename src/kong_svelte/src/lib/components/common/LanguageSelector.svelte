<script lang="ts">
  import { Us, Es } from "svelte-flags";
  import { writable } from "svelte/store";
  import { localeStore, switchLocale } from "$lib/stores/localeStore";
  import { fly } from "svelte/transition";
  import Button from './Button.svelte';
  import Panel from './Panel.svelte';

  const isOpen = writable(false);
  const languages = [
    { code: "en", name: "English", flag: Us },
    { code: "es", name: "Español", flag: Es },
  ];

  function changeLanguage(lang: string) {
    switchLocale(lang);
    isOpen.set(false);
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.language-selector')) {
      isOpen.set(false);
    }
  }

  $: if ($isOpen) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
</script>

<div class="language-selector">
  <Button
    text={languages.find(l => l.code === $localeStore)?.code.toUpperCase() || ''}
    variant="yellow" 
    size="small"
    state={$isOpen ? 'selected' : 'default'}
    onClick={() => isOpen.update((n) => !n)}
  >
    <div class="button-content">
      {#each languages as { code, flag: Flag }}
        {#if $localeStore === code}
          <Flag class="flag" />
          <span class="language-code">{code.toUpperCase()}</span>
        {/if}
      {/each}
    </div>
  </Button>

  {#if $isOpen}
    <div class="language-dropdown" 
      in:fly="{{ y: -5, duration: 150 }}" 
      out:fly="{{ y: -5, duration: 150 }}"
    >
      <Panel
        variant="yellow"
        type="main"
        width={180}
        height="auto"
      >
        <ul 
          class="language-list" 
          role="listbox"
        >
          {#each languages as { code, name, flag: Flag }}
            <li
              class="language-option"
              role="option"
              tabindex="0"
              aria-selected={$localeStore === code}
              on:click={() => changeLanguage(code)}
              on:keydown={(e) => (e.key === "Enter" || e.key === " ") && changeLanguage(code)}
            >
              <Flag class="flag" />
              <span class="language-name">{name}</span>
              {#if $localeStore === code}
                <svg class="checkmark" viewBox="0 0 24 24">
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
      </Panel>
    </div>
  {/if}
</div>

<style>
  .language-selector {
    position: relative;
    font-family: 'Alumni Sans';
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
    font-size: 0.65rem;
  }

  .language-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 180px;
    z-index: 50;
  }

  .language-list {
    width: 100%;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    min-height: 40px;
  }

  .language-name {
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .language-option:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateX(4px);
  }

  .language-option[aria-selected="true"] {
    background: rgba(255, 255, 255, 0.25);
  }

  .checkmark {
    width: 16px;
    height: 16px;
    margin-left: auto;
    stroke: #000;
    fill: none;
  }
</style>
