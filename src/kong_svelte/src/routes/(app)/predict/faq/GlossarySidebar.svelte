<script lang="ts">
  import { onMount } from "svelte";
  import { Clock, Coins, Users, Shield, HelpCircle } from "lucide-svelte";
  
  interface Section {
    id: string;
    title: string;
    icon: any;
    subsections?: { id: string; title: string }[];
  }
  
  const sections: Section[] = [
    {
      id: "time-weighted",
      title: "Time-Weighted Rewards",
      icon: Clock,
      subsections: [
        { id: "time-weighted", title: "What is time-weighted?" },
        { id: "time-weighted", title: "How the math works" },
        { id: "time-weighted", title: "Why use time weighting?" },
        { id: "time-weighted", title: "Time weight examples" }
      ]
    },
    {
      id: "multi-token",
      title: "Multi-Token Support",
      icon: Coins,
      subsections: [
        { id: "multi-token", title: "Supported tokens" },
        { id: "multi-token", title: "User-created markets" },
        { id: "multi-token", title: "Token-specific features" }
      ]
    },
    {
      id: "dual-resolution",
      title: "Dual Resolution",
      icon: Users,
      subsections: [
        { id: "dual-resolution", title: "How it prevents manipulation" },
        { id: "dual-resolution", title: "Resolution process" },
        { id: "dual-resolution", title: "Why this prevents cheating" },
        { id: "dual-resolution", title: "Admin vs User markets" }
      ]
    },
    {
      id: "claims",
      title: "Claims & Winnings",
      icon: Shield,
      subsections: [
        { id: "claims", title: "How to claim winnings" },
        { id: "claims", title: "Claim status types" },
        { id: "claims", title: "Important notes" }
      ]
    },
    {
      id: "security",
      title: "Security & Trust",
      icon: Shield,
      subsections: [
        { id: "security", title: "Market integrity" },
        { id: "security", title: "Fund safety" },
        { id: "security", title: "Platform guarantees" }
      ]
    }
  ];
  
  let activeSection = $state("");
  
  function scrollToSection(id: string) {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  }
  
  function handleScroll() {
    // Update active section
    let currentSection = "";
    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom > 100) {
          currentSection = section.id;
          break;
        }
      }
    }
    activeSection = currentSection;
  }
  
  onMount(() => {
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Set initial state
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });
</script>

<div class="glossary-sidebar">
  <nav class="bg-kong-bg-secondary rounded-lg border border-kong-border/30 p-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
    <div class="flex items-center gap-2 mb-4 pb-3 border-b border-kong-border/20">
      <HelpCircle class="w-5 h-5 text-kong-primary" />
      <h3 class="font-semibold text-kong-text-primary">Glossary</h3>
    </div>
    
    <ul class="space-y-1">
      {#each sections as section}
        {@const Icon = section.icon}
        <li>
          <button
            onclick={() => scrollToSection(section.id)}
            class="w-full text-left px-3 py-2 rounded-lg transition-all duration-200 hover:bg-kong-bg-tertiary group flex items-center gap-2
                   {activeSection === section.id ? 'bg-kong-primary/10 text-kong-primary' : 'text-kong-text-secondary'}"
          >
            <Icon 
              class="w-4 h-4 flex-shrink-0 {activeSection === section.id ? 'text-kong-primary' : 'text-kong-text-secondary group-hover:text-kong-text-primary'}" 
            />
            <span class="text-sm font-medium">{section.title}</span>
          </button>
          
          {#if section.subsections && activeSection === section.id}
            <ul class="ml-6 mt-1 space-y-0.5">
              {#each section.subsections as subsection}
                <li>
                  <button
                    onclick={() => scrollToSection(subsection.id)}
                    class="w-full text-left px-3 py-1.5 text-xs text-kong-text-secondary hover:text-kong-text-primary transition-colors"
                  >
                    {subsection.title}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
    
    <div class="mt-6 pt-4 border-t border-kong-border/20">
      <p class="text-xs text-kong-text-secondary text-center">
        Click any section to navigate
      </p>
    </div>
  </nav>
</div>

<style>
  .glossary-sidebar nav {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
  }
  
  .glossary-sidebar nav::-webkit-scrollbar {
    width: 6px;
  }
  
  .glossary-sidebar nav::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .glossary-sidebar nav::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 3px;
  }
  
  .glossary-sidebar nav::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.5);
  }
</style>