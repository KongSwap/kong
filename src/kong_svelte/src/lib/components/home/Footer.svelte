<script lang="ts">
  import Icon from "@iconify/svelte";
  import { Heart, Infinity } from "lucide-svelte";
  
  const currentYear = new Date().getFullYear();
  
  interface FooterLink {
    name: string;
    href: string;
    external?: boolean;
    disabled?: boolean;
  }
  
  interface FooterSection {
    title: string;
    links: FooterLink[];
  }
  
  const footerSections: FooterSection[] = [
    {
      title: "Product",
      links: [
        { name: "Swap", href: "/swap" },
        { name: "Pools", href: "/pools" },
        { name: "Predict", href: "/predict" },
        { name: "Stats", href: "/stats" },
      ],
    },
    {
      title: "Developers",
      links: [
        { name: "Documentation", href: "https://docs.kongswap.io", external: true },
        { name: "GitHub", href: "https://github.com/KongSwap", external: true },
      ],
    },
    {
      title: "Community",
      links: [
        { name: "X", href: "https://twitter.com/KongSwapX", external: true },
        { name: "Telegram", href: "https://t.me/kong_swap", external: true },
        { name: "OpenChat", href: "https://oc.app/community/maceh-niaaa-aaaaf-bm37q-cai/channel/1210333112/?ref=y3rqn-fyaaa-aaaaf-a7z6a-cai", external: true },
      ],
    },
  ];
  
  const socialLinks = [
    { name: "GitHub", href: "https://github.com/KongSwap", icon: "line-md:github" },
    { name: "Twitter", href: "https://twitter.com/KongSwapX", icon: "line-md:twitter-x" },
    { name: "Telegram", href: "https://t.me/kong_swap", icon: "line-md:telegram" },
  ];
</script>

{#snippet brandSection(isMobile = false)}
  <div class="flex items-center gap-3 mb-4">
    <div class="w-10 h-10 kong-logo-mask"></div>
    <span class="text-2xl font-bold text-kong-text-primary">KongSwap</span>
  </div>
  <p class="text-kong-text-secondary leading-relaxed {isMobile ? 'text-sm mb-4' : 'text-sm lg:text-base mb-6'}">
    {isMobile 
      ? "The bridgeless future of DeFi on the Internet Computer."
      : "The bridgeless future of DeFi on the Internet Computer. Trade any token directly across chains with no wrapping."}
  </p>
{/snippet}

{#snippet socialIcons(isMobile = false)}
  <div class="flex {isMobile ? 'gap-2' : 'gap-4'}">
    {#each socialLinks as social}
      <a
        href={social.href}
        target="_blank"
        rel="noopener noreferrer"
        class="{isMobile ? 'p-2.5' : 'p-2'} bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
        aria-label={social.name}
      >
        <Icon icon={social.icon} class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
      </a>
    {/each}
  </div>
{/snippet}

{#snippet externalLinkIcon(size = "sm")}
  <svg class="{size === 'sm' ? 'w-2.5 h-2.5 sm:w-3 sm:h-3' : 'w-3 h-3'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
{/snippet}

<footer class="w-full bg-gradient-to-b from-kong-bg-secondary to-kong-bg-primary border-t border-kong-border/50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12">
    <!-- Mobile Brand Section -->
    <div class="block md:hidden mb-6">
      {@render brandSection(true)}
      {@render socialIcons(true)}
    </div>

    <!-- Desktop Layout -->
    <div class="hidden md:flex md:justify-between gap-8 mb-8">
      <!-- Brand Section (Desktop) -->
      <div class="flex-shrink-1 w-[500px]">
        {@render brandSection(false)}
        {@render socialIcons(false)}
      </div>

      <!-- Links Sections (Desktop) -->
      <div class="grid grid-cols-3 gap-8 lg:gap-12">
        {#each footerSections as section}
          <div>
            <h3 class="font-semibold text-kong-text-primary mb-4">{section.title}</h3>
            <ul class="space-y-3">
              {#each section.links as link}
                <li>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-sm {link.external ? 'inline-flex items-center gap-1' : ''}"
                    class:opacity-50={link.disabled}
                    class:pointer-events-none={link.disabled}
                  >
                    {link.name}
                    {#if link.external}
                      {@render externalLinkIcon("md")}
                    {/if}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>

    <!-- Mobile Links -->
    <div class="grid grid-cols-2 xs:grid-cols-3 gap-4 sm:gap-6 md:hidden mb-8">
      {#each footerSections as section, i}
        <div class="{section.title === 'Community' ? 'col-span-2 xs:col-span-1' : ''}">
          <h3 class="font-semibold text-kong-text-primary text-sm sm:text-base mb-3">{section.title}</h3>
          <ul class="space-y-2">
            {#each section.links as link}
              <li>
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-xs sm:text-sm {link.external ? 'inline-flex items-center gap-0.5' : ''}"
                  class:opacity-50={link.disabled}
                  class:pointer-events-none={link.disabled}
                >
                  {link.name}
                  {#if link.external}
                    {@render externalLinkIcon("sm")}
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>

    <!-- Divider -->
    <div class="border-t border-kong-border/30 pt-6 pb-4 sm:py-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
        <!-- Copyright -->
        <div class="text-xs sm:text-sm text-kong-text-secondary text-center sm:text-left">
          © {currentYear} KongSwap. All rights reserved.
        </div>

        <!-- Additional Info -->
        <div class="flex items-center gap-6 group cursor-pointer" onclick={() => {
          window.open("https://www.internetcomputer.org", "_blank");
        }}>
          <div class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-kong-text-secondary group-hover:text-kong-text-primary transition-colors">
            <span>Built 100% on chain with</span>
            <Infinity class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-kong-accent-blue" />
            <span>ICP</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</footer>

<style>
  /* Apply kong-text-primary color to Kong logo using CSS mask */
  .kong-logo-mask {
    background-color: rgb(var(--text-primary));
    -webkit-mask-image: url('/images/kongface-white.svg');
    mask-image: url('/images/kongface-white.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
</style>