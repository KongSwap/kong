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
  
  @keyframes float-up {
    0% { transform: translateY(20px); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(-50px); opacity: 0; }
  }
  
  @keyframes sparkle {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.8; }
  }
  
  @keyframes coin-spin {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
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
  
  :global(.animate-float-up) {
    animation: float-up 3s ease-out forwards;
  }
  
  :global(.animate-sparkle) {
    animation: sparkle 1s ease-in-out infinite;
  }
  
  :global(.animate-coin-spin) {
    animation: coin-spin 1.5s linear infinite;
  }
</style> 