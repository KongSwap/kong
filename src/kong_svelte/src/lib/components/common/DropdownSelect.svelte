<script lang="ts">
  import { ChevronDown } from "lucide-svelte";
  import { clickOutside } from "$lib/actions/clickOutside";

  type Option<T = string> = {
    value: T;
    label: string;
    disabled?: boolean;
    tooltip?: string;
  };

  let {
    options,
    value,
    label,
    onChange,
    disabled = false,
    placeholder = "Select...",
    className = "",
    dropdownClassName = "",
    buttonClassName = "",
    optionClassName = "",
    activeClassName = "bg-kong-success/20 text-kong-success font-medium",
    size = "sm"
  } = $props<{
    options: Option<any>[];
    value: any;
    label?: string;
    onChange: (value: any) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    dropdownClassName?: string;
    buttonClassName?: string;
    optionClassName?: string;
    activeClassName?: string;
    size?: "xs" | "sm" | "md";
  }>();

  let isOpen = $state(false);

  const selectedOption = $derived(
    options.find(opt => opt.value === value)
  );

  const displayText = $derived(
    selectedOption?.label || placeholder
  );

  const sizeClasses = {
    xs: "px-3 py-1.5 text-xs",
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-base"
  };

  function handleSelect(option: Option<any>) {
    if (option.disabled) return;
    onChange(option.value);
    isOpen = false;
  }

  function toggleDropdown(e: Event) {
    if (disabled) return;
    e.stopPropagation();
    isOpen = !isOpen;
  }
</script>

<div 
  class="relative {className}"
  use:clickOutside={() => (isOpen = false)}
>
  <button
    class="flex items-center justify-between w-full rounded font-medium 
      bg-kong-bg-tertiary text-kong-text-primary hover:bg-kong-bg-secondary/30 
      transition-colors border border-kong-border/50 {sizeClasses[size]} {buttonClassName}
      {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
    onclick={toggleDropdown}
    {disabled}
  >
    <span class="whitespace-nowrap overflow-hidden text-ellipsis">
      {label ? `${label}: ${displayText}` : displayText}
    </span>
    <ChevronDown class="w-3 h-3 ml-1 flex-shrink-0 {isOpen ? 'rotate-180' : ''} transition-transform" />
  </button>

  {#if isOpen}
    <div
      class="absolute top-full left-0 mt-1 z-50 bg-kong-bg-tertiary 
        border border-kong-border rounded-md shadow-lg py-1 w-full 
        min-w-[120px] backdrop-blur-sm max-h-64 overflow-y-auto {dropdownClassName}"
    >
      {#each options as option}
        {#if option.disabled}
          <div
            class="{sizeClasses[size]} w-full text-left text-kong-text-disabled 
              cursor-not-allowed opacity-50 {optionClassName}"
            title={option.tooltip}
          >
            {option.label}
          </div>
        {:else}
          <button
            class="{sizeClasses[size]} w-full text-left hover:bg-kong-bg-secondary/30 
              {value === option.value ? activeClassName : 'text-kong-text-primary'} 
              {optionClassName} transition-colors"
            onclick={() => handleSelect(option)}
          >
            {option.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>