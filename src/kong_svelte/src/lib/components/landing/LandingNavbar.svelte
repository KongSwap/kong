<script lang="ts">
  import { fade } from "svelte/transition";
  import LandingButton from "./LandingButton.svelte";
  import TokenTicker from "../nav/TokenTicker.svelte";
  export let currentSection: number;
  export let isMenuOpen: boolean;
  export let toggleMenu: () => void;
  export let scrollToSection: (index: number) => void;
  export let navigateToSwap: () => void;
</script>

<TokenTicker />

<nav 
  class="absolute top-0 left-0 right-0 z-50 h-20 bg-transparent"
>
  <div class="max-w-7xl mx-auto px-6 h-full flex items-center justify-between relative mt-7">
    <!-- Logo -->
    <div class="flex items-center gap-3">
      <img 
        src="/images/kongface-white.svg" 
        alt="KongSwap" 
        class="w-10 h-10 filter drop-shadow-[0_0_4px_rgba(0,164,255,0.5)] transition-all duration-300 ease-in-out hover:drop-shadow-[0_0_8px_rgba(0,164,255,0.8)] hover:scale-105" 
      />
    </div>
    
    <!-- Desktop Navigation - Centered -->
    <div class="hidden md:flex gap-8 absolute left-1/2 transform -translate-x-1/2">
      <a 
        href="#hero" 
        class="text-[#A1A7BC] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] text-[0.9rem] tracking-wide font-semibold uppercase py-2 relative transition-all duration-250 ease-in-out hover:text-[#7DF9FF] hover:tracking-wider hover:-translate-y-[1px] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#00A4FF] after:transition-all after:duration-200 hover:after:w-full {currentSection === 0 ? 'text-[#7DF9FF]' : ''}" 
        onclick={(e) => e.preventDefault && scrollToSection(0)}
      >
        HOME
      </a>
      <a 
        href="#swap" 
        class="text-[#A1A7BC] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] text-[0.9rem] tracking-wide font-semibold uppercase py-2 relative transition-all duration-250 ease-in-out hover:text-[#7DF9FF] hover:tracking-wider hover:-translate-y-[1px] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#00A4FF] after:transition-all after:duration-200 hover:after:w-full {currentSection === 1 ? 'text-[#7DF9FF]' : ''}" 
        onclick={(e) => e.preventDefault && scrollToSection(1)}
      >
        SWAP
      </a>
      <a 
        href="#prediction-markets" 
        class="text-[#A1A7BC] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] text-[0.9rem] tracking-wide font-semibold uppercase py-2 relative transition-all duration-250 ease-in-out hover:text-[#7DF9FF] hover:tracking-wider hover:-translate-y-[1px] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#00A4FF] after:transition-all after:duration-200 hover:after:w-full {currentSection === 2 ? 'text-[#7DF9FF]' : ''}" 
        onclick={(e) => e.preventDefault && scrollToSection(2)}
      >
        PREDICT
      </a>
      <a 
        href="#governance" 
        class="text-[#A1A7BC] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] text-[0.9rem] tracking-wide font-semibold uppercase py-2 relative transition-all duration-250 ease-in-out hover:text-[#7DF9FF] hover:tracking-wider hover:-translate-y-[1px] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#00A4FF] after:transition-all after:duration-200 hover:after:w-full {currentSection === 3 ? 'text-[#7DF9FF]' : ''}" 
        onclick={(e) => e.preventDefault && scrollToSection(3)}
      >
        GOVERNANCE
      </a>
    </div>
    
    <!-- Actions -->
    <div class="flex items-center">
      <LandingButton 
        onClick={navigateToSwap} 
        buttonClass="hidden md:flex bg-[rgba(0,10,30,0.3)] text-[#00D8FF] border border-[rgba(0,216,255,0.4)] shadow-[0_0_10px_rgba(0,216,255,0.2),inset_0_0_5px_rgba(0,216,255,0.1)] hover:text-white hover:bg-[rgba(0,216,255,0.8)] hover:border-[rgba(0,216,255,0.8)] hover:shadow-[0_0_15px_rgba(0,216,255,0.5),0_0_30px_rgba(0,216,255,0.3),inset_0_0_10px_rgba(255,255,255,0.2)] active:shadow-[0_0_8px_rgba(0,216,255,0.3),inset_0_0_4px_rgba(0,216,255,0.1)]" 
      />
      
      <button 
        class="md:hidden bg-transparent border-none cursor-pointer p-2" 
        onclick={toggleMenu} 
        aria-label="Toggle menu"
      >
        <div class="w-6 h-[18px] relative transition-transform duration-500 ease-in-out">
          <span class="{isMenuOpen ? 'top-2 rotate-[135deg]' : 'top-0 rotate-0'} block absolute h-0.5 w-full bg-[#F8F9FB] rounded opacity-100 left-0 transition-all duration-250 ease-in-out"></span>
          <span class="{isMenuOpen ? 'opacity-0 -left-[60px]' : 'opacity-100 left-0'} block absolute h-0.5 w-full bg-[#F8F9FB] rounded top-2 transition-all duration-250 ease-in-out"></span>
          <span class="{isMenuOpen ? 'top-2 -rotate-[135deg]' : 'top-4 rotate-0'} block absolute h-0.5 w-full bg-[#F8F9FB] rounded opacity-100 left-0 transition-all duration-250 ease-in-out"></span>
        </div>
      </button>
    </div>
  </div>
  
  <!-- Mobile Menu -->
  {#if isMenuOpen}
    <div class="md:hidden absolute top-20 left-0 right-0 bg-[rgba(13,17,31,0.95)] backdrop-blur-md z-49 border-b border-[rgba(255,255,255,0.05)]" transition:fade={{ duration: 200 }}>
      <div class="flex flex-col p-6">
        <a 
          href="#hero" 
          class="text-[#A1A7BC] text-lg font-medium py-4 border-b border-[rgba(255,255,255,0.05)] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] uppercase transition-all duration-250 ease-in-out hover:text-[#7DF9FF] {currentSection === 0 ? 'text-[#7DF9FF]' : ''}" 
          onclick={(e) => e.preventDefault && scrollToSection(0)}
        >
          HOME
        </a>
        <a 
          href="#swap" 
          class="text-[#A1A7BC] text-lg font-medium py-4 border-b border-[rgba(255,255,255,0.05)] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] uppercase transition-all duration-250 ease-in-out hover:text-[#7DF9FF] {currentSection === 1 ? 'text-[#7DF9FF]' : ''}" 
          onclick={(e) => e.preventDefault && scrollToSection(1)}
        >
          SWAP
        </a>
        <a 
          href="#prediction-markets" 
          class="text-[#A1A7BC] text-lg font-medium py-4 border-b border-[rgba(255,255,255,0.05)] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] uppercase transition-all duration-250 ease-in-out hover:text-[#7DF9FF] {currentSection === 2 ? 'text-[#7DF9FF]' : ''}" 
          onclick={(e) => e.preventDefault && scrollToSection(2)}
        >
          PREDICT
        </a>
        <a 
          href="#governance" 
          class="text-[#A1A7BC] text-lg font-medium py-4 border-b border-[rgba(255,255,255,0.05)] font-['Inter',_'Rajdhani',_'SF_Pro_Display',_sans-serif] uppercase transition-all duration-250 ease-in-out hover:text-[#7DF9FF] {currentSection === 3 ? 'text-[#7DF9FF]' : ''}" 
          onclick={(e) => e.preventDefault && scrollToSection(3)}
        >
          GOVERNANCE
        </a>
        <LandingButton 
          onClick={navigateToSwap} 
          buttonClass="mt-6 inline-flex bg-[rgba(0,10,30,0.3)] text-[#00D8FF] border border-[rgba(0,216,255,0.4)] shadow-[0_0_10px_rgba(0,216,255,0.2),inset_0_0_5px_rgba(0,216,255,0.1)] hover:text-white hover:bg-[rgba(0,216,255,0.8)] hover:border-[rgba(0,216,255,0.8)] hover:shadow-[0_0_15px_rgba(0,216,255,0.5),0_0_30px_rgba(0,216,255,0.3),inset_0_0_10px_rgba(255,255,255,0.2)] active:shadow-[0_0_8px_rgba(0,216,255,0.3),inset_0_0_4px_rgba(0,216,255,0.1)]"
        />
      </div>
    </div>
  {/if}
</nav> 