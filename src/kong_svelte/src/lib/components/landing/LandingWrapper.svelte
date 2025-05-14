<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { browser } from "$app/environment";
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fetchPoolTotals } from "$lib/api/pools";
  import { fetchVolumeLeaderboard } from "$lib/api/leaderboard";
  import {
    FORMAT_NUMBER_KEY,
    FORMAT_COUNT_KEY,
    TWEENED_TVL_KEY,
    TWEENED_VOLUME_KEY,
    TWEENED_FEES_KEY,
    TWEENED_SWAPS_KEY
  } from "$lib/constants/contextKeys"; // Import shared keys
  import { goto } from "$app/navigation"; // Import goto
  import { page } from "$app/stores";

  import LandingNavbar from "./LandingNavbar.svelte";
  import HeroSection from "./HeroSection.svelte";
  import PredictionMarketsSection from "./PredictionMarketsSection.svelte";
  import SwapSection from "./SwapSection.svelte";
  import GovernanceSection from "./GovernanceSection.svelte";
  import CtaSection from "./CtaSection.svelte";
  import LandingFooter from "./LandingFooter.svelte";

  // Reactive state using $state
  let showGetStarted = $state(false);
  let currentSection = $state(0);
  let sections = [
    "hero",
    "swap",
    "prediction-markets",
    "governance",
    "cta",
    "footer",
  ];
  let observer: IntersectionObserver | undefined;
  let isMenuOpen = $state(false);
  let poolStats = $state({ total_volume_24h: 0, total_tvl: 0, total_fees_24h: 0 });
  let totalSwaps = $state(0);
  let isLoading = $state(true);

  // === Create Tweened Stores for Stats ===
  const tweenOptions = { duration: 1500, easing: cubicOut };
  const tweenedTVL = tweened(0, tweenOptions);
  const tweenedVolume = tweened(0, tweenOptions);
  const tweenedFees = tweened(0, tweenOptions);
  const tweenedSwaps = tweened(0, tweenOptions);

  // Update tweened stores when poolStats or totalSwaps change
  $effect(() => {
    // Only update if not loading AND data is present
    // Check individual properties to ensure they exist
    if (!isLoading && poolStats && typeof poolStats.total_tvl === 'number') {
      tweenedTVL.set(poolStats.total_tvl);
    }
    if (!isLoading && poolStats && typeof poolStats.total_volume_24h === 'number') {
      tweenedVolume.set(poolStats.total_volume_24h);
    }
    if (!isLoading && poolStats && typeof poolStats.total_fees_24h === 'number') {
       tweenedFees.set(poolStats.total_fees_24h); // Added tweenedFees
    }
    if (!isLoading && typeof totalSwaps === 'number') {
       tweenedSwaps.set(totalSwaps);
    }
  });

  let scrollContainer = $state<HTMLElement | undefined>(undefined);
  let scrollY = $state(0);
  let navbarVisible = true; // Always visible, no need for $state
  
  // === Set Context ===
  // Use specific keys for each tweened store
  setContext(TWEENED_TVL_KEY, tweenedTVL);
  setContext(TWEENED_VOLUME_KEY, tweenedVolume);
  setContext(TWEENED_FEES_KEY, tweenedFees);
  setContext(TWEENED_SWAPS_KEY, tweenedSwaps);
  // Keep formatters in context
  setContext(FORMAT_NUMBER_KEY, formatNumber);
  setContext(FORMAT_COUNT_KEY, formatCount);

  // Section visibility states using $state
  let sectionVisibility = $state({
    "hero": false,
    "swap": false, 
    "prediction-markets": false,
    "governance": false,
    "cta": false,
    "footer": false
  });

  // Function to navigate to the swap page
  function navigateToSwap() {
    goto("/swap"); // Use goto for client-side navigation
  }

  // Toggle mobile menu
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  // Format number with commas and optionally to a specific precision
  function formatNumber(num: number | null | undefined, precision: number = 2): string {
    // Handle non-numeric inputs gracefully
    if (typeof num !== 'number' || isNaN(num)) {
      return '$0.00'; // Or return '...' or handle as loading state
    }

    if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(precision)}B`;
    } else if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(precision)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(precision)}K`;
    }
    return `$${num.toFixed(precision)}`;
  }

  // Format count number without dollar sign
  function formatCount(num: number | null | undefined): string {
    // Handle non-numeric inputs gracefully
    if (typeof num !== 'number' || isNaN(num) || num === 0) { // Also treat 0 as loading/initial state here if desired
      return '0'; // Or return '...' 
    }

    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M+`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(0)}K+`;
    }
    return num.toString();
  }

  // Fetch pool stats and leaderboard data
  async function loadData() {
    try {
      isLoading = true;

      // Fetch pool stats and leaderboard in parallel
      const [poolStatsData, leaderboardData] = await Promise.all([
        fetchPoolTotals(),
        fetchVolumeLeaderboard("month", 100), // Get larger leaderboard data for better approximation
      ]);

      poolStats = poolStatsData;
      
      // Reset totalSwaps before calculation
      let calculatedSwaps = 0; 

      // Calculate approximate total swaps from leaderboard data
      if (Array.isArray(leaderboardData)) {
        // If it's a direct array of entries
        calculatedSwaps = leaderboardData.reduce(
          (sum, entry) => sum + (entry.swap_count || 0), // Add fallback for safety
          0,
        );
        totalSwaps = calculatedSwaps;
      } else if (leaderboardData && Array.isArray(leaderboardData.items)) {
        // If it's in the format with items property
        calculatedSwaps = leaderboardData.items.reduce(
          (sum, entry) => sum + (entry?.swap_count || 0), // Add optional chaining and fallback
          0,
        );
        totalSwaps = calculatedSwaps; // Assign state here
      } else {
        totalSwaps = 0; // Default if format is unexpected
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Set default value in case of error
      totalSwaps = 2850000;
    } finally {
      isLoading = false;
    }
  }

  // Scroll to section
  function scrollToSection(index: number) {
    if (!browser) return;

    // Close mobile menu if open
    if (isMenuOpen) {
      isMenuOpen = false;
    }

    const section = document.getElementById(sections[index]);
    if (section) {
      // Update current section immediately for faster UI feedback
      currentSection = index;
      
      // Use smooth scrolling behavior
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  // Handle scroll events
  function handleScroll() {
    if (!scrollContainer) return;

    scrollY = scrollContainer.scrollTop;

    // Always keep navbar visible
    navbarVisible = true;

    // Close mobile menu on scroll
    if (isMenuOpen) {
      isMenuOpen = false;
    }
  }

  // Lifecycle hooks
  onMount(() => {
    if (browser) {
      // Load data
      loadData();

      // Show get started button after a short delay
      setTimeout(() => {
        showGetStarted = true;
      }, 1200);

      // Set up intersection observer to detect current section
      const options = {
        root: null, // viewport
        rootMargin: "0px 0px -30% 0px",  // Keep the less aggressive margin
        threshold: 0.2, // Trigger when 20% of the section is visible
      };

      observer = new IntersectionObserver((entries) => {
        // Update section visibility states
        entries.forEach(entry => {
          if (entry.target.id && sections.includes(entry.target.id)) {
            // Update section visibility state directly based on intersection threshold
            sectionVisibility[entry.target.id as keyof typeof sectionVisibility] = 
              entry.isIntersecting && entry.intersectionRatio >= options.threshold;
          }
        });
        
        // Find the entry that is currently intersecting (crossed the threshold)
        const intersectingEntry = entries.find(entry => entry.isIntersecting);
           
        if (intersectingEntry) {
          const index = sections.indexOf(intersectingEntry.target.id);
          if (index !== -1 && index !== currentSection) {
            // Update currentSection directly
            currentSection = index;
          }
        }
      }, options);

      // Observe all section elements
      sections.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
          observer.observe(element);
        }
      });

      // Add keyboard navigation
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          if (currentSection < sections.length - 1) {
            scrollToSection(currentSection + 1);
          }
          e.preventDefault();
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
          if (currentSection > 0) {
            scrollToSection(currentSection - 1);
          }
          e.preventDefault();
        }
      };

      window.addEventListener("keydown", handleKeydown);

      // Add scroll listener
      if (scrollContainer) {
        const currentScrollContainer = scrollContainer; // Capture state
        currentScrollContainer.addEventListener("scroll", handleScroll);
      }

      return () => {
        if (observer) {
          observer.disconnect();
        }
        window.removeEventListener("keydown", handleKeydown);
        // Remove scroll listener
        if (scrollContainer) {
          scrollContainer.removeEventListener("scroll", handleScroll);
        }
      };
    }
  });
</script>

<div
  class="fixed inset-0 bg-[#0D111F] text-[#F8F9FB] font-['Inter',sans-serif] antialiased landing-wrapper"
>
  <!-- Navbar -->
  <LandingNavbar
    {currentSection}
    {isMenuOpen}
    {toggleMenu}
    {scrollToSection}
    {navigateToSwap}
  />

  <div
    class="h-screen overflow-y-auto overflow-x-hidden scroll-smooth pb-0"
    bind:this={scrollContainer}
  >
    <!-- Hero Section -->
    <HeroSection
      {showGetStarted}
      {navigateToSwap}
      isVisible={sectionVisibility["hero"]}
    />

    <!-- Swap Section -->
    <SwapSection 
      isVisible={sectionVisibility["swap"]}
    />

    <!-- Prediction Markets Section -->
    <PredictionMarketsSection 
      isVisible={sectionVisibility["prediction-markets"]}
    />

    <!-- Governance Section -->
    <GovernanceSection 
      isVisible={sectionVisibility["governance"]}
    />

    <!-- CTA Section -->
    <CtaSection 
      {navigateToSwap}
      isVisible={sectionVisibility["cta"]}
    />

    <!-- Footer -->
    <div id="footer">
      <LandingFooter />
    </div>

  </div>
</div>
