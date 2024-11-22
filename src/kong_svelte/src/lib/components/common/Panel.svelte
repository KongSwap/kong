<!-- Panel.svelte -->
<script lang="ts">
    import { themeStore } from '$lib/stores/themeStore';
    import PixelPanel from '$lib/components/themes/pixel/Panel.svelte';
    import ModernPanel from '$lib/components/themes/modern/Panel.svelte';

    export let variant: "green" | "yellow" | "blue" = "green";
    export let type: "main" | "secondary" = "main";
    export let width: string = "auto";
    export let height: string = "auto"; 
    export let content: string = '';
    export let className: string = '';
    export let zIndex: number = 10;
    export let roundedBorders: boolean = true;
</script>

{#if $themeStore === 'pixel'}
    <PixelPanel
        {variant}
        {type}
        {width}
        {height}
        {content}
        {className}
        {zIndex}
    >
        <slot>{content}</slot>
    </PixelPanel>
{:else}
    <ModernPanel
        {variant}
        {type}
        {width}
        {height}
        {content}
        {className}
        {zIndex}
        {roundedBorders}
    >
        <slot>{content}</slot>
    </ModernPanel>
{/if}

<style lang="postcss">
</style>
