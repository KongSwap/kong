<script lang="ts">
  import { formatNumberCustom } from "$lib/utils/formatNumberCustom";
  import { t } from "$lib/locales/translations";
  import { onMount } from "svelte";

  export let totalTvl: string | number;
  export let totalVolume: string | number;
  export let totalFees: string | number;

  let wobbleClass = "wobble";

  onMount(() => {
    setTimeout(() => {
      wobbleClass = "";
    }, 400);
  });
</script>

<!-- Total Stats Summary -->
<div
  class="absolute bottom-[88px] left-[16px] rounded-lg p-4 w-56 mx-auto mt-6 z-20 text-xl {wobbleClass} hidden md:block"
>
  <ul class="text-left">
    <li>
      {$t("stats.totalTvl")}: ${formatNumberCustom(totalTvl, 2)}
    </li>
    <li>
      {$t("stats.24hVolume")}: ${formatNumberCustom(totalVolume, 2)}
    </li>
    <li>
      {$t("stats.24hFees")}: ${formatNumberCustom(totalFees, 2)}
    </li>
  </ul>
</div>
<div class="max-w-[100px]">
  <img
    src="/backgrounds/grass_post.webp"
    alt="Sign Post"
    class="absolute -bottom-5 left-0 z-10 {wobbleClass} hidden md:block max-w-[200px]"
  />
</div>

<style scoped>
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
