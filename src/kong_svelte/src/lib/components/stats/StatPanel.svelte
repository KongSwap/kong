<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";

  export let title: string;
  export let value: string;
  export let subtitle: string = "";
  export let color: "purple" | "green" | "orange" = "purple";
  export let chartPath: string = "M0 10 Q25 25 50 10 T100 10";
  export let fillPath: string = "M0 30 L0 10 Q25 25 50 10 T100 10 L100 30 Z";
</script>

<Panel
  variant="transparent"
  type="main"
  className="relative !p-0 overflow-hidden group transition-colors duration-200"
>
  <div class="absolute inset-0">
    <svg
      class="w-full h-full opacity-40"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
    >
      <path
        d={fillPath}
        class:fill-purple-500={color === "purple"}
        class:fill-green-500={color === "green"}
        class:fill-orange-500={color === "orange"}
        class="opacity-20"
      />
      <path
        d={chartPath}
        class:stroke-purple-500={color === "purple"}
        class:stroke-green-500={color === "green"}
        class:stroke-orange-500={color === "orange"}
        class="fill-none opacity-40"
        stroke-width="0.5"
      />
    </svg>
  </div>
  <div class="relative p-3 md:p-4">
    <div class="text-xs md:text-sm text-slate-400 mb-1">{title}</div>
    <div class="text-base md:text-xl font-semibold text-white truncate">
      {value}
    </div>
    <div class="text-xs md:text-sm text-slate-400 mt-1">
      <slot name="subtitle">
        {subtitle}
      </slot>
    </div>
  </div>
</Panel> 