<script lang="ts">
  import { featureFlags, newSwapEnabled } from '$lib/stores/featureFlags';
  import { dev } from '$app/environment';
  
  let showPanel = $state(false);
</script>

{#if dev}
  <!-- Toggle Button -->
  <button
    onclick={() => showPanel = !showPanel}
    class="fixed bottom-4 right-4 z-50 p-2 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors"
    title="Toggle Feature Flags"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </button>
  
  <!-- Feature Flag Panel -->
  {#if showPanel}
    <div class="fixed bottom-20 right-4 z-50 bg-white dark:bg-surface-900 rounded-lg shadow-xl p-4 w-80">
      <h3 class="text-lg font-semibold mb-4">Feature Flags</h3>
      
      <div class="space-y-3">
        <label class="flex items-center justify-between">
          <span class="text-sm font-medium">New Swap Architecture</span>
          <button
            onclick={() => featureFlags.toggle('newSwapArchitecture')}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                   {$newSwapEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                     {$newSwapEnabled ? 'translate-x-6' : 'translate-x-1'}"
            />
          </button>
        </label>
      </div>
      
      <div class="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {$newSwapEnabled ? 'Using new architecture' : 'Using legacy architecture'}
        </p>
        <button
          onclick={() => {
            featureFlags.reset();
            showPanel = false;
          }}
          class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Reset all flags
        </button>
      </div>
    </div>
  {/if}
{/if}