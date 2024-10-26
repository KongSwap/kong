<script lang="ts">
    import { scale } from 'svelte/transition';
    import { backOut } from 'svelte/easing';

    export let activeView: string;
    export let isLoggedIn: boolean;
    export let onClose: () => void;
</script>

<div class="sidebar-header"
    in:scale={{
        duration: 400,
        delay: 300,
        easing: backOut,
        start: 0.3
    }}
>
    <div class="header-content">
        <div class="pixel-corner top-left"></div>
        <div class="pixel-corner top-right"></div>
        <div class="pixel-corner bottom-left"></div>
        <div class="pixel-corner bottom-right"></div>

        {#if activeView === 'main'}
            <h2>{isLoggedIn ? 'YOUR TOKENS' : 'SELECT WALLET'}</h2>
        {:else if activeView === 'send'}
            <h2>SEND TOKENS</h2>
        {:else if activeView === 'receive'}
            <h2>RECEIVE TOKENS</h2>
        {:else if activeView === 'history'}
            <h2>HISTORY</h2>
        {/if}
    </div>

    <button 
        class="close-button" 
        on:click={onClose}
        aria-label="Close sidebar"
    >
        <span class="close-icon">✕</span>
    </button>
</div>

<style lang="scss">
    :root {
        --header-bg: #000000;
        --header-border: #FFCC00;
        --header-text: #FFCC00;
        --header-glow: rgba(255, 204, 0, 0.2);
        --header-hover: #FF4444;
        --header-shadow: #000000;
    }

    .sidebar-header {
        position: relative;
        margin-bottom: 1.5rem;
        background: var(--header-bg);
    }

    .header-content {
        position: relative;
        background: var(--header-bg);
        padding: 1rem 0.5rem;
        border: 2px solid var(--header-border);
        display: flex;
        justify-content: center;
        align-items: center;
        
        &::before {
            content: '';
            position: absolute;
            top: -1px;
            left: -1px;
            right: -1px;
            bottom: -1px;
            background: linear-gradient(
                45deg,
                var(--header-border) 0%,
                transparent 40%,
                transparent 60%,
                var(--header-border) 100%
            );
            opacity: 0.3;
            pointer-events: none;
        }
    }

    .pixel-corner {
        position: absolute;
        width: 8px;
        height: 8px;
        background: var(--header-border);
        
        &.top-left {
            top: -2px;
            left: -2px;
        }
        
        &.top-right {
            top: -2px;
            right: -2px;
        }
        
        &.bottom-left {
            bottom: -2px;
            left: -2px;
        }
        
        &.bottom-right {
            bottom: -2px;
            right: -2px;
        }
    }

    h2 {
        color: var(--header-text);
        font-family: 'Press Start 2P', monospace;
        font-size: 0.875rem;
        text-align: center;
        letter-spacing: 0.1em;
        margin: 0;
        padding: 0 2.5rem;
        text-shadow: 
            2px 2px 0 var(--header-shadow),
            -2px -2px 0 var(--header-shadow),
            2px -2px 0 var(--header-shadow),
            -2px 2px 0 var(--header-shadow);
        position: relative;
        
        &::before,
        &::after {
            content: '◆';
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.75rem;
            color: var(--header-text);
        }

        &::before {
            left: 1rem;
        }

        &::after {
            right: 1rem;
        }
    }

    .close-button {
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--header-bg);
        border: 2px solid var(--header-border);
        color: var(--header-text);
        font-size: 1.25rem;
        cursor: pointer;
        z-index: 10;
        transition: all 0.2s ease;

        &:hover {
            background: var(--header-border);
            color: var(--header-bg);
            transform: translateY(-50%) scale(0.95);
            
            &::before {
                opacity: 1;
            }
        }

        &:active {
            transform: translateY(-50%) scale(0.9);
        }

        &::before {
            content: '';
            position: absolute;
            inset: -2px;
            background: var(--header-border);
            opacity: 0;
            transition: opacity 0.2s ease;
            z-index: -1;
        }

        .close-icon {
            transform: translateY(-1px);
            display: block;
            line-height: 1;
        }
    }

    @media (max-width: 768px) {
        .header-content {
            padding: 0.75rem 0.5rem;
        }

        h2 {
            font-size: 0.75rem;
            padding: 0 2rem;
        }

        .close-button {
            width: 1.75rem;
            height: 1.75rem;
            font-size: 1rem;
        }
    }
</style>
