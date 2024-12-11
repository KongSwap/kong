<script lang="ts">
  import { onMount } from 'svelte';

  function createBanana() {
    const banana = document.createElement('div');
    banana.innerHTML = '🍌';
    banana.className = 'banana';
    banana.style.left = Math.random() * 100 + 'vw';
    banana.style.animationDuration = Math.random() * 2 + 2 + 's';
    banana.style.transform = `scale(${Math.random() * 0.5 + 0.8})`;
    document.body.appendChild(banana);

    // Remove the banana after animation completes
    setTimeout(() => {
      banana.remove();
    }, 5000);
  }

  onMount(() => {
    // Create multiple bananas
    for (let i = 0; i < 50; i++) {
      setTimeout(() => createBanana(), Math.random() * 2000);
    }
  });
</script>

<style>
  :global(.banana) {
    position: fixed;
    top: -20px;
    font-size: 24px;
    pointer-events: none;
    z-index: 9999;
    animation: fall linear forwards 3s;
  }

  @keyframes fall {
    from {
      transform: translateY(0vh) rotate(0deg);
    }
    to {
      transform: translateY(105vh) rotate(360deg);
    }
  }
</style> 