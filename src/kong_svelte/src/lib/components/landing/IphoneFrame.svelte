<script lang="ts">
    // Define the props using $props for Svelte 5
    let {
        screenshotSrc = '/images/swapscreen.png', // Default screenshot
        gradientOverlay = 'from-purple-500/10 to-indigo-500/10', // Default gradient
        deviceWidthClasses = 'w-[240px] xs:w-[280px] sm:w-[310px] md:w-[360px]',
        deviceHeightClasses = 'h-[490px] xs:h-[560px] sm:h-[620px] md:h-[700px]',
        reflectionColor = 'from-purple-500/20'
    } = $props<{
        screenshotSrc?: string;
        gradientOverlay?: string;
        deviceWidthClasses?: string;
        deviceHeightClasses?: string;
        reflectionColor?: string;
    }>();
</script>

<div class="relative {deviceWidthClasses} transition-all duration-300 hover:scale-[1.02]">
    <!-- iPhone frame with improved realism -->
    <div class="relative w-full {deviceHeightClasses} bg-gradient-to-b from-gray-700 to-gray-900 rounded-[35px] md:rounded-[40px] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px] border-gray-800">
        <!-- Volume buttons -->
        <div class="absolute -left-[2px] top-[80px] md:top-[100px] w-[2px] h-8 md:h-12 bg-gray-900 rounded-l-lg shadow-inner"></div>
        <div class="absolute -left-[2px] top-[120px] md:top-[150px] w-[2px] h-10 md:h-16 bg-gray-900 rounded-l-lg shadow-inner"></div>
        
        <!-- Power button -->
        <div class="absolute -right-[2px] top-[100px] md:top-[120px] w-[2px] h-10 md:h-14 bg-gray-900 rounded-r-lg shadow-inner"></div>
        
        <!-- Subtle inner shadow on frame -->
        <div class="absolute inset-3 rounded-[28px] md:rounded-[32px] shadow-inner opacity-30"></div>
        
        <!-- Notch with more detail -->
        <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-5 md:h-7 bg-gray-900 rounded-b-2xl overflow-hidden flex justify-center">
            <div class="w-1.5 md:w-2 h-1.5 md:h-2 bg-gray-700 rounded-full my-1 mx-0.5 md:mx-1"></div>
            <div class="w-4 md:w-6 h-1.5 md:h-2 bg-gray-700 rounded-full my-1 mx-0.5 md:mx-1"></div>
            <div class="w-1.5 md:w-2 h-1.5 md:h-2 bg-gray-700 rounded-full my-1 mx-0.5 md:mx-1"></div>
        </div>
        
        <!-- Screenshot with subtle animation -->
        <div class="h-full w-full rounded-[28px] md:rounded-[32px] overflow-hidden relative">
            <div class="absolute inset-0 bg-gradient-to-b {gradientOverlay} z-10 pointer-events-none animate-pulse"></div>
            <img src={screenshotSrc} alt="App Screenshot" class="w-full h-full object-cover relative z-0" loading="lazy" />
        </div>
        
        <!-- Home indicator with subtle animation -->
        <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-16 md:w-28 h-1 bg-gray-300 rounded-full animate-pulse"></div>
    </div>
    
    <!-- Device reflection -->
    <div class="absolute bottom-[-15px] md:bottom-[-20px] left-[10%] right-[10%] h-[15px] md:h-[20px] bg-gradient-to-b {reflectionColor} to-transparent blur-sm rounded-[50%]"></div>
</div> 