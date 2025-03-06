<script lang="ts">
  export let tickerItems = [
    { text: "PROOF-OF-MINING", className: "glitch-text" },
    { text: "MINE ON CHAIN", className: "text-yellow-400 blink-fast" },
    { text: "PROOF-OF-COMPUTE", className: "text-green-400 pulse-text" },
    { text: "KONG MINERS", className: "text-red-400 shake-text" },
    { text: "INTERNET COMPUTER", className: "text-blue-400 zoom-text" },
    { text: "PROOF-OF-WORK 2.0", className: "text-purple-300 glitch-text" },
    { text: "DEPLOY MINERS", className: "text-orange-400 blink-slow" },
    { text: "KONG DEX", className: "text-cyan-400 pulse-text" },
    { text: "ON-CHAIN MINING", className: "text-pink-400 shake-text" },
    { text: "PROOF-OF-CANISTER", className: "text-yellow-300 pulse-text" },
    { text: "CYCLES TO TOKENS", className: "text-blue-300 blink-fast" },
    { text: "DISTRIBUTED MINING", className: "text-amber-400 glitch-text" }
  ];
  
  // Allow customization of repetitions
  export let repetitions = 8;
  
  // Allow customization of animation speed
  export let animationDuration = 20; // seconds
  
  // Position class is no longer needed as we're fixing it to bottom
</script>

<div class="ticker-container overflow-hidden border-t border-blue-500/50 fixed bottom-0 left-0 right-0 z-50">
  <div class="ticker-content" style="animation-duration: {animationDuration}s;">
    {#each Array(repetitions) as _}
      {#each tickerItems as item}
        <span class={`ticker-item ${item.className}`}>{item.text}</span>
      {/each}
    {/each}
  </div>
</div>

<style>
  /* TICKER ANIMATION */
  .ticker-container {
    height: 28px;
    background: rgba(0,0,0,0.7);
    overflow: hidden;
    border-bottom: 1px solid rgba(0, 255, 255, 0.5);
    border-top: 1px solid rgba(0, 130, 255, 0.5);
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    backdrop-filter: blur(5px);
    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  .ticker-container::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 130, 255, 0.8), transparent);
    animation: scanner 3s linear infinite;
  }
  
  @keyframes scanner {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .ticker-content {
    display: flex;
    white-space: nowrap;
    animation: ticker 20s linear infinite;
  }
  
  .ticker-item {
    display: inline-block;
    padding: 0 20px;
    color: #0080ff;
    font-weight: bold;
    font-family: monospace;
    text-shadow: 0 0 5px currentColor;
    position: relative;
    letter-spacing: 1px;
  }
  
  /* DEGEN TEXT EFFECTS */
  .glitch-text {
    position: relative;
    animation: glitch-text 3s infinite;
  }
  
  .glitch-text::before,
  .glitch-text::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  .glitch-text::before {
    left: 2px;
    text-shadow: -1px 0 #00ffff;
    animation: glitch-text-2 3s infinite;
  }
  
  .glitch-text::after {
    left: -2px;
    text-shadow: 1px 0 #0080ff;
    animation: glitch-text-3 2s infinite;
  }
  
  @keyframes glitch-text {
    0% { transform: none; opacity: 1; }
    7% { transform: skew(-0.5deg, -0.9deg); opacity: 0.75; }
    10% { transform: none; opacity: 1; }
    27% { transform: none; opacity: 1; }
    30% { transform: skew(0.8deg, -0.1deg); opacity: 0.75; }
    35% { transform: none; opacity: 1; }
    52% { transform: none; opacity: 1; }
    55% { transform: skew(-1deg, 0.2deg); opacity: 0.75; }
    50% { transform: none; opacity: 1; }
    72% { transform: none; opacity: 1; }
    75% { transform: skew(0.4deg, 1deg); opacity: 0.75; }
    80% { transform: none; opacity: 1; }
    100% { transform: none; opacity: 1; }
  }
  
  .blink-fast {
    animation: blink-fast 0.8s steps(2) infinite;
  }
  
  .blink-slow {
    animation: blink-slow 2s ease-in-out infinite;
  }
  
  @keyframes blink-fast {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  
  @keyframes blink-slow {
    0%, 100% { opacity: 1; text-shadow: 0 0 8px currentColor; }
    50% { opacity: 0.7; text-shadow: 0 0 15px currentColor; }
  }
  
  .pulse-text {
    animation: pulse-text 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse-text {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  
  .shake-text {
    animation: shake-text 2s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
    transform-origin: center;
  }
  
  @keyframes shake-text {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-1px); }
    20%, 40%, 60%, 80% { transform: translateX(1px); }
  }
  
  .zoom-text {
    animation: zoom-text 3s ease-in-out infinite;
  }
  
  @keyframes zoom-text {
    0%, 100% { transform: scale(1); filter: blur(0px); }
    50% { transform: scale(1.1); filter: blur(0.5px); }
  }
  
  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  
  /* ENHANCED GLITCH ANIMATIONS */
  @keyframes glitch-text-2 {
    0% { transform: none; opacity: 1; }
    7% { transform: translate(2px, 3px); opacity: 0.75; }
    10% { transform: none; opacity: 1; }
    27% { transform: none; opacity: 1; }
    30% { transform: translate(-2px, 1px); opacity: 0.75; }
    35% { transform: none; opacity: 1; }
    52% { transform: none; opacity: 1; }
    55% { transform: translate(1px, -2px); opacity: 0.75; }
    50% { transform: none; opacity: 1; }
    72% { transform: none; opacity: 1; }
    75% { transform: translate(-1px, -1px); opacity: 0.75; }
    80% { transform: none; opacity: 1; }
    100% { transform: none; opacity: 1; }
  }
  
  @keyframes glitch-text-3 {
    0% { transform: none; opacity: 1; }
    7% { transform: translate(-2px, -3px); opacity: 0.75; }
    10% { transform: none; opacity: 1; }
    27% { transform: none; opacity: 1; }
    30% { transform: translate(2px, -1px); opacity: 0.75; }
    35% { transform: none; opacity: 1; }
    52% { transform: none; opacity: 1; }
    55% { transform: translate(-1px, 2px); opacity: 0.75; }
    50% { transform: none; opacity: 1; }
    72% { transform: none; opacity: 1; }
    75% { transform: translate(1px, 1px); opacity: 0.75; }
    80% { transform: none; opacity: 1; }
    100% { transform: none; opacity: 1; }
  }
</style> 