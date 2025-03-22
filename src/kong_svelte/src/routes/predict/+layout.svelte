<script lang="ts">  
  let { children } = $props<{ children: any }>();
</script>

<svelte:head>
  <title>Prediction Markets - KongSwap</title>
  <meta property="og:title" content="Prediction Markets - KongSwap" />
  <meta property="og:description" content="Trade on prediction markets with KongSwap" />
  <meta property="og:image" content="/images/predictionmarket-og.png" />
  <meta property="og:type" content="website" />
</svelte:head>

<!-- Regular prediction markets content -->
<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4">
  {@render children?.()}
</div>
