<script lang="ts">
  export let title: string;
  export let description: string;
  export let isActive = false;
  export let isComingSoon = false;
  export let metric: string | undefined = undefined;
  export let metricLabel: string | undefined = undefined;
</script>

<button 
  class="earn-card"
  class:active={isActive}
  class:coming-soon={isComingSoon}
  disabled={isComingSoon}
  on:click
>
  <div class="card-content">
    <h3>{title}</h3>
    <p>{description}</p>
    {#if metric && metricLabel}
      <div class="metric">{metric} {metricLabel}</div>
    {/if}
    {#if isComingSoon}
      <div class="coming-soon-label">
        <span class="coming-soon-icon">🚀</span>
        Coming Soon
      </div>
    {/if}
  </div>
</button>

<style>
  .earn-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 1.25rem;
    border-radius: 0.75rem;
    background-color: rgba(26, 27, 35, 0.6);
    border: 1px solid #2a2d3d;
    text-align: left;
    transition: all 0.2s;
    backdrop-filter: blur(4px);
    width: 100%;
  }

  .earn-card:not(.coming-soon):hover {
    background-color: rgba(30, 31, 42, 0.8);
    border-color: rgba(96, 165, 250, 0.3);
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.1);
    transform: translateY(-2px);
  }

  .earn-card.active {
    background: linear-gradient(to bottom, #1e1f2a, #1a1b23);
    border-color: rgba(96, 165, 250, 0.2);
    box-shadow: 0 0 15px rgba(96, 165, 250, 0.1);
  }

  .earn-card.coming-soon {
    cursor: not-allowed;
    opacity: 0.8;
    background: linear-gradient(to bottom, rgba(30, 31, 42, 0.4), rgba(26, 27, 35, 0.4));
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .card-content h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .card-content p {
    color: #8890a4;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .metric {
    color: #60A5FA;
    font-weight: 500;
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .coming-soon-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #60A5FA;
  }

  @media (max-width: 768px) {
    .earn-card {
      padding: 1rem;
    }

    .card-content h3 {
      font-size: 1.125rem;
    }
  }
</style> 