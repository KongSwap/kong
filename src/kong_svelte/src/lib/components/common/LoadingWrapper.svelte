<script lang="ts">
  import LoadingIndicator from './LoadingIndicator.svelte';
  export let loading: boolean;
  export let text: string = 'Loading...';
  export let fullHeight: boolean = false;
</script>

{#if loading}
  <LoadingIndicator {text} {fullHeight} />
{:else}
  <slot />
{/if} 