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
  
  const footerLinks: {
    product: FooterLink[];
    developers: FooterLink[];
    community: FooterLink[];
  } = {
    product: [
      { name: "Swap", href: "/swap" },
      { name: "Pools", href: "/pools" },
      { name: "Predict", href: "/predict" },
      { name: "Stats", href: "/stats" },
    ],
    developers: [
      { name: "Documentation", href: "https://docs.kongswap.io", external: true },
      { name: "GitHub", href: "https://github.com/KongSwap", external: true },
    ],
    community: [
      { name: "X", href: "https://twitter.com/KongSwapX", external: true },
      { name: "Telegram", href: "https://t.me/kong_swap", external: true },
      { name: "OpenChat", href: "https://oc.app/community/maceh-niaaa-aaaaf-bm37q-cai/channel/1210333112/?ref=y3rqn-fyaaa-aaaaf-a7z6a-cai", external: true },
    ],
  };
</script>

<footer class="w-full bg-gradient-to-b from-kong-bg-secondary to-kong-bg-primary border-t border-kong-border/50">
  <div class="max-w-7xl mx-auto px-4 pt-8 md:pt-12">
    <!-- Mobile Brand Section -->
    <div class="block md:hidden mb-8">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 kong-logo-mask"></div>
        <span class="text-2xl font-bold text-kong-text-primary">KongSwap</span>
      </div>
      <p class="text-kong-text-secondary text-sm mb-4">
        The bridgeless future of DeFi on the Internet Computer.
      </p>
      <div class="flex gap-3">
        <a
          href="https://github.com/KongSwap"
          target="_blank"
          rel="noopener noreferrer"
          class="p-2 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
          aria-label="GitHub"
        >
          <Icon icon="line-md:github" class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
        </a>
        <a
          href="https://twitter.com/KongSwapX"
          target="_blank"
          rel="noopener noreferrer"
          class="p-2 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
          aria-label="Twitter"
        >
          <Icon icon="line-md:twitter-x" class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
        </a>
        <a
          href="https://t.me/kong_swap"
          target="_blank"
          rel="noopener noreferrer"
          class="p-2 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
          aria-label="Telegram"
        >
          <Icon icon="line-md:telegram" class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
        </a>
      </div>
    </div>

    <!-- Desktop Layout -->
    <div class="hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
      <!-- Brand Section (Desktop) -->
      <div class="lg:col-span-2">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 kong-logo-mask"></div>
          <span class="text-2xl font-bold text-kong-text-primary">KongSwap</span>
        </div>
        <p class="text-kong-text-secondary mb-6 max-w-sm">
          The bridgeless future of DeFi on the Internet Computer. Trade any token directly across chains with no wrapping.
        </p>
        <div class="flex gap-4">
          <a
            href="https://github.com/KongSwap"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
            aria-label="GitHub"
          >
            <Icon icon="line-md:github" class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
          </a>
          <a
            href="https://twitter.com/KongSwapX"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
            aria-label="Twitter"
          >
            <Icon icon="line-md:twitter-x" class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
          </a>
          <a
            href="https://t.me/kong_swap"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
            aria-label="Telegram"
          >
            <Icon icon="line-md:telegram" class="w-5 h-5 text-kong-text-secondary hover:text-kong-text-primary transition-colors" />
          </a>
        </div>
      </div>

      <!-- Links Sections (Desktop) -->
      <div>
        <h3 class="font-semibold text-kong-text-primary mb-4">Product</h3>
        <ul class="space-y-3">
          {#each footerLinks.product as link}
            <li>
              <a
                href={link.href}
                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-sm"
                class:opacity-50={link.disabled}
                class:pointer-events-none={link.disabled}
              >
                {link.name}
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="font-semibold text-kong-text-primary mb-4">Developers</h3>
        <ul class="space-y-3">
          {#each footerLinks.developers as link}
            <li>
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-sm inline-flex items-center gap-1"
              >
                {link.name}
                {#if link.external}
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="font-semibold text-kong-text-primary mb-4">Community</h3>
        <ul class="space-y-3">
          {#each footerLinks.community as link}
            <li>
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-sm inline-flex items-center gap-1"
              >
                {link.name}
                {#if link.external}
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <!-- Mobile Links -->
    <div class="grid grid-cols-3 gap-6 md:hidden mb-8">
      <div>
        <h3 class="font-semibold text-kong-text-primary text-sm mb-3">Product</h3>
        <ul class="space-y-2">
          {#each footerLinks.product as link}
            <li>
              <a
                href={link.href}
                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-xs"
                class:opacity-50={link.disabled}
                class:pointer-events-none={link.disabled}
              >
                {link.name}
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="font-semibold text-kong-text-primary text-sm mb-3">Developers</h3>
        <ul class="space-y-2">
          {#each footerLinks.developers as link}
            <li>
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-xs inline-flex items-center gap-0.5"
              >
                {link.name}
                {#if link.external}
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="font-semibold text-kong-text-primary text-sm mb-3">Community</h3>
        <ul class="space-y-2">
          {#each footerLinks.community as link}
            <li>
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors text-xs inline-flex items-center gap-0.5"
              >
                {link.name}
                {#if link.external}
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <!-- Divider -->
    <div class="border-t border-kong-border/30 py-6">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <!-- Copyright -->
        <div class="text-sm text-kong-text-secondary">
          © {currentYear} KongSwap. All rights reserved.
        </div>

        <!-- Additional Info -->
        <div class="flex items-center gap-6 group cursor-pointer" onclick={() => {
          window.open("https://www.internetcomputer.org", "_blank");
        }}>
          <div class="flex items-center gap-2 text-sm text-kong-text-secondary group-hover:text-kong-text-primary transition-colors">
            <span>Built 100% on chain with</span>
            <Infinity class="w-4 h-4 text-kong-accent-blue" />
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