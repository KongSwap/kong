<script>
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import "../app.css";
  
  const errorMessages = {
    404: {
      title: "Page Not Found",
      subtitle: "Lost in the DeFi jungle?",
      description: "The page you're looking for seems to have been swapped away. Let's get you back on track."
    },
    500: {
      title: "Server Error",
      subtitle: "Something went wrong on our end",
      description: "Our servers are having a moment. Please try again in a few seconds."
    },
    503: {
      title: "Service Unavailable",
      subtitle: "Under maintenance",
      description: "We're upgrading our systems to serve you better. Check back soon!"
    },
    default: {
      title: "Unexpected Error",
      subtitle: `Error ${$page.status}`,
      description: "Something unexpected happened. Let's navigate back to safety."
    }
  };
  
  $: errorInfo = errorMessages[$page.status] || errorMessages.default;
</script>

<section class="w-screen h-screen flex items-center justify-center overflow-hidden relative">
  <!-- Background gradient effect -->
  <div class="absolute inset-0 bg-gradient-radial from-kong-primary/10 via-transparent to-transparent opacity-50"></div>
  
  <!-- Animated background shapes -->
  <div class="absolute inset-0 overflow-hidden">
    <div class="absolute -top-40 -right-40 w-80 h-80 bg-kong-primary/5 rounded-full blur-3xl animate-pulse-slow"></div>
    <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-kong-secondary/5 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 1s;"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-kong-info/5 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 2s;"></div>
  </div>
  
  <div class="flex flex-col items-center justify-center min-h-[100vh] text-center px-6 relative z-10">
    <!-- Error code with animated effect -->
    <div class="relative mb-8">
      <div class="text-[120px] md:text-[150px] font-bold text-kong-primary/20 absolute inset-0 blur-xl animate-pulse-slow">
        {$page.status}
      </div>
      <div class="text-8xl md:text-9xl font-bold bg-gradient-to-r from-kong-primary via-kong-info to-kong-secondary bg-clip-text text-transparent relative">
        {$page.status}
      </div>
    </div>
    
    <!-- Error title -->
    <h1 class="text-3xl md:text-5xl font-bold mb-3 text-kong-text-primary">
      {errorInfo.title}
    </h1>
    
    <!-- Error subtitle -->
    <h2 class="text-lg md:text-xl font-medium mb-6 text-kong-text-secondary">
      {errorInfo.subtitle}
    </h2>
    
    <!-- Error description -->
    <p class="mb-10 max-w-lg text-kong-text-secondary/80 leading-relaxed">
      {errorInfo.description}
    </p>
    
    <!-- Action buttons -->
    <div class="flex flex-col sm:flex-row gap-4 items-center">
      <ButtonV2
        label="Go to Swap"
        theme="primary"
        variant="solid"
        size="lg"
        onclick={() => goto("/")}
        animationIterations={3}
      />
      
      <ButtonV2
        label="Back"
        theme="primary"
        variant="outline"
        size="lg"
        onclick={() => goto(-1)}
      />
    </div>
    
    <!-- Additional help text -->
    <div class="mt-12 text-sm text-kong-text-secondary/60">
      Need help? 
      <a 
        href="https://t.me/kong_swap" 
        target="_blank" 
        rel="noopener noreferrer"
        class="text-kong-primary hover:text-kong-primary/80 transition-colors underline underline-offset-2"
      >
        Join our Telegram
      </a>
    </div>
  </div>
</section>

<style>
  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-20px);
    }
  }
</style>