<script lang="ts">
    import { scale } from 'svelte/transition';
    import { backOut } from 'svelte/easing';

    const socialLinks = [
        { id: 'twitter', text: '𝕏', url: 'https://x.com' },
        { id: 'telegram', text: 'TG', url: 'https://telegram.org' },
        { id: 'openchat', text: 'OC', url: 'https://openchat.com' }
    ];

    function handleSocialClick(url: string) {
        window.open(url, '_blank');
    }
</script>

<div class="social-section"
    in:scale={{
        duration: 400,
        delay: 500,
        easing: backOut,
        start: 0.3
    }}
>
    <div class="pixel-divider"></div>
    <div class="social-container">
        <div class="social-text">
            <span class="blink">►</span> FOLLOW THE KONG QUEST
        </div>
        <div class="social-buttons">
            {#each socialLinks as social}
                <button 
                    class="social-btn {social.id}"
                    on:click={() => handleSocialClick(social.url)}
                >
                    <div class="btn-frame"></div>
                    <span class="btn-text">{social.text}</span>
                    <div class="btn-highlight"></div>
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    .social-section {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 2px solid rgba(255, 204, 0, 0.3);
    }

    .pixel-divider {
        height: 4px;
        background: repeating-linear-gradient(
            to right,
            #ffcc00 0px,
            #ffcc00 4px,
            transparent 4px,
            transparent 8px
        );
        margin-bottom: 24px;
        opacity: 0.5;
    }

    .social-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .social-text {
        color: #ffcc00;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        text-align: center;
        text-shadow: 2px 2px 0 #000;
    }

    .blink {
        animation: blink 1s steps(2) infinite;
    }

    .social-buttons {
        display: flex;
        justify-content: center;
        gap: 16px;
    }

    .social-btn {
        position: relative;
        width: 48px;
        height: 48px;
        background: none;
        border: 2px solid #ffcc00;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    .social-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(255, 204, 0, 0.3);
    }

    .btn-frame {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 1px solid rgba(255, 204, 0, 0.3);
        pointer-events: none;
    }

    .btn-text {
        position: relative;
        z-index: 1;
        color: #ffcc00;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
    }

    .btn-highlight {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(255, 204, 0, 0.1), transparent);
        pointer-events: none;
    }

    .social-btn:hover .btn-highlight {
        animation: highlightPulse 1s ease-in-out infinite alternate;
    }

    @keyframes blink {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    @keyframes highlightPulse {
        from { opacity: 0.5; }
        to { opacity: 1; }
    }

    @media (max-width: 768px) {
        .social-section {
            margin-top: 24px;
            padding-top: 16px;
        }

        .social-text {
            font-size: 10px;
        }

        .social-btn {
            width: 40px;
            height: 40px;
        }

        .btn-text {
            font-size: 12px;
        }
    }
</style>
