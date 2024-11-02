<script lang="ts">
  import { formatTokenAmount, formatUSD } from "$lib/utils/numberFormatUtils";
  import { t } from "$lib/locales/translations";
  import { onMount } from "svelte";

  export let totalTvl: string | number;
  export let totalVolume: string | number;
  export let totalFees: string | number;

  let wobbleClass = "wobble";

  onMount(() => {
    const timeoutId = setTimeout(() => {
      wobbleClass = "";
    }, 400);

    return () => clearTimeout(timeoutId);
  });
</script>

<!-- Total Stats Summary -->
<div
  class="absolute bottom-[63px] left-[12px] rounded-lg p-4 w-56 mx-auto mt-6 z-20 text-lg {wobbleClass} hidden md:block"
>
  <ul class="text-left">
    <li>
      {$t("stats.totalTvl")}: ${formatUSD(totalTvl, 2)}
    </li>
    <li>
      {$t("stats.24hVolume")}: ${formatUSD(totalVolume, 2)}
    </li>
    <li>
      {$t("stats.24hFees")}: ${formatUSD(totalFees, 2)}
    </li>
  </ul>
</div>
<div class="max-w-[100px]">
  <img
    src="/backgrounds/grass_post.webp"
    alt="Sign Post"
    class="absolute -bottom-5 left-0 z-10 {wobbleClass} hidden md:block max-w-[170px]"
    loading="lazy"
  />
</div>

<style scoped>
  .wobble {
    animation: wobble 0.8s ease-out;
  }

  @keyframes wobble {
    0% {
      transform: translateX(0%);
    }
    15% {
      transform: rotate(-1deg);
    }
    30% {
      transform: rotate(1deg);
    }
    45% {
      transform: rotate(-1deg);
    }
    60% {
      transform: rotate(1deg);
    }
    75% {
      transform: rotate(-1deg);
    }
    100% {
      transform: translateX(0%);
    }
  }
</style>
