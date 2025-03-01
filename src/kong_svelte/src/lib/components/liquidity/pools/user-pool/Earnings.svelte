<script lang="ts">
  // Earnings component for displaying pool earnings information
  // This will be expanded in the future
</script>

<div class="earnings-container">
  <div class="coming-soon">
    <div class="icon">🚀</div>
    <h3>Detailed Earnings Coming Soon</h3>
    <p>We're working on an advanced earnings tracking system for your liquidity positions.</p>
  </div>
</div>

<style lang="postcss">
  .earnings-container {
    @apply flex flex-col items-center justify-center py-8;
  }

  .coming-soon {
    @apply flex flex-col items-center text-center max-w-sm mx-auto;
  }

  .icon {
    @apply text-4xl mb-4;
  }

  h3 {
    @apply text-lg font-medium mb-2 text-kong-text-primary;
  }

  p {
    @apply text-sm text-kong-text-secondary mb-6;
  }

  .features {
    @apply flex flex-col gap-3 w-full;
  }

  .feature {
    @apply flex items-center gap-3 px-4 py-3 rounded-lg bg-kong-surface-light/50;
  }

  .feature-icon {
    @apply text-lg;
  }
</style> 