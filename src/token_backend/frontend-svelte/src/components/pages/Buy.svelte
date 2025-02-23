<script lang="ts">
  import { tokenInfo } from '../../stores/token-info';

  // Use tokenInfo store for token1 name
  $: token1Name = $tokenInfo.name;

  let amount0 = '';  // Amount of ICP
  let amount1 = '';  // Amount of Token1
  let error = '';

  async function handleSwap() {
    if (!amount0) {
      error = 'Please enter the amount of ICP to swap';
      return;
    }

    // Basic input validation (check if it's a number)
    if (isNaN(Number(amount0))) {
      error = 'Please enter a valid number for the amount';
      return;
    }

    try {
      // TODO: Implement actual swap logic with the backend
      // This is just a placeholder.  You'll need to interact
      // with your canister methods here.
      console.log(`Swapping ${amount0} ICP for ${token1Name}...`);

      // Simulate a successful swap.  Replace with actual backend call.
      // You might receive the amount of token1 as a result of the swap.
      amount1 = (Number(amount0) * 10).toFixed(2); // Example: 1 ICP = 10 Token1
      error = '';

    } catch (err:any) {
      error = `Swap failed: ${err.message || 'Unknown error'}`;
    }
  }
</script>

<div class="buy-page">
  <div class="hero-section">
    <h1>Swap ICP for {$tokenInfo.ticker}</h1>
    <p class="subtitle">Instantly trade ICP for {$tokenInfo.name}</p>
  </div>

  <div class="content">
    <div class="features">
      <div class="feature">
        <span class="icon">💎</span>
        <h3>Fair Exchange</h3>
        <p>Transparent and market-driven exchange rates</p>
      </div>
      <div class="feature">
        <span class="icon">🔒</span>
        <h3>Secure</h3>
        <p>Built on Internet Computer with advanced security measures</p>
      </div>
      <div class="feature">
        <span class="icon">⚡</span>
        <h3>Instant</h3>
        <p>Quick and seamless token swap process</p>
      </div>
    </div>

    <div class="swap-interface">
      <h2>Swap Tokens</h2>

      <form on:submit|preventDefault={handleSwap} class="swap-form">
        <div class="input-group">
          <label for="amount0">ICP</label>
          <input
            id="amount0"
            type="text"
            placeholder="Enter ICP amount"
            bind:value={amount0}
            class:error={error}
          />
        </div>

        <div class="input-group">
          <label for="amount1">{$tokenInfo.ticker}</label>
          <input
            id="amount1"
            type="text"
            placeholder="Received {$tokenInfo.ticker} amount"
            bind:value={amount1}
            disabled 
          />
        </div>

        <button type="submit">
          Swap
        </button>
      </form>
      {#if error}
        <p class="error-message">{error}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .buy-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero-section {
    width: 100%;
    background: linear-gradient(to bottom, var(--card-bg), var(--bg-dark));
    padding: 4rem var(--container-padding);
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .content {
    width: 100%;
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 3rem var(--container-padding);
  }

  h1 {
    color: var(--text-green);
    font-size: 3rem;
    margin-bottom: 0.5rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .subtitle {
    color: #888;
    font-size: 1.2rem;
    margin-bottom: 2rem;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin: 2rem 0 4rem 0;
  }

  .feature {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .feature:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
    border-color: var(--text-green);
  }

  .feature .icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    display: inline-block;
  }

  .feature h3 {
    color: var(--text-green);
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .feature p {
    color: #888;
    line-height: 1.6;
  }

  .swap-interface {
    background: var(--card-bg);
    padding: 3rem;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    margin: 0 auto;
  }

  .swap-interface h2 {
    color: var(--text-green);
    margin-bottom: 2rem;
    font-size: 2rem;
    text-align: center;
  }

  .swap-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-group label {
    color: #fff;
    font-size: 1.1rem;
    font-weight: 500;
  }

  input {
    padding: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-size: 1.1rem;
    transition: all 0.2s ease;
  }

  input:focus {
    outline: none;
    border-color: var(--text-green);
    box-shadow: 0 0 0 2px rgba(74, 158, 110, 0.2);
  }

  input.error {
    border-color: var(--error-color);
    box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.2);
  }

  button {
    background: var(--text-green);
    color: var(--bg-dark);
    border: none;
    padding: 1.2rem 2rem;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  button:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  button:active {
    transform: translateY(0);
  }

  .error-message {
    color: var(--error-color);
    margin-top: 1rem;
    font-size: 1rem;
    text-align: center;
    padding: 0.5rem;
    background: rgba(231, 76, 60, 0.1);
    border-radius: 8px;
  }

  @media (max-width: 768px) {
    .hero-section {
      padding: 3rem var(--container-padding);
    }

    h1 {
      font-size: 2.5rem;
    }

    .features {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .swap-interface {
      padding: 2rem;
      border-radius: 12px;
      margin: 0 var(--container-padding);
    }

    .swap-form {
      gap: 1rem;
    }

    button {
      padding: 1rem;
    }
  }
</style> 
