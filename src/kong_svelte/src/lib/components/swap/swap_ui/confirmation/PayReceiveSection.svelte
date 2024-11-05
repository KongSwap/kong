<script lang="ts">
  import { tokenStore } from '$lib/stores/tokenStore';
  import { cubicOut } from 'svelte/easing';

  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;

  const float = (node, { delay = 0, duration = 2000 }) => {
    return {
      delay,
      duration,
      css: t => {
        const y = Math.sin(t * 2 * Math.PI) * 3;
        return `transform: translateY(${y}px);`;
      },
      loop: true
    };
  };

  const swoopIn = (node, { delay = 0, duration = 500 }) => {
    return {
      delay,
      duration,
      css: t => {
        const bounce = cubicOut(t);
        const scale = 0.9 + (bounce * 0.1) + Math.sin(t * Math.PI) * 0.02;
        return `
          transform: translateY(${(1 - bounce) * 20}px) scale(${scale});
          opacity: ${bounce};
        `;
      }
    };
  };
</script>

<div class="section top-section glass-effect">
  <div class="amount-row" in:swoopIn={{ delay: 150 }}>
    <span class="label">You Pay</span>
    <div class="token-amount">
      <span class="amount glow-text">{payAmount}</span>
      <div class="token-badge hover-effect">
        <img src={$tokenStore.tokens?.find(t => t.symbol === payToken)?.logo || "/tokens/not_verified.webp"} 
             alt={payToken} class="token-icon"/>
        <span>{payToken}</span>
      </div>
    </div>
  </div>

  <div class="separator shine"></div>

  <div class="amount-row" in:swoopIn={{ delay: 300 }}>
    <span class="label">You Receive</span>
    <div class="token-amount">
      <span class="amount">{receiveAmount}</span>
      <div class="token-badge">
        <img src={$tokenStore.tokens?.find(t => t.symbol === receiveToken)?.logo || "/tokens/not_verified.webp"} 
             alt={receiveToken} class="token-icon"/>
        <span>{receiveToken}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .section {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 16px;
  }

  .top-section {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  }

  .glass-effect {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
  }

  .label {
    color: #888;
  }

  .token-amount {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .amount {
    font-family: monospace;
  }

  .glow-text {
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  .token-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 12px;
    border-radius: 8px;
    transition: all 0.3s ease;
  }

  .hover-effect:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.2);
  }

  .token-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .separator {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 215, 0, 0.2),
      transparent
    );
    margin: 8px 0;
    position: relative;
    overflow: hidden;
  }

  .separator.shine::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 215, 0, 0.3),
      transparent
    );
    animation: shine 3s infinite;
  }

  @keyframes shine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
</style> 
