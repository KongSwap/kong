<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    wsConnected,
    wsEvents,
    notifications,
    connectWebSocket,
    disconnectWebSocket,
    canistersList,
    fetchCanisters,
  } from "$lib/api/canisters";
  import { toastStore } from "$lib/stores/toastStore";
  
  // Import our new components
  import LaunchHeader from "$lib/components/launch/LaunchHeader.svelte";
  import LiveActivityFeed from "$lib/components/launch/LiveActivityFeed.svelte";
  import SearchAndFilter from "$lib/components/launch/SearchAndFilter.svelte";
  import FlashEvent from "$lib/components/launch/FlashEvent.svelte";
  import ContentPanels from "$lib/components/launch/ContentPanels.svelte";
  import LaunchAnimations from "$lib/components/launch/LaunchAnimations.svelte";
  import Scroller from "$lib/components/common/Scroller.svelte";
  import MiningNotifications from "$lib/components/launch/MiningNotifications.svelte";
  
  // Import utility functions
  import {
    getEventText,
    getCanisterName,
    processCanisters,
    updateStatsFromCanisters,
    sortItems,
    filterTokens,
    filterMiners,
    formatBalance
  } from "$lib/components/launch/LaunchUtils";

  let activeTab = "tokens";
  let searchQuery = "";
  let loading = true;
  let sortField = "date";
  let sortDirection = "desc";

  let tokens = [];
  let miners = [];
  let recentEvents = [];
  let rawCanisters = [];
  let uniqueUsers = new Set();
  let flashEvent = null;
  let lastNotificationTime = 0;
  let miningEvents = [];

  // Add subtle animation effects
  let pulseStats = false;
  let pulseTokens = false;
  let pulseMiners = false;
  let nukeEffect = false;

  // Function to generate some initial events if none are present
  function generateInitialEvents() {
    // No default messages - wait for real events
    return;
  }

  // Metrics that actually make sense for a launchpad
  let stats = {
    totalDeployments: 0, // Total canisters deployed
    uniqueDeployers: 0, // Unique principals who deployed shit
    totalTokens: 0, // Total tokens
    totalMiners: 0, // Total miners
    activityScore: 0, // Bullshit score we can make up
    lastDeployment: null, // When was the last deployment
  };

  // MAXIMUM DEGEN: Create loud, obnoxious animations when new shit appears
  function triggerDegenEffects(eventType, data) {
    console.log(`Triggering effects for event type: ${eventType}`, data);
    
    // For mining events, we want to add to miningEvents but not show the full-screen flash
    const isMiningEvent = eventType === 'mining' || 
                          eventType === 'solution_found' || 
                          eventType === 'token_connected' || 
                          eventType === 'mining_started';
    
    // Add mining events to the miningEvents array for animations
    if (isMiningEvent) {
      // Make sure we're creating a new array to trigger reactivity
      const newEvent = { 
        type: eventType, 
        data: data,
        id: crypto.randomUUID(),
        timestamp: new Date()
      };
      miningEvents = [...miningEvents, newEvent];
      
      // Log for debugging
      console.log(`Added mining event: ${eventType}`, newEvent);
    }
    
    // Set the flash event to trigger the animation (for non-mining events)
    if (!isMiningEvent) {
      flashEvent = {
        type: eventType,
        data: data,
        id: crypto.randomUUID(),
      };
    }

    // Trigger appropriate pulses based on event type
    if (eventType.includes("token")) {
      pulseTokens = true;
      setTimeout(() => (pulseTokens = false), 3000);
    } else if (eventType.includes("miner")) {
      pulseMiners = true;
      setTimeout(() => (pulseMiners = false), 3000);
    } else if (isMiningEvent) {
      // For mining events, pulse both miners and tokens but more subtly
      pulseMiners = true;
      pulseTokens = true;
      setTimeout(() => {
        pulseMiners = false;
        pulseTokens = false;
      }, 2000);
    }

    // Pulse the stats regardless
    pulseStats = true;
    setTimeout(() => (pulseStats = false), 2000);

    // NUCLEAR OPTION: Sometimes just go completely insane with the effects
    // But only for token and miner deployments, not for mining events
    if (Math.random() > 0.7 && !isMiningEvent) {
      nukeEffect = true;
      setTimeout(() => (nukeEffect = false), 1500);
    }

    // Clear the flash event after animation completes
    // Only for token and miner deployments, not for mining events
    if (!isMiningEvent) {
      setTimeout(() => {
        flashEvent = null;
      }, 4000);
    }
  }

  let refreshInterval;
  let simulateEventsInterval;
  let lastEventTime = Date.now();
  let cleanupInterval;

  onMount(() => {
    // Connect to WebSocket
    connectWebSocket();

    // Generate initial events for the activity feed
    generateInitialEvents();

    // Initial data fetch WITH SOME DEGEN FLAIR
    (async () => {
      try {
        // Show loading toast
        toastStore.info("LOADING CANISTER DATA", {
          title: "🚀 LAUNCHPAD INITIALIZING",
          duration: 3000,
        });

        // Fetch canisters from API
        const canisterData = await fetchCanisters();
        const {
          tokenList,
          minerList,
          rawCanisters: rawCanisterData,
          deployerSet
        } = processCanisters(canisterData);
        tokens = tokenList;
        miners = minerList;
        rawCanisters = rawCanisterData;
        uniqueUsers = deployerSet;
        
        // Update stats
        stats = updateStatsFromCanisters(tokenList, minerList, deployerSet);

        // Success toast
        if (tokenList.length > 0 || minerList.length > 0) {
          toastStore.success(
            `LOADED ${tokenList.length} TOKENS & ${minerList.length} MINERS`,
            {
              title: "✅ LAUNCHPAD READY",
              duration: 4000,
            },
          );
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toastStore.error("FAILED TO LOAD CANISTER DATA", {
          title: "💀 INITIALIZATION FAILED",
          duration: 8000,
        });
      } finally {
        loading = false;
      }
    })();

    // Subscribe to WebSocket events
    const eventsUnsubscribe = wsEvents.subscribe((events) => {
      if (events.length > 0) {
        // Process the most recent event
        const latestEvent = events[events.length - 1];
        processWsEvent(latestEvent);
      }
    });

    // Subscribe to canister list updates
    const canistersUnsubscribe = canistersList.subscribe((canisters) => {
      const {
        tokenList,
        minerList,
        rawCanisters: rawCanisterData,
        deployerSet
      } = processCanisters(canisters);
      tokens = tokenList;
      miners = minerList;
      rawCanisters = rawCanisterData;
      uniqueUsers = deployerSet;
      
      // Update stats
      stats = updateStatsFromCanisters(tokenList, minerList, deployerSet);
    });

    // DEGEN MODE: Periodic refresh for MAXIMUM DATA FRESHNESS
    refreshInterval = setInterval(() => {
      fetchCanisters();
    }, 30000); // Every 30 seconds
    
    // Simulate occasional events if no real events are coming in
    simulateEventsInterval = setInterval(() => {
      const now = Date.now();
      // If no events for 20 seconds, simulate one
      if (now - lastEventTime > 20000) {
        const simulatedEvents = [
          "🔍 SCANNING BLOCKCHAIN FOR NEW DEPLOYMENTS",
          "🔄 REFRESHING CANISTER REGISTRY",
          "👀 MONITORING NETWORK ACTIVITY",
          "🛰️ SATELLITE FEED CONNECTED",
          "🔐 SECURITY PROTOCOLS ACTIVE"
        ];
        const randomEvent = simulatedEvents[Math.floor(Math.random() * simulatedEvents.length)];
        
        recentEvents = [
          ...recentEvents.slice(-9),
          { 
            text: randomEvent, 
            timestamp: new Date(),
            eventType: 'system_message',
            originalData: null
          }
        ];
        
        lastEventTime = now;
      }
    }, 10000); // Check every 10 seconds
    
    // Cleanup old mining events to prevent memory leaks
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      // Remove mining events older than 30 seconds
      miningEvents = miningEvents.filter(event => {
        return now - event.timestamp.getTime() < 30000;
      });
    }, 10000); // Check every 10 seconds

    // Return cleanup function
    return () => {
      disconnectWebSocket();
      eventsUnsubscribe();
      canistersUnsubscribe();
      clearInterval(refreshInterval);
      clearInterval(simulateEventsInterval);
      clearInterval(cleanupInterval);
    };
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (simulateEventsInterval) clearInterval(simulateEventsInterval);
    if (cleanupInterval) clearInterval(cleanupInterval);
  });

  $: filteredTokens = sortItems(filterTokens(tokens, searchQuery), sortField, sortDirection);
  $: filteredMiners = sortItems(filterMiners(miners, searchQuery), sortField, sortDirection);

  // Process WebSocket events to update the UI
  function processWsEvent(event) {
    // Update last event time
    lastEventTime = Date.now();
    
    // Add event to recent events list
    if (
      event.type !== "connection" &&
      event.type !== "api_call" &&
      event.type !== "api_success"
    ) {
      const eventText = getEventText(event);
      if (eventText) {
        // Keep more events (up to 10) for a more active feed
        recentEvents = [
          ...recentEvents.slice(-9),
          { 
            text: eventText, 
            timestamp: event.timestamp || new Date(),
            originalData: event.data,
            eventType: event.type
          },
        ];
        
        // Log for debugging
        console.log("Added event to activity feed:", eventText);
      }
    }

    // Handle specific types
    if (event.type === "canister_registered") {
      // DEGEN MODE: TOAST SPAM WHEN SHIT HAPPENS
      const now = Date.now();
      // Limit notifications to at most one every 2 seconds to avoid toast spam
      if (now - lastNotificationTime > 2000) {
        lastNotificationTime = now;

        const eventType = event.data?.canister_type || "canister";
        const name = getCanisterName(event.data);
        const id = event.data?.canister_id?.substring(0, 8) || "unknown";

        if (eventType.includes("token")) {
          toastStore.success(`NEW TOKEN DEPLOYED: ${name || id}`, {
            title: "TOKEN LAUNCH",
            duration: 6000,
          });
          triggerDegenEffects("token", event.data);
        } else if (eventType.includes("miner")) {
          toastStore.info(`NEW MINER DEPLOYED: ${id}`, {
            title: "MINER LAUNCH",
            duration: 6000,
          });
          triggerDegenEffects("miner", event.data);
        } else {
          toastStore.info(`NEW DEPLOYMENT: ${id}`, {
            title: "LAUNCH DETECTED",
            duration: 4000,
          });
          triggerDegenEffects("deployment", event.data);
        }
      }

      // Force a data refresh to get the new canister
      fetchCanisters();
    }

    // Handle mining-related events
    if (event.type === "solution_found") {
      const now = Date.now();
      // For mining events, we can allow more frequent notifications since they're less intrusive now
      if (now - lastNotificationTime > 1000) {
        lastNotificationTime = now;
        
        const ticker = event.data?.ticker || "TOKENS";
        const reward = event.data?.reward || 0;
        const decimals = event.data?.decimals || 8;
        const hash = event.data?.hash?.substring(0, 8) || "unknown";
        const tokenId = event.data?.token_id?.substring(0, 8) || "unknown";
        
        // Format the reward with the correct decimals
        const formattedReward = formatBalance(reward.toString(), decimals);
        
        // No toast message for mining events - only animations
        // toastStore.success(`MINED ${formattedReward} ${ticker}! HASH: ${hash}...`, {
        //   title: "💎 BLOCK MINED 💎",
        //   duration: 4000,
        //   action: {
        //     label: "View Token",
        //     callback: () => {
        //       window.location.href = `/launch/token/${event.data?.token_id}`;
        //     }
        //   }
        // });
        
        // Trigger mining animations
        triggerDegenEffects("solution_found", event.data);
        
        // Refresh canisters to update stats
        fetchCanisters();
      }
    }
    
    if (event.type === "token_connected") {
      const now = Date.now();
      // For mining events, we can allow more frequent notifications
      if (now - lastNotificationTime > 1000) {
        lastNotificationTime = now;
        
        const minerId = event.data?.miner_id?.substring(0, 8) || "unknown";
        const tokenId = event.data?.token_id?.substring(0, 8) || "unknown";
        
        // No toast message for mining events - only animations
        // toastStore.info(`MINER ${minerId}... CONNECTED TO TOKEN ${tokenId}...`, {
        //   title: "🔗 MINER CONNECTED",
        //   duration: 3000,
        // });
        
        // Trigger mining animations
        triggerDegenEffects("token_connected", event.data);
        
        // Refresh canisters to update stats
        fetchCanisters();
      }
    }
    
    if (event.type === "mining_started") {
      const now = Date.now();
      // For mining events, we can allow more frequent notifications
      if (now - lastNotificationTime > 1000) {
        lastNotificationTime = now;
        
        const minerId = event.data?.miner_id?.substring(0, 8) || "unknown";
        const tokenId = event.data?.token_id?.substring(0, 8) || "unknown";
        
        // No toast message for mining events - only animations
        // toastStore.info(`MINER ${minerId}... STARTED MINING FOR ${tokenId}...`, {
        //   title: "⛏️ MINING STARTED",
        //   duration: 3000,
        // });
        
        // Trigger mining animations
        triggerDegenEffects("mining", event.data);
        
        // Refresh canisters to update stats
        fetchCanisters();
      }
    }

    if (event.type === "error") {
      toastStore.error(`${event.data || "Unknown error"}`, {
        title: "💀 LAUNCHPAD ERROR 💀",
        duration: 8000,
      });
    }
  }
</script>

<LaunchAnimations />
<MiningNotifications {miningEvents} />

<div class="min-h-screen h-screen flex flex-col text-white relative">
  <!-- Subtle highlight effect overlay -->
  {#if nukeEffect}
    <div class="fixed inset-0 bg-blue-500 opacity-10 z-50 animate-pulse pointer-events-none"></div>
  {/if}
  
  <!-- HEADER SECTION -->
  <LaunchHeader {stats} {pulseStats} />
  
  <!-- MAIN CONTENT -->
  <main class="container mx-auto px-4 py-6 relative z-10 flex-grow">
    <!-- FLASH EVENT NOTIFICATION -->
    <FlashEvent {flashEvent} />
    
    <!-- SEARCH AND FILTER BAR -->
    <SearchAndFilter 
      bind:activeTab 
      bind:searchQuery 
      bind:sortField 
      bind:sortDirection 
      stats={{ totalTokens: stats.totalTokens, totalMiners: stats.totalMiners }} 
    />
    
    <!-- LIVE ACTIVITY FEED -->
    <LiveActivityFeed {recentEvents} />
    
    <!-- CONTENT PANELS -->
    <ContentPanels 
      {activeTab} 
      {loading} 
      {filteredTokens} 
      {filteredMiners} 
      {pulseTokens} 
      {pulseMiners} 
    />
  </main>

  <!-- SCROLLER AT BOTTOM OF VIEWPORT -->
  <div class="w-full">
    <Scroller isAbsolute={false} position="bottom" />
  </div>
</div>

<style>
  /* DEGEN ANIMATIONS */
  @keyframes pulse-fast {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.9; }
  }
  
  @keyframes slide-in-right {
    0% { transform: translateX(100%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slide-in {
    0% { transform: translateX(20px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  
  :global(.animate-pulse-fast) {
    animation: pulse-fast 0.8s ease-in-out infinite;
  }
  
  :global(.animate-pulse-subtle) {
    animation: pulse-subtle 1.5s ease-in-out infinite;
  }
  
  :global(.animate-slide-in-right) {
    animation: slide-in-right 0.3s ease-out forwards;
  }
  
  :global(.animate-slide-in) {
    animation: slide-in 0.3s ease-out forwards;
  }
</style>
