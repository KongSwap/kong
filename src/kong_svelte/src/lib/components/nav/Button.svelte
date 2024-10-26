<script lang="ts">
    import { onMount } from 'svelte';
    
    export let text: string;
    export let active: boolean = false;
    export let onClick: () => void = () => {};
    export let variant: 'primary' | 'secondary' = 'primary';
    export let size: 'small' | 'medium' | 'large' = 'medium';
    export let loading: boolean = false;
    export let icon: string = ''; // New prop for icon

    let buttonEl: HTMLButtonElement;
    let charged = false;
    let chargeLevel = 0;
    let audioContext: AudioContext;
    
    onMount(() => {
        audioContext = new AudioContext();
    });

    function playSelectSound() {
        if (!audioContext) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    function handleClick() {
        playSelectSound();
        createPixelExplosion();
        onClick();
    }

    function createPixelExplosion() {
        const particles = 20;
        const container = document.createElement('div');
        container.className = 'particle-container';
        
        for (let i = 0; i < particles; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const angle = (Math.PI * 2 * i) / particles;
            const velocity = 2 + Math.random() * 2;
            
            particle.style.setProperty('--angle', `${angle}rad`);
            particle.style.setProperty('--velocity', `${velocity}`);
            container.appendChild(particle);
        }
        
        document.body.appendChild(container);
        const rect = buttonEl.getBoundingClientRect();
        container.style.left = `${rect.left + rect.width / 2}px`;
        container.style.top = `${rect.top + rect.height / 2}px`;
        setTimeout(() => container.remove(), 1000);
    }

    $: sizeClass = {
        small: 'button-small',
        medium: 'button-medium',
        large: 'button-large'
    }[size];

    $: variantClass = {
        primary: 'button-primary',
        secondary: 'button-secondary'
    }[variant];
</script>

<button
    bind:this={buttonEl}
    class:active={active}
    class:charged={charged}
    class:loading={loading}
    class={`${sizeClass} ${variantClass}`}
    on:click={handleClick}
    on:mouseenter={() => charged = true}
    on:mouseleave={() => charged = false}
    on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
    <div class="scanlines"></div>
    <div class="pixel-corners">
        <div class="corner-decorations">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
        </div>
        <div class="inner-button">
            {#if loading}
                <div class="loading-indicator">
                    <div class="loading-bar"></div>
                </div>
            {:else}
                {#if icon}
                    <img src={icon} alt="icon" class="button-icon" />
                {/if}
                <span class="text">{text}</span>
            {/if}
            <div class="charge-meter" style="--charge-level: {chargeLevel}%"></div>
        </div>
    </div>
    <div class="crt-effect"></div>
</button>

<style>
    :root {
        --button-primary: #8B4513;
        --button-highlight: #D2691E;
        --button-shadow: #3D1F09;
        --button-border: #000000;
        --button-banana: #FFD700;
        --button-glow: rgba(255, 215, 0, 0.5);
        --scanline-color: rgba(0, 0, 0, 0.1);
    }

    button {
        position: relative;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        opacity: 0.9;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        filter: drop-shadow(0 0 4px rgba(139, 69, 19, 0.4));
        transform-origin: center;
        overflow: hidden;
    }

    .button-medium {
        min-width: 160px;
    }

    .button-small {
        min-width: 120px;
        font-size: 14px;
    }

    .button-large {
        min-width: 200px;
        font-size: 18px;
    }

    .pixel-corners {
        position: relative;
        padding: 3px;
        background-color: var(--button-border);
        clip-path: polygon(
            6px 0,
            calc(100% - 6px) 0,
            100% 6px,
            100% calc(100% - 6px),
            calc(100% - 6px) 100%,
            6px 100%,
            0 calc(100% - 6px),
            0 6px
        );
    }

    .corner-decorations {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .corner {
        position: absolute;
        width: 8px;
        height: 8px;
        background-color: var(--button-banana);
    }

    .top-left {
        top: 0;
        left: 0;
        clip-path: polygon(0 0, 100% 0, 0 100%);
    }

    .top-right {
        top: 0;
        right: 0;
        clip-path: polygon(0 0, 100% 0, 100% 100%);
    }

    .bottom-left {
        bottom: 0;
        left: 0;
        clip-path: polygon(0 0, 100% 100%, 0 100%);
    }

    .bottom-right {
        bottom: 0;
        right: 0;
        clip-path: polygon(100% 0, 100% 100%, 0 100%);
    }

    .inner-button {
        background: linear-gradient(
            165deg,
            var(--button-highlight) 0%,
            var(--button-primary) 60%,
            var(--button-shadow) 100%
        );
        padding: 14px 36px;
        position: relative;
        box-shadow: 
            inset 0 2px 0 rgba(255, 215, 0, 0.3),
            inset -2px -2px 0 rgba(0, 0, 0, 0.3);
        overflow: hidden;
    }

    .text {
        position: relative;
        color: var(--button-banana);
        font-family: 'Press Start 2P', monospace;
        font-size: 16px;
        text-transform: uppercase;
        display: block;
        text-align: center;
        text-shadow: 
            3px 3px 0 rgba(0, 0, 0, 0.8),
            0 0 15px rgba(255, 215, 0, 0.4);
        letter-spacing: 2px;
        transform: skew(-2deg);
        transition: all 0.3s;
    }

    .scanlines {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
            0deg,
            var(--scanline-color) 0px,
            var(--scanline-color) 1px,
            transparent 1px,
            transparent 2px
        );
        pointer-events: none;
        z-index: 2;
    }

    .crt-effect::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.05) 50%,
            rgba(0, 0, 0, 0.05) 50%,
            rgba(0, 0, 0, 0.1) 100%
        );
        pointer-events: none;
        z-index: 1;
    }

    .charge-meter {
        position: absolute;
        bottom: 0;
        left: 0;
        width: var(--charge-level);
        height: 2px;
        background: var(--button-banana);
        transition: width 0.3s ease-out;
    }

    .loading-indicator {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    .loading-bar {
        width: 80%;
        height: 4px;
        background: rgba(255, 215, 0, 0.2);
        position: relative;
        overflow: hidden;
    }

    .loading-bar::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 30%;
        height: 100%;
        background: var(--button-banana);
        animation: loading 1s infinite linear;
    }

    .particle-container {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -50%); /* Center the explosion */
    }

    .particle {
        position: absolute;
        width: 4px;
        height: 4px;
        background: var(--button-banana);
        transform-origin: center;
        animation: particle-explosion 1s ease-out forwards;
    }

    @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
    }

    @keyframes particle-explosion {
        0% {
            transform: translate(0, 0);
            opacity: 1;
        }
        100% {
            transform: translate(
                calc(cos(var(--angle)) * var(--velocity) * 50px),
                calc(sin(var(--angle)) * var(--velocity) * 50px)
            );
            opacity: 0;
        }
    }

    /* RGB Split Effect on Hover */
    button:hover .text {
        text-shadow:
            -3px 0 2px rgba(255, 0, 0, 0.3),
            3px 0 2px rgba(0, 255, 0, 0.3),
            0 0 8px rgba(0, 0, 255, 0.3);
    }

    /* Glitch Effect */
    @keyframes glitch {
        0% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
        100% { transform: translate(0); }
    }

    button:hover .text {
        animation: glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite;
    }

    button:active .inner-button {
        transform: translateY(2px);
        filter: brightness(0.9);
        box-shadow: 
            inset 0 1px 0 rgba(255, 215, 0, 0.2),
            inset -1px -1px 0 rgba(0, 0, 0, 0.4);
    }

    button.active {
        opacity: 1;
        filter: drop-shadow(0 0 12px var(--button-glow));
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% { filter: drop-shadow(0 0 12px var(--button-glow)); }
        50% { filter: drop-shadow(0 0 20px var(--button-glow)); }
        100% { filter: drop-shadow(0 0 12px var(--button-glow)); }
    }

    @media (min-resolution: 2dppx) {
        .text {
            text-shadow: 
                3px 3px 0 rgba(0, 0, 0, 0.8),
                0 0 20px rgba(255, 215, 0, 0.5);
        }
    }

    .button-icon {
        width: 24px;
        height: 24px;
        margin-right: 8px;
        vertical-align: middle;
    }
</style>
