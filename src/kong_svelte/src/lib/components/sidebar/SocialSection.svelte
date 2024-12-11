<script lang="ts">
    import { scale } from 'svelte/transition';
    import { backOut } from 'svelte/easing';
    
    // Import images
    import xLogo from '$lib/assets/icons/x_logo.jpg';
    import telegramLogo from '$lib/assets/icons/telegram_logo.webp';
    import openchatLogo from '$lib/assets/icons/openchat.svg';

    const socialLinks = [
        { 
            id: 'twitter',
            text: '𝕏', 
            url: 'https://x.com/kongswap',
            icon: xLogo
        },
        {
            id: 'telegram',
            text: 'TG',
            url: 'https://t.me/kong_swap',
            icon: telegramLogo
        },
        {
            id: 'openchat', 
            text: 'OC',
            url: 'https://oc.app/community/maceh-niaaa-aaaaf-bm37q-cai/channel/143833652212619352659918759629305427896',
            icon: openchatLogo
        }
    ];

    function handleSocialClick(url: string) {
        window.open(url, '_blank');
    }
</script>

<footer>
    <div 
        class="social-links"
        in:scale={{
            duration: 400,
            delay: 500,
            easing: backOut,
            start: 0.3
        }}
    >
        {#each socialLinks as social}
            <button 
                class="social-button"
                on:click={() => handleSocialClick(social.url)}
                aria-label={`Visit our ${social.id} page`}
            >
                <img src={social.icon} alt={social.text} width="32" height="32" />
            </button>
        {/each}
    </div>
</footer>

<style>
    .social-links {
        display: flex;
        gap: 12px;
        justify-content: center;
        align-items: center;
    }

    .social-button {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 8px;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        width: 48px;
        height: 48px;
        flex-shrink: 0;
    }

    .social-button:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .social-button:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.2);
        outline-offset: 2px;
    }

    .social-button img {
        filter: brightness(0.9);
        transition: filter 0.2s ease;
    }

    .social-button:hover img {
        filter: brightness(1);
    }

    @media (max-width: 768px) {
        .social-button {
            width: 44px;
            height: 44px;
        }
    }
</style>
