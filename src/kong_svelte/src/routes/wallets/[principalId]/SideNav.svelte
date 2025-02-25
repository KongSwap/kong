<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    BarChart2,
    Coins,
    Droplets,
    ArrowRightLeft,
    Shield,
  } from "lucide-svelte";
  import { page } from "$app/state";
  let { principal } = $props<{ principal: string }>();

  interface WalletTab {
    id: string;
    label: string;
    icon: any;
    path: string;
  }

  const tabs: WalletTab[] = [
    { id: "overview", label: "Wallet Overview", icon: BarChart2, path: "" },
    { id: "tokens", label: "Tokens", icon: Coins, path: "/tokens" },
    { id: "pools", label: "LP Positions", icon: Droplets, path: "/pools" },
    { id: "swaps", label: "Recent Swaps", icon: ArrowRightLeft, path: "/swaps" },
    { id: "risk", label: "Risk Analysis", icon: Shield, path: "/risk" },
  ];

  const currentPath = page.url.pathname.split("/").pop() || "";
  
  function isCurrentPath(tabPath: string) {
    const segments = page.url.pathname.split("/").filter(Boolean);
    if (tabPath === "") {
      return segments.length === 2;
    }
    const lastSegment = "/" + (segments[segments.length - 1] || "");
    return lastSegment === tabPath;
  }
</script>

<Panel variant="transparent">
  <div class="flex flex-col space-y-2">
    {#each tabs as tab}
      <a
        href="/wallets/{principal}{tab.path}"
        data-sveltekit-prefetch
        class="flex items-center gap-3 p-2 rounded-lg transition-colors {isCurrentPath(tab.path)
          ? 'bg-kong-primary text-white'
          : 'hover:bg-kong-bg-dark/30'}"
      >
        {#key tab.icon}
          <tab.icon class="w-5 h-5" />
        {/key}
        <span>{tab.label}</span>
      </a>
    {/each}
  </div>
</Panel>
