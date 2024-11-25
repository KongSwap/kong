<script lang="ts">
    import QRCode from 'qrcode';
    import { onMount } from 'svelte';
    import { auth } from "$lib/services/auth";
    import { canisterId as kongBackendId, idlFactory as kongBackendIDL } from "../../../../../declarations/kong_backend";
    import type { UserIdentity } from '$lib/types/identity';

    export let token: FE.Token;

    let loading = true;
    let error: string | null = null;
    let activeId: 'principal' | 'account' = 'principal';

    let identity: UserIdentity = {
        principalId: '',
        accountId: '',
        principalQR: '',
        accountQR: ''
    };

    let copied = false;

    async function generateQR(text: string): Promise<string> {
        try {
            return await QRCode.toDataURL(text, {
                width: 300,
                margin: 1,
                color: {
                    dark: '#ffffff',
                    light: '#00000000'
                }
            });
        } catch (err) {
            console.error('QR generation failed:', err);
            throw new Error('Failed to generate QR code');
        }
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
            setTimeout(() => {
                copied = false;
            }, 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    async function loadIdentityData() {
        try {
            const actor = await auth.getActor(kongBackendId, kongBackendIDL, { anon: false });
            const res = await actor.get_user();
            
            if (!res.Ok) throw new Error('Failed to fetch user data');

            const [principalQR, accountQR] = await Promise.all([
                generateQR(res.Ok.principal_id),
                generateQR(res.Ok.account_id)
            ]);

            identity = {
                principalId: res.Ok.principal_id,
                accountId: res.Ok.account_id,
                principalQR,
                accountQR
            };
        } catch (err) {
            error = 'Failed to load identity data';
            console.error(err);
        } finally {
            loading = false;
        }
    }

    onMount(loadIdentityData);

    $: currentId = activeId === 'principal' ? identity.principalId : identity.accountId;
    $: currentQR = activeId === 'principal' ? identity.principalQR : identity.accountQR;
</script>

<div class="receive-container">
    {#if loading}
        <div class="loading-state">Loading identity data...</div>
    {:else if error}
        <div class="error-state">
            {error}
            <button 
                class="clean-button"
                on:click={loadIdentityData}
            >
                Retry
            </button>
        </div>
    {:else}
        <div class="tabs">
            <button 
                class="tab-button"
                class:active={activeId === 'principal'}
                on:click={() => activeId = 'principal'}
            >
                Principal ID
            </button>
            <button 
                class="tab-button"
                class:active={activeId === 'account'}
                on:click={() => activeId = 'account'}
            >
                Account ID
            </button>
        </div>

        <div class="qr-section">
            <div 
                class="qr-container" 
                on:click={() => {
                    const win = window.open();
                    if (win) {
                        win.document.write(`
                            <style>
                                body { 
                                    margin: 0; 
                                    display: flex; 
                                    justify-content: center; 
                                    align-items: center; 
                                    background: #000; 
                                    min-height: 100vh; 
                                }
                                img { max-width: 100%; padding: 1rem; }
                            </style>
                            <img src="${currentQR}" alt="${activeId} QR Code">
                        `);
                    }
                }}
            >
                <div class="qr-wrapper">
                    <img src={currentQR} alt={`${activeId} QR Code`} class="qr-code" />
                </div>
                <div class="overlay">
                    <span>Click to enlarge</span>
                </div>
            </div>

            <div 
                class="id-container"
                on:click={() => copyToClipboard(currentId)}
            >
                <span class="id-text">{currentId}</span>
                <div class="overlay" class:visible={copied}>
                    <span>{copied ? 'Copied!' : 'Click to copy'}</span>
                </div>
            </div>
        </div>

        <div class="instructions">
            <h3>How to receive {token.symbol}</h3>
            <ol>
                <li>Choose either Principal ID or Account ID</li>
                <li>Share the QR code or copy the address</li>
                <li>The sender can scan the QR code or paste your address</li>
                <li>Tokens will appear in your wallet once sent</li>
            </ol>
        </div>
    {/if}
</div>

<style lang="postcss">
    .receive-container {
        @apply flex flex-col gap-4;
    }

    .loading-state, .error-state {
        @apply text-center p-4 text-white/70;
    }

    .error-state {
        @apply flex flex-col items-center gap-2;
    }

    .clean-button {
        @apply px-4 py-2 bg-black/20 text-white/90 rounded-lg
               hover:bg-black/30 transition-colors text-sm font-medium
               border border-white/10 hover:border-white/20;
    }

    .tabs {
        @apply flex gap-1 justify-center p-1 rounded-lg;
    }

    .tab-button {
        @apply px-4 py-2 text-sm text-white/50 rounded-md
               transition-colors hover:text-white;
    }

    .tab-button.active {
        @apply bg-black/20 text-white;
    }

    .qr-section {
        @apply flex flex-col items-center gap-4 w-full;
    }

    .qr-container {
        @apply relative cursor-pointer w-full max-w-[300px]
               transition-transform duration-200 hover:scale-[1.02]
               flex justify-center items-center;
    }

    .qr-wrapper {
        @apply flex justify-center items-center bg-black/20 rounded-lg p-2;
    }

    .qr-code {
        @apply w-48 h-48 md:w-64 md:h-64;
    }

    .id-container {
        @apply relative cursor-pointer w-full max-w-md;
    }

    .id-text {
        @apply block font-mono text-xs md:text-sm text-white/80 
               bg-black/20 rounded-lg p-3 break-all;
    }

    .overlay {
        @apply absolute inset-0 flex items-center justify-center
               bg-black/85 opacity-0 transition-opacity duration-200
               rounded-lg;
    }

    .overlay.visible {
        @apply opacity-100;
    }

    .overlay span {
        @apply text-white text-sm;
    }

    .qr-container:hover .overlay,
    .id-container:hover .overlay:not(.visible) {
        @apply opacity-100;
    }

    .instructions {
        @apply mt-2 p-4 bg-black/20 rounded-lg;
    }

    .instructions h3 {
        @apply text-sm font-semibold text-yellow-500 mb-2;
    }

    .instructions ol {
        @apply list-decimal list-inside space-y-1;
    }

    .instructions li {
        @apply text-sm text-white/60;
    }

    @media (max-width: 640px) {
        .receive-container {
            @apply gap-6 px-4;
        }

        .tab-button {
            @apply px-6 py-3 text-base;
        }

        .qr-container {
            @apply max-w-full;
        }

        .qr-code {
            @apply w-72 h-72;
        }

        .id-text {
            @apply text-base p-4;
        }

        .overlay span {
            @apply text-base;
        }

        .instructions {
            @apply p-5;
        }

        .instructions h3 {
            @apply text-base mb-3;
        }

        .instructions li {
            @apply text-base leading-relaxed;
        }
    }
</style>
