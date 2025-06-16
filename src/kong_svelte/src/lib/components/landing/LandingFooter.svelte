<script lang="ts">
  import { 
    Twitter,
    Github,
    MessageSquare,
    Send as Telegram,
  } from "lucide-svelte";
  
  // Current year for copyright
  const currentYear = new Date().getFullYear();
  
  // Link definitions for footer columns
  const productLinks = [
    { href: "/", label: "Swap" },
    { href: "/pools", label: "Liquidity Pools" },
    { href: "/predict", label: "Prediction Markets" }
  ];
  
  const resourceLinks = [
    { href: "/stats", label: "Analytics" },
    { href: "https://api.kongswap.io/docs", label: "API Docs" },
    { href: "https://dashboard.internetcomputer.org/sns/ormnc-tiaaa-aaaaq-aadyq-cai", label: "SNS Dashboard" },
  ];

  // Social media links
  const socialLinks = [
    { href: "https://twitter.com/kongswapx", icon: Twitter, ariaLabel: "X" },
    { href: "https://t.me/kong_swap", icon: Telegram, ariaLabel: "Telegram" },
    { href: "https://oc.app/community/maceh-niaaa-aaaaf-bm37q-cai", icon: MessageSquare, ariaLabel: "OpenChat" },
    { href: "https://github.com/kongswap", icon: Github, ariaLabel: "GitHub" }
  ];
</script>

<footer id="footer" class="w-full bg-[#0A0D17] border-t border-[rgba(0,164,255,0.2)] py-10 px-6 relative overflow-hidden">
  <!-- Static grid background -->
  <div class="absolute inset-0 z-1 static-grid pointer-events-none opacity-20"></div>
  
  <!-- Diagonal neon glows -->
  <div class="absolute w-[600px] h-[600px] rounded-full opacity-15 bg-[radial-gradient(circle_at_center,rgba(255,0,255,0.3),rgba(255,0,255,0))] top-[-50%] right-[-10%] blur-xl"></div>
  <div class="absolute w-[400px] h-[400px] rounded-full opacity-10 bg-[radial-gradient(circle_at_center,rgba(0,164,255,0.3),rgba(0,164,255,0))] bottom-[-30%] left-[-5%] blur-xl"></div>
  
  <!-- Scanline and vignette effects -->
  <div class="absolute inset-0 scanlines pointer-events-none opacity-10 mix-blend-overlay"></div>
  <div class="absolute inset-0 vignette-footer pointer-events-none"></div>
  
  <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
    <!-- Logo and description -->
    <div class="col-span-1 md:col-span-1">
      <div class="mb-6 kong-logo-container relative h-12 w-full">
        <!-- Match hero section logo -->
        <img 
          src="titles/logo-white-wide.png" 
          alt="KongSwap Logo" 
          class="kong-logo"
        />
      </div>
      <p class="text-sm text-[#A1A7BC] mb-6 font-mono">
        The leading decentralized exchange on the Internet Computer, enabling fast and secure token swaps with low fees.
      </p>
      <div class="flex gap-2">
        {#each socialLinks as social}
          <a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.ariaLabel}>
            <svelte:component this={social.icon} size={20} />
          </a>
        {/each}
      </div>
    </div>
    
    <!-- Products -->
    <div class="col-span-1">
      <h3 class="footer-heading">Products</h3>
      <ul class="space-y-2">
        {#each productLinks as link}
          <li><a href={link.href} class="cyber-link">{link.label}</a></li>
        {/each}
      </ul>
    </div>
    
    <!-- Resources -->
    <div class="col-span-1">
      <h3 class="footer-heading">Resources</h3>
      <ul class="space-y-2">
        {#each resourceLinks as link}
          <li><a href={link.href} class="cyber-link">{link.label}</a></li>
        {/each}
      </ul>
    </div>
    
    <!-- Legal -->
    <div class="col-span-1">
      <h3 class="footer-heading">Social</h3>
      <ul class="space-y-2">
        {#each socialLinks as social}
          <li><a href={social.href} target="_blank" rel="noopener noreferrer" class="cyber-link">{social.ariaLabel}</a></li>
        {/each}
      </ul>
    </div>
  </div>
  
  <!-- Copyright -->
  <div class="max-w-7xl mx-auto mt-10 pt-6 border-t border-[rgba(0,164,255,0.15)] relative z-10">
    <div class="flex flex-col md:flex-row justify-between items-center">
      <p class="text-xs text-[#A1A7BC] font-mono">
        © {currentYear} KongSwap. All rights reserved.
      </p>
      <p class="text-xs text-[#A1A7BC] mt-2 md:mt-0 font-mono">
        Built on the <a href="https://internetcomputer.org" target="_blank" rel="noopener noreferrer" class="text-[#00A4FF] hover:text-[#FF00FF] transition-colors hover:underline">Internet Computer</a>
      </p>
    </div>
  </div>
</footer>

<style scoped>
  /* Animation keyframes */
  @keyframes float-slow {
    0% { transform: translate(0, 0); }
    50% { transform: translate(10px, -10px); }
    100% { transform: translate(0, 0); }
  }
  
  /* Static grid styling */
  .static-grid {
    background-image: 
      linear-gradient(to right, rgba(0, 164, 255, 0.1) 0.5px, transparent 0.5px),
      linear-gradient(to bottom, rgba(0, 164, 255, 0.1) 0.5px, transparent 0.5px);
    background-size: 60px 60px;
  }
  
  /* Logo styling */
  .kong-logo {
    filter: drop-shadow(0 0 8px rgba(0, 164, 255, 0.4));
  }
  
  /* Footer headings - cyberpunk styled */
  .footer-heading {
    position: relative;
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: bold;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1.1rem;
    color: #F8F9FB;
    margin-bottom: 0.25rem;
    text-shadow: 0 0 5px rgba(0, 164, 255, 0.5);
  }
  
  /* Cyber links styling - updated for consistency */
  .cyber-link {
    position: relative;
    color: rgba(161, 167, 188, 0.9);
    text-decoration: none;
    font-size: 0.9rem;
    font-family: 'Space Mono', monospace;
    font-weight: 500;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
  }
  
  .cyber-link:hover {
    color: #00A4FF;
    text-shadow: 0 0 5px rgba(0, 164, 255, 0.5);
  }

  .cyber-link:hover::before {
    opacity: 1;
    transform: translateX(2px);
  }
  
  /* Scanlines overlay */
  .scanlines {
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(0, 0, 0, 0.2) 50%
    );
    background-size: 100% 4px;
    pointer-events: none;
  }
  
  /* Vignette effect for footer */
  .vignette-footer {
    box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.7);
    background: radial-gradient(
      ellipse at center,
      transparent 60%,
      rgba(0, 0, 0, 0.3) 100%
    );
  }
</style> 