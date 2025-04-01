<script lang="ts">
  import BaseNavItem from './BaseNavItem.svelte';
  
  let {
    label,
    icon,
    onClick,
    isActive = false,
    iconBackground = "bg-kong-text-primary/5",
    badgeCount = 0
  } = $props();
</script>

<BaseNavItem
  {label}
  {icon}
  {onClick}
  {isActive}
  {iconBackground}
  {badgeCount}
/> 