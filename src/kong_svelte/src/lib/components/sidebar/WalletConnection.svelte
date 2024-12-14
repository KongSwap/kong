<script lang="ts">
  import {
    auth,
    selectedWalletId
  } from "$lib/services/auth";
  import { walletsList as availableWallets } from "@windoge98/plug-n-play";
  import { onMount } from "svelte";
  import { uint8ArrayToHexString } from "@dfinity/utils";
  import { WalletService } from "$lib/services/wallet/WalletService";

  let user: any;

  // Initialize selectedWalletId from localStorage inside onMount
  onMount(async () => {
    if (typeof window !== "undefined") {
      const storedWalletId = localStorage.getItem("kongSelectedWallet");
      if (storedWalletId) {
        selectedWalletId.set(storedWalletId);
      }
    }
  });

  // Check if wallet is already connected
  $: if ($auth.isConnected) {
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
      localStorage.setItem("kongSelectedWallet", walletId);
      await auth.connect(walletId);
    } catch (error) {
      localStorage.removeItem("kongSelectedWallet");
      console.error("Failed to connect wallet:", error);
    }
  }

  async function handleDisconnect() {
    try {
      await auth.disconnect();
      selectedWalletId.set("");
      localStorage.removeItem("kongSelectedWallet");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }
</script>

<div class="wallet-section">
  {#if $auth.isConnected}
    <div class="my-4">
      <h2 class="text-lg font-black uppercase">From Wallet Library</h2>
      Principal: {$auth?.account?.owner?.toString()}
      <br />
      Subaccount: {uint8ArrayToHexString(
        $auth?.account?.subaccount,
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
      Disconnect
    </button>
  {:else}
    <p>Not connected</p>
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
        <p>No wallets available</p>
      {/if}
    </div>
  {/if}

</div>
