<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { createEventDispatcher } from 'svelte';
    import {
        walletStore,
        connectWallet,
        disconnectWallet,
        availableWallets,
        selectedWalletId,
    } from "$lib/stores/walletStore";
    import { t } from "$lib/locales/translations";
    import { uint8ArrayToHexString } from "@dfinity/utils";
    import { backendService } from "$lib/services/backendService";

    const dispatch = createEventDispatcher();

    let user: any;
    let selectedIndex = 0;

    onMount(async () => {
        if (browser) {
            const storedWalletId = localStorage.getItem("selectedWalletId");
            if (storedWalletId) {
                selectedWalletId.set(storedWalletId);
            }
        }
    });

    $: if ($walletStore.account) {
        (async () => {
            user = await backendService.getWhoami();
        })();
    }

    async function handleConnect(walletId: string) {
        if (!walletId) {
            return console.error("No wallet selected");
        }

        try {
            selectedWalletId.set(walletId);
            localStorage.setItem("selectedWalletId", walletId);
            await connectWallet(walletId);
            dispatch('login');
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    }

    async function handleDisconnect() {
        try {
            await disconnectWallet();
            selectedWalletId.set("");
            localStorage.removeItem("selectedWalletId");
        } catch (error) {
            console.error("Failed to disconnect wallet:", error);
        }
    }
</script>

<div class="wallet-section">
    {#if $walletStore.isConnecting}
        <p class="status-text">{$t("common.connecting")}</p>
    {:else if $walletStore.account}
        <div class="wallet-info">
            <div class="info-section">
                <h2 class="section-title">From Wallet Library</h2>
                <p class="info-text">
                    {$t("common.connectedTo")}: {$walletStore.account.owner.toString()}
                </p>
                <p class="info-text">
                    {$t("common.subaccount")}: {uint8ArrayToHexString($walletStore.account.subaccount)}
                </p>
            </div>
            
            <div class="info-section">
                <h2 class="section-title">From backend</h2>
                {#if user?.Ok}
                    <p class="info-text">Principal ID: {user.Ok.principal_id}</p>
                    <p class="info-text">Account ID: {user.Ok.account_id}</p>
                {:else}
                    <p class="info-text">Loading user data...</p>
                {/if}
            </div>
            
            <button class="disconnect-button" on:click={handleDisconnect}>
                {$t("common.disconnectWallet")}
            </button>
        </div>
    {:else}
        <p class="status-text">{$t("common.notConnected")}</p>
        <div class="wallet-list">
            {#if availableWallets && availableWallets.length > 0}
                {#each availableWallets as wallet}
                    <button 
                        class="wallet-button"
                        on:click={() => handleConnect(wallet.id)}
                    >
                        <img
                            src={wallet.icon}
                            alt={wallet.name}
                            class="wallet-icon"
                        />
                        <span class="wallet-name">{wallet.name}</span>
                    </button>
                {/each}
            {:else}
                <p class="status-text">{$t("common.noWalletsAvailable")}</p>
            {/if}
        </div>
    {/if}

    {#if $walletStore.error}
        <p class="error-text">
            {$t("common.error")}: {$walletStore.error.message}
        </p>
    {/if}
</div>

<style>
    .wallet-section {
        padding: 8px;
        font-family: 'Press Start 2P', monospace;
    }

    .status-text {
        color: var(--sidebar-border);
        font-size: 12px;
        margin-bottom: 8px;
    }

    .wallet-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .info-section {
        background: var(--sidebar-border-dark);
        padding: 8px;
        border: 2px solid var(--sidebar-border);
        position: relative;
    }

    .info-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%);
        pointer-events: none;
    }

    .section-title {
        color: var(--sidebar-bg);
        font-size: 12px;
        margin-bottom: 8px;
        text-transform: uppercase;
    }

    .info-text {
        color: var(--sidebar-bg);
        font-size: 10px;
        line-height: 1.4;
    }

    .wallet-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .wallet-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--sidebar-wallet-button-bg);
        border: 2px solid var(--sidebar-wallet-button-border);
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
        position: relative;
        overflow: hidden;
    }

    .wallet-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .wallet-button:hover {
        background: var(--sidebar-wallet-button-bg);
        transform: scale(0.98);
    }

    .wallet-icon {
        width: 56px;
        height: 56px;
        border-radius: 4px;
    }

    .wallet-name {
        @apply pl-4;
        color: var(--sidebar-wallet-button-text);
        font-size: 12px;
    }

    .disconnect-button {
        background: var(--sidebar-border-dark);
        border: 2px solid var(--sidebar-border);
        color: var(--sidebar-bg);
        padding: 8px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
    }

    .disconnect-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%);
        pointer-events: none;
    }

    .disconnect-button:hover {
        background: var(--sidebar-border);
        transform: scale(0.98);
    }

    .error-text {
        color: #ff3333;
        font-size: 10px;
        margin-top: 8px;
        text-shadow: 1px 1px 0px rgba(0,0,0,0.5);
    }
</style>
