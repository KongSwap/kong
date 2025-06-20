<script lang="ts">
  export let message = "Loading...";
  export let fullHeight = false;
</script>

<div class="flex flex-col items-center justify-center {fullHeight ? 'min-h-screen' : 'min-h-[300px]'}">
  <div class="loader mb-4"></div>
  <div class="text-kong-text-primary/70">{message}</div>
</div>

<style>
  .loader {
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top: 4px solid #ffffff;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
