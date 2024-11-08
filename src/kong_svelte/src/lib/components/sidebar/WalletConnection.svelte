<script lang="ts">
  import {
    walletStore,
    connectWallet,
    disconnectWallet,
    availableWallets,
    selectedWalletId,
  } from "$lib/services/wallet/walletStore";
  import { t } from "$lib/translations/translationstions";
  import { onMount } from "svelte";
  import { uint8ArrayToHexString } from "@dfinity/utils";
  import { WalletService } from "$lib/services/wallet/WalletService";

  let user: any;

  // Initialize selectedWalletId from localStorage inside onMount
  onMount(async () => {
    if (typeof window !== "undefined") {
      const storedWalletId = localStorage.getItem("selectedWalletId");
      if (storedWalletId) {
        selectedWalletId.set(storedWalletId);
      }
    }
  });

  // Check if wallet is already connected
  $: if ($walletStore.account) {
    loadUser();
  }

  async function loadUser() {
    try {
      user = await WalletService.getWhoami();
    } catch (error) {
      console.error("Error loading user data:", error);
    }
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
    <p>{$t("common.connecting")}</p>
  {:else if $walletStore.account}
    <div class="my-4">
      <h2 class="text-lg font-black uppercase">From Wallet Library</h2>
      {$t("common.connectedTo")}: {$walletStore.account.owner.toString()}
      <br />
      {$t("common.subaccount")}: {uint8ArrayToHexString(
        $walletStore.account.subaccount,
      )}
    </div>
    <div class="mb-4">
      <h2 class="text-lg font-black uppercase">From backend</h2>
      {#if user?.Ok}
        <p>Principal ID: {user.Ok.principal_id}</p>
        <p>Account ID: {user.Ok.account_id}</p>
      {:else}
        <p>Loading user data...</p>
      {/if}
    </div>
    <button on:click={handleDisconnect}>
      {$t("common.disconnectWallet")}
    </button>
  {:else}
    <p>{$t("common.notConnected")}</p>
    <div class="wallet-list">
      {#if availableWallets && availableWallets.length > 0}
        {#each availableWallets as wallet}
          <div class="flex flex-col w-56">
            <button
              on:click={() => handleConnect(wallet.id)}
              class="flex items-center gap-x-2 p-2 bg-green-500 rounded-md mb-2"
            >
              <img
                src={wallet.icon}
                alt={wallet.name}
                class="w-12 h-12 rounded-full"
              />
              {wallet.name}
            </button>
          </div>
        {/each}
      {:else}
        <p>{$t("common.noWalletsAvailable")}</p>
      {/if}
    </div>
  {/if}

  {#if $walletStore.error}
    <p class="text-red-500">
      {$t("common.error")}: {$walletStore.error.message}
    </p>
  {/if}
</div>
