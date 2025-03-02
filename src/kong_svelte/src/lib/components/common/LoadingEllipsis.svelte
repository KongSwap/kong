<script lang="ts">
  export let color = "text-kong-text-primary";
  export let size = "text-lg";
</script>

<span class="inline-flex items-center {color} {size}">
  <span class="dot-1">.</span>
  <span class="dot-2">.</span>
  <span class="dot-3">.</span>
</span>

<style>
  @keyframes bounce {
    0%, 80%, 100% { 
      transform: translateY(0);
    }
    40% { 
      transform: translateY(-0.3em);
    }
  }
  
  .dot-1, .dot-2, .dot-3 {
    display: inline-block;
    animation: bounce 1.4s infinite ease-in-out both;
  }
  
  .dot-1 {
    animation-delay: -0.32s;
  }
  
  .dot-2 {
    animation-delay: -0.16s;
  }
  
  .dot-3 {
    animation-delay: 0s;
  }
</style> 