<script lang="ts">
    import { scale } from 'svelte/transition';
    import { backOut } from 'svelte/easing';

    // Social media links configuration
    const socialLinks = [
        { 
            id: 'twitter',
            text: '𝕏', 
            url: 'https://x.com'
        },
        {
            id: 'telegram',
            text: 'TG',
            url: 'https://telegram.org'
        },
        {
            id: 'openchat', 
            text: 'OC',
            url: 'https://openchat.com'
        }
    ];

    // Open social link in new tab
    function handleSocialClick(url: string) {
        window.open(url, '_blank');
    }
</script>

<div 
    class="social-section"
    in:scale={{
        duration: 400,
        delay: 500,
        easing: backOut,
        start: 0.3
    }}
>
    <!-- Decorative pixel divider -->
    <div class="pixel-divider"></div>

    <div class="social-container">
        <!-- Section header -->
        <div class="social-text">
            <span class="blink">►</span> 
            FOLLOW THE KONG QUEST
        </div>

        <!-- Social media buttons -->
        <div class="social-buttons">
            {#each socialLinks as social}
                <button 
                    class="social-btn {social.id}"
                    on:click={() => handleSocialClick(social.url)}
                >
                    <div class="pixel-border-left"></div>
                    <span class="btn-text">
                        {social.text}
                    </span>
                    <div class="btn-shine"></div>
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    /* Main section container */
    .social-section {
        margin-top: 24px;
        padding: 16px 8px;
        border-top: 2px solid var(--sidebar-border);
        position: relative;
        background: var(--sidebar-bg);
    }

    /* Decorative pixel pattern divider */
    .pixel-divider {
        height: 2px;
        background: repeating-linear-gradient(
            to right,
            var(--sidebar-border) 0px,
            var(--sidebar-border) 4px,
            transparent 4px,
            transparent 8px
        );
        margin-bottom: 16px;
        opacity: 0.3;
    }

    /* Content layout */
    .social-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    /* Section header text */
    .social-text {
        color: var(--sidebar-border);
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        text-align: center;
        text-shadow: 1px 1px 0px var(--shadow-color);
        opacity: 0.8;
    }

    /* Blinking cursor animation */
    .blink {
        animation: blink 1s steps(2) infinite;
        color: var(--sidebar-border-dark);
    }

    /* Social buttons container */
    .social-buttons {
        display: flex;
        justify-content: center;
        gap: 12px;
    }

    /* Individual social button styling */
    .social-btn {
        position: relative;
        width: 40px;
        height: 40px;
        background: var(--sidebar-bg);
        border: 2px solid var(--sidebar-border);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        overflow: hidden;
        box-shadow: -2px 2px 8px var(--shadow-color);
    }

    /* Hover effects */
    .social-btn:hover {
        transform: translateY(-2px) scale(1.05);
        border-color: var(--sidebar-border-dark);
    }

    .social-btn:active {
        transform: translateY(0) scale(0.95);
    }

    /* Decorative pixel border */
    .pixel-border-left {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--border-width);
        height: 100%;
        background: var(--sidebar-border);
        clip-path: polygon(
            0 0,
            100% 4px,
            100% calc(100% - 4px),
            0 100%,
            0 calc(100% - 8px),
            50% calc(100% - 12px),
            50% 12px,
            0 8px
        );
    }

    /* Button text styling */
    .btn-text {
        position: relative;
        z-index: 1;
        color: var(--sidebar-border);
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        text-shadow: 1px 1px 0px var(--shadow-color);
    }

    /* Shine effect overlay */
    .btn-shine {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%);
        pointer-events: none;
        opacity: 0.5;
        transition: opacity 0.3s ease;
    }

    .social-btn:hover .btn-shine {
        opacity: 0.8;
    }

    /* Blinking animation */
    @keyframes blink {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .social-section {
            margin-top: 16px;
            padding: 12px 4px;
        }

        .social-text {
            font-size: 8px;
        }

        .social-btn {
            width: 36px;
            height: 36px;
        }

        .btn-text {
            font-size: 10px;
        }
    }
</style>
