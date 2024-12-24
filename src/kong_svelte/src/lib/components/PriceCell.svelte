<script lang="ts">
  export let initialPrice: string | number = 0;

  // We'll store the last known displayed price
  let oldPrice: number = +initialPrice || 0;

  // Current "flash" class
  let flashClass = "";

  // Reactive statement: Whenever initialPrice changes, decide flash color
  $: {
    const newPrice = +initialPrice || 0;

    if (newPrice !== oldPrice && oldPrice !== 0) {
      // If new price is higher, flash green; if lower, flash red
      flashClass = newPrice > oldPrice ? "flash-green" : "flash-red";

      // Reset the flash animation by reassigning after 1 frame
      // or short timeout
      requestAnimationFrame(() => {
        flashClass = ""; 
      });
    }

    oldPrice = newPrice;
  }
</script>

<span class="{flashClass}">
  {#if initialPrice == null || initialPrice === ""}
    N/A
  {:else}
    {initialPrice}
  {/if}
</span>

<style>
  .flash-green {
    animation: highlightGreen 1s ease;
  }
  .flash-red {
    animation: highlightRed 1s ease;
  }

  @keyframes highlightGreen {
    0% {
      background-color: #14532d; /* Dark green highlight */
    }
    40% {
      background-color: #14532d;
    }
    100% {
      background-color: transparent;
    }
  }

  @keyframes highlightRed {
    0% {
      background-color: #7f1d1d; /* Dark red highlight */
    }
    40% {
      background-color: #7f1d1d;
    }
    100% {
      background-color: transparent;
    }
  }
</style> 