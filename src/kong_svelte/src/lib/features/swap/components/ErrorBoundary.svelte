<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  
  let error = $state<Error | null>(null);
  let errorInfo = $state<{ componentStack?: string } | null>(null);
  let hasError = $state(false);
  
  function handleError(event: ErrorEvent) {
    error = event.error;
    errorInfo = { componentStack: event.filename };
    hasError = true;
    
    // Log error in development
    if (dev) {
      console.error('ErrorBoundary caught:', error);
      console.error('Error info:', errorInfo);
    }
    
    // Prevent default error handling
    event.preventDefault();
  }
  
  function handleRejection(event: PromiseRejectionEvent) {
    error = new Error(event.reason?.message || 'Unhandled promise rejection');
    hasError = true;
    
    // Log error in development
    if (dev) {
      console.error('Unhandled promise rejection:', event.reason);
    }
    
    // Prevent default error handling
    event.preventDefault();
  }
  
  function handleRetry() {
    error = null;
    errorInfo = null;
    hasError = false;
    
    // Optionally reload the page
    if (!dev) {
      window.location.reload();
    }
  }
  
  onMount(() => {
    // Add global error handlers
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  });
</script>

{#if hasError && error}
  <div class="error-boundary-fallback p-8 max-w-md mx-auto">
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <div class="flex items-start gap-3">
        <svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Something went wrong
          </h3>
          
          <p class="text-sm text-red-700 dark:text-red-300 mb-4">
            {error.message || 'An unexpected error occurred'}
          </p>
          
          {#if dev && errorInfo?.componentStack}
            <details class="mb-4">
              <summary class="text-sm text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                Error details
              </summary>
              <pre class="mt-2 text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto">
{error.stack || error.toString()}
              </pre>
            </details>
          {/if}
          
          <div class="flex gap-3">
            <button
              on:click={handleRetry}
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Try Again
            </button>
            
            <button
              on:click={() => window.location.href = '/'}
              class="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300 rounded-lg font-medium text-sm transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .error-boundary-fallback {
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>