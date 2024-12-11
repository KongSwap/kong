<script lang="ts">
  import { themeStore } from '$lib/stores/themeStore';
  import ModernButton from '../themes/modern/Button.svelte';
  import PixelButton from '../themes/pixel/Button.svelte';

  export let variant: 'blue' | 'green' | 'yellow' = 'blue';
  export let size: 'small' | 'medium' | 'big' = 'big';
  export let state: 'default' | 'disabled' | 'pressed' | 'selected' = 'default';
  export let text: string = '';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;
  export let className: string = '';
  export let width: number | string | 'auto' = 'auto';
  export let tooltipText: string | null = null;
</script>

{#if $themeStore === 'pixel'}
  <PixelButton
    {variant}
    {size}
    {state}
    {text}
    {onClick}
    {disabled}
    {className}
    {width}
    {tooltipText}
  >
    <slot>{text}</slot>
  </PixelButton>
{:else}
  <ModernButton
    {variant}
    {size}
    {state}
    {text}
    {onClick}
    {disabled}
    {className}
    {width}
    {tooltipText}
  >
    <slot>{text}</slot>
  </ModernButton>
{/if}
