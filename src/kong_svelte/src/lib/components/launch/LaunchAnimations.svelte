<style>
  /* DEGEN ANIMATIONS */
  @keyframes pulse-fast {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.9; }
  }
  
  @keyframes slide-in-right {
    0% { transform: translateX(100%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slide-in {
    0% { transform: translateX(20px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  
  :global(.animate-pulse-fast) {
    animation: pulse-fast 0.8s ease-in-out infinite;
  }
  
  :global(.animate-pulse-subtle) {
    animation: pulse-subtle 1.5s ease-in-out infinite;
  }
  
  :global(.animate-slide-in-right) {
    animation: slide-in-right 0.3s ease-out forwards;
  }
  
  :global(.animate-slide-in) {
    animation: slide-in 0.3s ease-out forwards;
  }
</style> 