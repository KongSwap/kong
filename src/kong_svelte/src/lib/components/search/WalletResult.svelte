<script lang="ts">
  import { fade } from 'svelte/transition';
  import { User, ArrowRight, BarChart2, Coins, Droplets, ArrowRightLeft } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  interface UserData {
    user_id: number;
    principal_id: string;
    my_referral_code: string;
    referred_by: string | null;
    fee_level: number;
  }

  export let users: UserData[] = [];
  export let selectedIndex = -1;
  export let startIndex = 0;

  const dispatch = createEventDispatcher();

  function handleSelect(user: UserData) {
    dispatch('select', user);
  }

  function handleTouchStart(event: TouchEvent) {
    dispatch('touchstart', event);
  }

  function handleTouchMove(event: TouchEvent) {
    dispatch('touchmove', event);
  }

  function handleTouchEnd(user: UserData, event: TouchEvent) {
    dispatch('touchend', { user, event });
  }

  function handleBadgeClick(principalId: string, section: string, event: Event) {
    event.stopPropagation();
    dispatch('navigate', { principalId, section, event });
  }

  function handleBadgeTouchEnd(principalId: string, section: string, event: TouchEvent) {
    event.stopPropagation();
    dispatch('badgetouchend', { principalId, section, event });
  }
</script>

{#if users.length > 0}
  <div class="result-section" transition:fade={{ duration: 200, delay: 50 }}>
    <div class="result-section-header">
      <div class="header-icon">
        <User size={16} />
      </div>
      <div class="header-title">Wallets</div>
      <div class="result-count">{users.length} {users.length === 1 ? 'result' : 'results'}</div>
    </div>
    
    <div class="result-list">
      {#each users as user, index}
        <button
          class="result-item user-result {selectedIndex === startIndex + index ? 'selected' : ''}"
          onclick={() => handleSelect(user)}
          ontouchstart={handleTouchStart}
          ontouchmove={handleTouchMove}
          ontouchend={(e) => handleTouchEnd(user, e)}
        >
          <div class="result-content">
            <div class="user-icon">
              <div class="user-avatar">
                <User size={16} />
              </div>
            </div>
            <div class="user-info">
              <div class="user-id">{user.principal_id}</div>
              <div class="wallet-badges">
                <div 
                  class="wallet-badge overview"
                  onclick={(e) => handleBadgeClick(user.principal_id, '', e)}
                  ontouchstart={handleTouchStart}
                  ontouchmove={handleTouchMove}
                  ontouchend={(e) => handleBadgeTouchEnd(user.principal_id, '', e)}
                >
                  <BarChart2 size={12} />
                  <span>Overview</span>
                </div>
                <div 
                  class="wallet-badge tokens"
                  onclick={(e) => handleBadgeClick(user.principal_id, 'tokens', e)}
                  ontouchstart={handleTouchStart}
                  ontouchmove={handleTouchMove}
                  ontouchend={(e) => handleBadgeTouchEnd(user.principal_id, 'tokens', e)}
                >
                  <Coins size={12} />
                  <span>Tokens</span>
                </div>
                <div 
                  class="wallet-badge liquidity"
                  onclick={(e) => handleBadgeClick(user.principal_id, 'liquidity', e)}
                  ontouchstart={handleTouchStart}
                  ontouchmove={handleTouchMove}
                  ontouchend={(e) => handleBadgeTouchEnd(user.principal_id, 'liquidity', e)}
                >
                  <Droplets size={12} />
                  <span>LP</span>
                </div>
                <div 
                  class="wallet-badge swaps"
                  onclick={(e) => handleBadgeClick(user.principal_id, 'swaps', e)}
                  ontouchstart={handleTouchStart}
                  ontouchmove={handleTouchMove}
                  ontouchend={(e) => handleBadgeTouchEnd(user.principal_id, 'swaps', e)}
                >
                  <ArrowRightLeft size={12} />
                  <span>Swaps</span>
                </div>
              </div>
            </div>
            {#if user.fee_level > 0}
              <div class="user-level">Level {user.fee_level}</div>
            {/if}
          </div>
          <ArrowRight size={16} class="goto-icon" />
        </button>
      {/each}
    </div>
  </div>
{/if}

<style lang="postcss">
  .result-section {
    @apply py-3 w-full;
    max-width: 100%;
    overflow: hidden; /* Ensure the entire section doesn't overflow */
  }

  .result-section-header {
    @apply grid items-center px-4 py-2 text-sm font-medium text-kong-text-secondary;
    width: 100%;
    grid-template-columns: 24px auto 1fr;
    gap: 8px;
  }

  .header-icon {
    @apply flex-shrink-0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-title {
    @apply truncate;
    min-width: 0;
  }

  .result-count {
    @apply text-xs text-kong-text-secondary/70;
    text-align: right;
    justify-self: end;
    padding-right: 4px;
    white-space: nowrap;
    min-width: 70px;
  }

  .result-list {
    @apply flex flex-col;
    @apply overflow-hidden;
    width: 100%;
  }

  .result-item {
    @apply flex items-center justify-between w-full px-4 py-3 text-left hover:bg-white/5 transition-colors rounded-md my-0.5;
    @apply py-3.5 sm:py-3;
    max-width: 100%;
  }

  .result-item.selected {
    @apply bg-white/10;
  }

  .result-content {
    @apply flex items-center gap-3 flex-1 min-w-0;
    max-width: calc(100% - 24px); /* Account for the arrow icon */
  }

  .user-result {
    @apply relative hover:bg-kong-accent-blue/5;
  }

  .user-icon {
    @apply flex-shrink-0;
  }

  .user-avatar {
    @apply flex items-center justify-center w-8 h-8 rounded-full bg-kong-accent-blue/10 text-kong-accent-blue;
  }

  .user-info {
    @apply flex-1 min-w-0 max-w-full;
  }

  .user-id {
    @apply text-kong-text-primary font-medium truncate mb-1.5;
    @apply text-sm sm:text-base;
  }

  .wallet-badges {
    @apply flex flex-wrap gap-1.5 max-w-full;
  }

  .wallet-badge {
    @apply flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer;
    @apply mb-0.5 sm:mb-0;
  }

  .wallet-badge.overview {
    @apply bg-kong-accent-blue/10 text-kong-accent-blue hover:bg-kong-accent-blue/20;
  }

  .wallet-badge.tokens {
    @apply bg-kong-success/10 text-kong-success hover:bg-kong-success/20;
  }

  .wallet-badge.liquidity {
    @apply bg-purple-500/10 text-purple-500 hover:bg-purple-500/20;
  }

  .wallet-badge.swaps {
    @apply bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20;
  }

  .user-level {
    @apply px-2 py-0.5 bg-kong-success/20 text-kong-success rounded-md text-xs font-medium;
    flex-shrink: 0;
  }

  .goto-icon {
    @apply text-kong-text-secondary/50 opacity-0 transition-opacity;
    @apply opacity-50 sm:opacity-0;
    flex-shrink: 0;
  }

  .result-item:hover .goto-icon {
    @apply opacity-100;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .result-item {
      @apply active:bg-white/10; /* Better touch feedback */
    }
    
    .wallet-badges {
      @apply gap-1; /* Tighter spacing on mobile */
    }
    
    .wallet-badge span {
      @apply text-[10px]; /* Slightly smaller text on mobile */
    }
    
    .user-id {
      @apply max-w-[200px]; /* Limit width on mobile */
    }
  }
</style> 