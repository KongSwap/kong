<script lang="ts">
  import { Clock, Coins, Users, Shield, HelpCircle, ChevronDown, ChevronRight } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  
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

  let expandedSections = $state<Set<string>>(new Set());
  
  function toggleSection(sectionId: string) {
    const newSet = new Set(expandedSections);
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId);
    } else {
      newSet.add(sectionId);
    }
    expandedSections = newSet;
  }
</script>

<div class="glossary-sidebar">
  <Card className="p-4">
    <div class="flex items-center gap-2 mb-4 pb-3 border-b border-kong-border/20">
      <HelpCircle class="w-5 h-5 text-kong-primary" />
      <h3 class="font-semibold text-kong-text-primary">Glossary</h3>
    </div>
    
    <ul class="space-y-1">
      {#each sections as section}
        {@const Icon = section.icon}
        {@const isExpanded = expandedSections.has(section.id)}
        <li>
          <button
            onclick={() => toggleSection(section.id)}
            class="w-full text-left px-3 py-2 rounded-lg transition-all duration-200 hover:bg-kong-bg-tertiary group flex items-center gap-2 text-kong-text-secondary"
          >
            <Icon 
              class="w-4 h-4 flex-shrink-0 text-kong-text-secondary group-hover:text-kong-text-primary" 
            />
            <span class="text-sm font-medium flex-1">{section.title}</span>
            {#if section.subsections}
              {#if isExpanded}
                <ChevronDown class="w-4 h-4 text-kong-text-secondary group-hover:text-kong-text-primary" />
              {:else}
                <ChevronRight class="w-4 h-4 text-kong-text-secondary group-hover:text-kong-text-primary" />
              {/if}
            {/if}
          </button>
          
          {#if section.subsections && isExpanded}
            <ul class="ml-6 mt-1 space-y-0.5">
              {#each section.subsections as subsection}
                <li>
                  <a
                    href="#{subsection.id}"
                    class="w-full text-left px-3 py-1.5 text-xs text-kong-text-secondary hover:text-kong-text-primary transition-colors block"
                  >
                    {subsection.title}
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
    
    <div class="mt-6 pt-4 border-t border-kong-border/20">
      <p class="text-xs text-kong-text-secondary text-center">
        Click sections to expand, click subsections to navigate
      </p>
    </div>
  </Card>
</div>