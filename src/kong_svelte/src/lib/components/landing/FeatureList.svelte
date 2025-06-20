<script lang="ts">
  import { LucideCheck } from "lucide-svelte"; // Default icon
  import type { ComponentType } from 'svelte';
  import type { Icon } from 'lucide-svelte';

  type Feature = {
    icon?: ComponentType<Icon>; // Allow custom icons
    title: string;
    description: string;
    iconColorClass?: string; // e.g., 'text-purple-300'
    iconBgGradientClass?: string; // e.g., 'from-indigo-600 to-purple-600'
  };

  let { 
    features = [],
    defaultIconBgGradientClass = 'from-gray-600 to-gray-700', // Default gradient
    defaultIconColorClass = 'text-white' // Default icon color
  } = $props<{ 
    features: Feature[];
    defaultIconBgGradientClass?: string;
    defaultIconColorClass?: string;
  }>();
</script>

<div class="space-y-5 md:space-y-6">
  {#each features as feature (feature.title)}
    {@const IconComponent = feature.icon || LucideCheck}
    {@const bgGradient = feature.iconBgGradientClass || defaultIconBgGradientClass}
    {@const iconColor = feature.iconColorClass || defaultIconColorClass}
    <div class="flex items-start">
      <div 
        class="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-r {bgGradient} flex items-center justify-center mr-3 mt-1"
      >
        <IconComponent size={10} class={iconColor} />
      </div>
      <div>
        <h3 class="text-base md:text-lg font-semibold text-white mb-1">{feature.title}</h3>
        <p class="text-sm md:text-base text-gray-300">{feature.description}</p>
      </div>
    </div>
  {/each}
</div> 