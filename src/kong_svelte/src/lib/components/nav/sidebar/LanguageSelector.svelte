<script lang="ts">
  import { Us, Es } from "svelte-flags";
  import { writable } from "svelte/store";
  import { localeStore, switchLocale } from "$lib/stores/localeStore";
  import { fly } from "svelte/transition";

  const isOpen = writable(false);
  const languages = [
    { code: "en", name: "English", flag: Us },
    { code: "es", name: "Español", flag: Es },
  ];

  function changeLanguage(lang: string) {
    switchLocale(lang);
    isOpen.set(false);
  }
</script>

<div class="language-selector">
  <div class="pixel-corners--wrapper">
    <button
      type="button"
      class="pixel-corners primary language-button"
      on:click={() => isOpen.update((n) => !n)}
      aria-haspopup="listbox"
      aria-expanded={$isOpen}
    >
      {#each languages as { code, flag: Flag }}
        {#if $localeStore === code}
          <div class="flex items-center gap-2">
            <Flag class="h-5 w-5" />
            <span class="language-code hide-mobile">{code.toUpperCase()}</span>
          </div>
        {/if}
      {/each}
    </button>
  </div>

  {#if $isOpen}
    <div class="language-dropdown" 
      in:fly="{{ y: -5, duration: 150 }}" 
      out:fly="{{ y: -5, duration: 150 }}"
    >
      <div class="pixel-corners--wrapper">
        <ul 
          class="pixel-corners primary language-list" 
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
              <Flag class="h-5 w-5 flex-shrink-0" />
              <span class="language-name">{name}</span>
              {#if $localeStore === code}
                <svg class="checkmark" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .language-selector {
    position: relative;
    font-family: 'Press Start 2P', cursive;
    width: 120px;
    color: white;
  }

  .language-button {
    width: 100%;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .language-code {
    font-size: 0.65rem;
  }

  .language-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 180px;
    z-index: 50;
  }

  .language-list {
    width: 100%;
    padding: 0.5rem;
    background: #61c9ff;
    border: 2px solid #0099ff;
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 4px;
  }

  .language-name {
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .language-option:hover {
    background: rgba(0, 161, 250, 0.1);
    transform: translateX(4px);
  }

  .language-option[aria-selected="true"] {
    background: rgba(0, 119, 204, 0.15);
  }

  .checkmark {
    width: 16px;
    height: 16px;
    margin-left: auto;
    stroke: #0077cc;
    fill: none;
  }

  .pixel-corners {
    position: relative;
    border: 2px solid #0099ff;
    background: #61c9ff;
    image-rendering: pixelated;
    box-shadow: 
      inset -4px -4px 0px #0077cc,
      inset 4px 4px 0px #99ddff,
      4px 4px 0px rgba(0, 0, 0, 0.2);
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    clip-path: polygon(
      0 4px, 4px 4px, 4px 0,
      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%,
      4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px)
    );
  }

  .pixel-corners:hover {
    transform: translate(-2px, -2px);
    box-shadow: 
      inset -4px -4px 0px #0077cc,
      inset 4px 4px 0px #99ddff,
      6px 6px 0px rgba(0, 0, 0, 0.2);
  }

  .pixel-corners:active {
    transform: translate(2px, 2px);
    box-shadow: 
      inset -2px -2px 0px #0077cc,
      inset 2px 2px 0px #99ddff,
      2px 2px 0px rgba(0, 0, 0, 0.2);
    transition-duration: 0.05s;
  }

  @media (max-width: 768px) {
    .language-selector {
      width: 60px;
    }

    .hide-mobile {
      display: none;
    }

    .language-button {
      padding: 0.5rem;
    }
  }
</style>
