<script lang="ts">
  import UserPoolMain from "./user-pool/UserPoolMain.svelte";

  export let pool: any;
  export let showModal = false;
</script>

<UserPoolMain bind:pool bind:showModal />

<style lang="postcss">
  /* Empty style block to ensure proper PostCSS processing */
</style>
