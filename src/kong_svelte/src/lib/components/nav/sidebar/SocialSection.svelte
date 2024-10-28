<script lang="ts">
    import { scale } from 'svelte/transition';
    import { backOut } from 'svelte/easing';

    // Social media links configuration
    // TODO: Add icons for each social media platform
    const socialLinks = [
        { 
            id: 'twitter',
            text: '𝕏', 
            url: 'https://x.com',
            icon: '𝕏'
        },
        {
            id: 'telegram',
            text: 'TG',
            url: 'https://telegram.org',
            icon: 'TG'
        },
        {
            id: 'openchat', 
            text: 'OC',
            url: 'https://openchat.com',
            icon: 'OC'
        }
    ];

    function handleSocialClick(url: string) {
        window.open(url, '_blank');
    }
</script>

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
            class="action-button"
            on:click={() => handleSocialClick(social.url)}
            aria-label={`Visit our ${social.id} page`}
        >
            {@html social.icon}
        </button>
    {/each}
</div>

<style>
    .social-links {
        display: flex;
        gap: 8px;
        justify-content: center;
    }

    .action-button {
        border: 1px solid var(--sidebar-border);
        padding: 6px;
        border-radius: 4px;
        color: white;
        font-family: monospace;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        width: 40px;
        height: 40px;
        flex-shrink: 0;
    }

    .action-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .action-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    @media (max-width: 768px) {
        .action-button {
            width: 36px;
            height: 36px;
        }
    }
</style>
