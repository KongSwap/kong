<script lang="ts">
	import type { ComponentType } from 'svelte';
	import type { SvelteComponent } from 'svelte';
	import { DollarSign } from 'lucide-svelte'; // Default icon

	// Define the props using $props for Svelte 5
	let {
		icon = DollarSign,
		value = '0',
		label = 'Label',
		iconBgClass = 'bg-indigo-500/20',
		iconColorClass = 'text-indigo-300',
		gradientClass = 'bg-[linear-gradient(90deg,#7B68EE,#9370DB)]'
	} = $props<{
		icon?: ComponentType<SvelteComponent>;
		value: string;
		label: string;
		iconBgClass?: string;
		iconColorClass?: string;
		gradientClass?: string;
	}>();
</script>

<div class="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-white/10 hover:border-purple-500/30 transition-all">
	<div class="flex items-center">
		<div class="flex-shrink-0 mr-2 sm:mr-3 {iconBgClass} p-1.5 sm:p-2 rounded-md sm:rounded-lg">
			<svelte:component this={icon} size={14} class={iconColorClass} />
		</div>
		<div class="flex-1 min-w-0">
			<div class="{gradientClass} bg-clip-text text-transparent text-base sm:text-lg md:text-xl truncate font-['BlenderPro',_'Rajdhani',_monospace] tracking-wider font-bold leading-none sm:leading-tight">{value}</div>
			<div class="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{label}</div>
		</div>
	</div>
</div> 