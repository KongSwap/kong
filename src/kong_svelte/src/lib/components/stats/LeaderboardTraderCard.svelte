<script lang="ts">
  import {
    Trophy,
    Crown,
    ChevronDown,
    ChevronUp,
  } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import type { LeaderboardEntry } from "$lib/api/leaderboard";
  import TraderDetailsExpanded from "./TraderDetailsExpanded.svelte";
  import { formatVolume } from "$lib/utils/numberFormatUtils";

  let {
    user,
    rank,
    expanded = false,
    tradedTokens = undefined,
    loadingTokens = false,
    tokenError = null,
    userDetails = null,
    loadingUserDetails = false,
    width = "100%", 
    onClick = () => {}
  } = $props<{
    user: LeaderboardEntry;
    rank: number;
    expanded?: boolean;
    tradedTokens?: Kong.Token[] | undefined;
    loadingTokens?: boolean;
    tokenError?: string | null;
    userDetails?: { fee_level: number } | null;
    loadingUserDetails?: boolean;
    width?: string;
    onClick?: () => void;
  }>();

  // Function to determine card style based on rank
  function getRankStyle(rank: number) {
    if (rank === 1)
      return {
        borderColor: "border-yellow-400",
        bgColor: "bg-yellow-400",
        textColor: "text-yellow-400",
        panelType: "main",
        title: "CHAMPION",
        icon: Crown,
      };
    else if (rank === 2)
      return {
        borderColor: "border-gray-300",
        bgColor: "bg-gray-300",
        textColor: "text-gray-300",
        panelType: "secondary",
        title: "SILVER",
        icon: Trophy,
      };
    else if (rank === 3)
      return {
        borderColor: "border-amber-600",
        bgColor: "bg-amber-600",
        textColor: "text-amber-600",
        panelType: "secondary",
        title: "BRONZE",
        icon: Trophy,
      };
    else
      return {
        borderColor: "border-kong-border",
        bgColor: "bg-kong-primary",
        textColor: "text-kong-text-secondary",
        panelType: "secondary",
        title: "",
        icon: Trophy,
      };
  }

  const style = getRankStyle(rank);
  const isTopThree = rank <= 3;
  const isChampion = rank === 1;
  const imageSize = isChampion ? 20 : isTopThree ? 16 : 10;
  const panelVariant = isTopThree ? "solid" : "transparent";

  // Additional styling
  const panelClassName = isTopThree
    ? `relative ${style.borderColor} transform transition-all hover:scale-102 shadow-xl animate-fadeIn ${rank === 2 ? "animation-delay-150" : rank === 3 ? "animation-delay-300" : ""}`
    : "hover:bg-kong-bg-light cursor-pointer transition-colors group";

  // Only use border-2 for champion, border for others
  const borderWidth = isChampion ? "border-2" : "border";

  // Adjust style based on rank
  const wrapperClass = isTopThree
    ? `${borderWidth} ${panelClassName}`
    : panelClassName;
</script>

{#if isTopThree}
  <Panel
    variant={panelVariant}
    type={style.panelType as "main" | "secondary"}
    {width}
    height="auto"
    className={wrapperClass}
    animated={true}
  >
    <!-- Rank label for top 3 -->
    {#if style.title}
      <div
        class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 {style.bgColor} text-black font-bold text-xs px-4 py-1 rounded-full shadow-md flex items-center"
      >
        <svelte:component this={style.icon} class="w-3 h-3 mr-1" />
        {style.title}
      </div>
    {/if}

    <!-- Rank number -->
    <div
      class="absolute top-3 left-3 {isChampion
        ? 'w-12 h-12'
        : 'w-10 h-10'} flex items-center justify-center rounded-full bg-kong-bg-dark {borderWidth} {style.borderColor} shadow-lg z-10"
    >
      <span
        class="{isChampion ? 'text-xl' : 'text-sm'} font-bold {style.textColor}"
      >
        #{rank}
      </span>
    </div>

    <!-- Crown for champion -->
    {#if isChampion}
      <div
        class="absolute top-0 right-6 transform -translate-y-3 bg-kong-bg-dark rounded-full p-1 shadow-lg"
      >
        <Crown class="text-yellow-400 w-6 h-6" />
      </div>
    {/if}

    <!-- Main card content -->
    <div
      class="{isChampion
        ? 'pt-8'
        : 'pt-7'} gap-4 cursor-pointer transition-all hover:bg-opacity-80 h-full flex items-center justify-center"
      on:click={onClick}
    >
      <!-- User info -->
      <div class="w-1/4 flex flex-col items-center text-center">
        <div class="relative">
          <div
            class="absolute inset-0 {style.bgColor} rounded-full opacity-10 animate-pulse-slow"
          ></div>
          <img
            src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user.principal_id}&size=${isChampion ? 64 : 48}`}
            alt="Trader Avatar"
            class="w-{isChampion ? '20' : '16'} h-{isChampion
              ? '20'
              : '16'} rounded-full bg-kong-dark {borderWidth} border-kong-border shadow-md relative z-10"
          />
          <div
            class="absolute z-10 -bottom-2 -right-2 {isChampion
              ? 'bg-kong-accent-green'
              : style.bgColor} text-white text-xs font-bold rounded-full w-{isChampion
              ? '8'
              : '6'} h-{isChampion
              ? '8'
              : '6'} flex items-center justify-center {borderWidth} border-kong-bg-dark shadow-md"
          >
            <svelte:component
              this={Trophy}
              class="w-{isChampion ? '4' : '3'} h-{isChampion ? '4' : '3'}"
            />
          </div>
        </div>
      </div>

      <!-- Trading metrics -->
      <div class="w-3/4 space-y-2">
          <div
            class="text-sm font-medium text-kong-text-primary truncate max-w-[350px]"
          >
            {user.principal_id}
          </div>
        <div
          class="flex flex-col gap-2 rounded-lg w-full"
        >
          <div
            class="text-{isChampion ? '3xl' : 'lg'} font-{isChampion
              ? 'bold'
              : 'medium'} text-kong-accent-green flex items-center"
          >
            {formatVolume(user.total_volume_usd)}
          </div>
          <span class="inline-flex items-center gap-1 text-sm">
            <span class="">{user.swap_count}</span>
            <span>swaps</span>
          </span>
        </div>
      </div>
    </div>
    <!-- Expand indicator -->
    <div
      class="pt-4 text-kong-text-secondary flex items-center w-full justify-end cursor-pointer"
      on:click={onClick}
    >
      <span class="text-xs mr-2"
        >{expanded ? "Hide Details" : "Show Details"}</span
      >
      {#if expanded}
        <ChevronUp class="w-4 h-4" />
      {:else}
        <ChevronDown class="w-4 h-4" />
      {/if}
    </div>

    <!-- Expanded content -->
    {#if expanded}
      <div
        class="p-{isChampion
          ? '5'
          : '4'} bg-kong-bg-dark bg-opacity-30 animate-fadeIn border-t border-kong-border"
      >
        <TraderDetailsExpanded
          {user}
          {tradedTokens}
          {loadingTokens}
          {tokenError}
          {userDetails}
          {loadingUserDetails}
          {rank}
          compactLayout={false}
        />
      </div>
    {/if}
  </Panel>
{:else}
  <!-- For traders below top 3, show in table row format -->
  <tr
    class="hover:bg-kong-bg-light cursor-pointer transition-colors group"
    on:click={onClick}
  >
    <td class="px-4 py-4 whitespace-nowrap">
      <div class="flex items-center">
        <div
          class="bg-kong-bg-dark w-8 h-8 rounded-full flex items-center justify-center mr-2 shadow-sm"
        >
          <span class="text-sm font-medium text-kong-text-secondary"
            >#{rank}</span
          >
        </div>
      </div>
    </td>
    <td class="px-4 py-4 whitespace-nowrap">
      <div class="flex items-center">
        <div class="relative">
          <img
            src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user.principal_id}&size=32`}
            alt="Trader Avatar"
            class="w-10 h-10 rounded-full bg-kong-dark border border-kong-border flex-shrink-0 mr-3 shadow-sm transition-transform transform group-hover:scale-105"
          />
        </div>
        <div class="text-sm font-medium text-kong-text-primary">
          {user.principal_id}
        </div>
      </div>
    </td>
    <td
      class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-kong-accent-green"
    >
      {formatVolume(user.total_volume_usd)}
    </td>
    <td
      class="px-4 py-4 whitespace-nowrap text-right text-sm text-kong-text-secondary"
    >
      <div class="flex items-center justify-end">
        <span class="mr-2">{user.swap_count}</span>
        <div
          class="transition-transform transform group-hover:translate-y-[-2px] flex items-center cursor-pointer"
          on:click={onClick}
        >
          <span class="text-xs mr-2">{expanded ? "Hide Details" : "Show Details"}</span>
          {#if expanded}
            <ChevronUp class="w-4 h-4" />
          {:else}
            <ChevronDown class="w-4 h-4" />
          {/if}
        </div>
      </div>
    </td>
  </tr>

  <!-- Expanded Row Content -->
  {#if expanded}
    <tr class="bg-kong-bg-dark bg-opacity-10">
      <td colspan="4" class="px-6 py-4 animate-fadeIn">
        <TraderDetailsExpanded
          {user}
          {tradedTokens}
          {loadingTokens}
          {tokenError}
          {userDetails}
          {loadingUserDetails}
          {rank}
          compactLayout={true}
        />
      </td>
    </tr>
  {/if}
{/if}
