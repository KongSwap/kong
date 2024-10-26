<script lang="ts">
    import {
        walletStore,
        connectWallet,
        disconnectWallet,
        availableWallets,
        selectedWalletId,
    } from "$lib/stores/walletStore";
    import { t } from "$lib/locales/translations";
    import { onMount } from "svelte";
    import { uint8ArrayToHexString } from "@dfinity/utils";
    import { backendService } from "$lib/services/backendService";

    let user: any;

    onMount(async () => {
        if (typeof window !== "undefined") {
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
        color: #ffcc00;
        font-size: 12px;
        margin-bottom: 8px;
    }

    .wallet-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .info-section {
        background: rgba(26, 71, 49, 0.1);
        padding: 8px;
        border-radius: 4px;
    }

    .section-title {
        color: #ffcc00;
        font-size: 12px;
        margin-bottom: 8px;
        text-transform: uppercase;
    }

    .info-text {
        color: #aaaaaa;
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
        background: rgba(26, 71, 49, 0.1);
        border: 1px solid rgba(255, 204, 0, 0.3);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
    }

    .wallet-button:hover {
        background: rgba(255, 204, 0, 0.1);
        transform: translateX(3px);
    }

    .wallet-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
    }

    .wallet-name {
        color: #ffcc00;
        font-size: 12px;
    }

    .disconnect-button {
        background: rgba(255, 0, 0, 0.2);
        border: 1px solid rgba(255, 0, 0, 0.3);
        color: #ff3333;
        padding: 8px;
        border-radius: 4px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .disconnect-button:hover {
        background: rgba(255, 0, 0, 0.3);
    }

    .error-text {
        color: #ff3333;
        font-size: 10px;
        margin-top: 8px;
    }
</style>
