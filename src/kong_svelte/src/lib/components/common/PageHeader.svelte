<script lang="ts">
  export let title: string;
  export let maxWidth: string = "1300px";
  export let description: string | null = null;
  export let icon: any | null = null; // SVG path data
  export let stats: Array<{
    label: string;
    value: string;
    icon: any;
    hideOnMobile?: boolean;
  }> = [];
</script>

<div class="flex flex-col gap-2 p-4 w-full">
  <div class="mx-auto w-full max-w-[{maxWidth}] px-1">
    <!-- Header with Stats -->
    <div class="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-6 md:gap-4 -mt-2">
      <!-- Left side: Title -->
      <div class="flex flex-col gap-2 w-full md:w-auto">
        <div class="flex items-center gap-2">
          <svelte:component 
            this={icon} 
            class="w-6 h-6 sm:w-7 sm:h-7 text-kong-primary"
          />
          <h1 class="text-xl sm:text-2xl font-medium text-kong-text-primary">{title}</h1>
        </div>
        <p class="text-kong-text-secondary text-sm max-w-[600px] hidden md:block">{description}</p>
      </div>

      <!-- Right side: Stats or Buttons -->
      {#if stats.length > 0}
        <div class="grid grid-cols-3 xs:grid-cols-2 md:flex justify-start items-start md:items-center gap-y-4 gap-x-6 w-full md:w-auto">
          {#each stats as stat}
            <div class="flex items-center gap-3 justify-center">
              <div class="p-2 rounded-lg bg-kong-primary/10 shrink-0">
                <svelte:component 
                  this={stat.icon}
                  class="w-5 h-5 md:h-6 md:w-6 text-kong-primary"
                />
              </div>
              <div class="text-right">
                <div class="text-xs md:text-sm text-kong-text-secondary">{stat.label}</div>
                <div class="text-sm font-medium text-kong-text-primary">
                  {stat.value}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex items-center gap-3">
          <slot name="buttons"></slot>
        </div>
      {/if}
    </div>
  </div>
</div> 