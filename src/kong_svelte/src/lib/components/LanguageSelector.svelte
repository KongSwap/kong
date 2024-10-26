<script lang="ts">
  import { Us, Es } from "svelte-flags";
  import { writable } from "svelte/store";
  import { localeStore, switchLocale } from "$lib/stores/localeStore";

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

<div class="dropdown-container">
  <button
    type="button"
    class="dropdown-button"
    on:click={() => isOpen.update((n) => !n)}
    aria-haspopup="listbox"
    aria-expanded={$isOpen}
  >
    <span class="dropdown-button-content">
      {#each languages as { code, name, flag: Flag }}
        {#if $localeStore === code}
          <Flag />
          <span class="current-language">{name}</span>
        {/if}
      {/each}
    </span>
    <span class="dropdown-button-icon">
      <svg
        class="icon"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        ></path>
      </svg>
    </span>
  </button>

  {#if $isOpen}
    <ul class="dropdown-list" tabindex="-1" role="listbox">
      {#each languages as { code, name, flag: Flag }}
        <li
          class="dropdown-item font-alumni"
          role="option"
          tabindex="0"
          aria-selected={$localeStore === code}
          on:click={() => changeLanguage(code)}
          on:keydown={(e) =>
            (e.key === "Enter" || e.key === " ") && changeLanguage(code)}
        >
          <div class="dropdown-item-content">
            <Flag class="h-5 w-5 flex-shrink-0" />
            <span class="dropdown-item-text">{name}</span>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="postcss" scoped>
  .dropdown-container {
    @apply absolute bottom-2 left-2 mb-2;
  }

  .dropdown-button {
    @apply relative cursor-default text-left font-alumni shadow-sm focus:outline-none sm:text-sm sm:leading-6;
    @apply rounded-md bg-green-600 text-white py-1.5 pl-3 pr-10;
    @apply ring-inset ring-green-500 focus:ring-2 focus:ring-green-700;
  }

  .dropdown-list {
    @apply absolute z-10 mb-1 max-h-56 overflow-auto focus:outline-none;
    @apply rounded-md bg-green-600 text-white py-1 text-lg shadow-lg;
    @apply sm:text-lg;
    bottom: 100%; /* Position the dropdown above the button */
    right: 0; /* Align the dropdown with the button */
  }

  .dropdown-item {
    @apply relative cursor-pointer select-none hover:bg-green-700 hover:text-yellow-300;
    @apply py-2 pl-3 pr-9;
  }

  .icon {
    @apply h-5 w-5 text-white;
  }

  .dropdown-button-content {
    @apply flex items-center text-lg;
  }

  .dropdown-button-icon {
    @apply pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2;
  }

  .dropdown-item-content {
    @apply flex items-center;
  }

  .dropdown-item-text {
    @apply ml-3 block truncate font-normal text-lg;
  }

  .current-language {
    @apply ml-3 block truncate font-normal text-lg;
  }
</style>
