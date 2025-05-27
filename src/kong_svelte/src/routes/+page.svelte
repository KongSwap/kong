<script lang="ts">
  import LandingWrapper from "$lib/components/landing/LandingWrapper.svelte";
  import { browser } from "$app/environment"
</script>

{#if browser}
  <LandingWrapper />
{/if}