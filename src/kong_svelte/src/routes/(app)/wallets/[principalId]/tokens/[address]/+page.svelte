<script lang="ts">
  import { page } from "$app/state";
  import Card from "$lib/components/common/Card.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import PrincipalDisplay from "$lib/components/wallet/PrincipalDisplay.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { walletDataStore } from "$lib/services/wallet";
  import { userTokens } from "$lib/stores/userTokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import {
    formatBalance,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import {
    ArrowRight,
    History,
    Activity,
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    RefreshCw,
  } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { idlFactory as icrcIndexIdl } from "$lib/idls/icrcIndex.idl";
  import { pnp } from "$lib/config/auth.config";
  import { Principal } from "@dfinity/principal";
  import type { ActorSubclass } from "@dfinity/agent";

  // ICRC-3 Index types
  interface IndexActor {
    get_account_transactions: (args: GetAccountTransactionsArgs) => Promise<GetTransactionsResult>;
  }

  interface GetAccountTransactionsArgs {
    account: {
      owner: Principal;
      subaccount: [] | [Uint8Array];
    };
    max_results: bigint;
    start: [] | [bigint];
  }

  interface GetTransactionsResult {
    Ok?: {
      balance: bigint;
      transactions: Array<{
        id: bigint;
        transaction: {
          kind: string;
          timestamp: bigint;
          mint?: {
            to: { owner: Principal; subaccount: [] | [Uint8Array] };
            amount: bigint;
            memo?: [] | [Uint8Array];
            created_at_time?: [] | [bigint];
          };
          burn?: {
            from: { owner: Principal; subaccount: [] | [Uint8Array] };
            amount: bigint;
            memo?: [] | [Uint8Array];
            created_at_time?: [] | [bigint];
            spender?: [] | [{ owner: Principal; subaccount: [] | [Uint8Array] }];
          };
          transfer?: {
            from: { owner: Principal; subaccount: [] | [Uint8Array] };
            to: { owner: Principal; subaccount: [] | [Uint8Array] };
            amount: bigint;
            fee?: [] | [bigint];
            memo?: [] | [Uint8Array];
            created_at_time?: [] | [bigint];
            spender?: [] | [{ owner: Principal; subaccount: [] | [Uint8Array] }];
          };
          approve?: {
            from: { owner: Principal; subaccount: [] | [Uint8Array] };
            spender: { owner: Principal; subaccount: [] | [Uint8Array] };
            amount: bigint;
            expected_allowance?: [] | [bigint];
            expires_at?: [] | [bigint];
            fee?: [] | [bigint];
            memo?: [] | [Uint8Array];
            created_at_time?: [] | [bigint];
          };
        };
      }>;
      oldest_tx_id: [] | [bigint];
    };
    Err?: {
      message: string;
    };
  }

  // Transaction interface
  interface Transaction {
    id: bigint;
    type: 'transfer' | 'mint' | 'burn' | 'approve';
    from?: string;
    to?: string;
    amount: string;
    value: string;
    timestamp: bigint;
    memo?: string;
  }

  // Get token from store - first try userTokens, then fetch if needed
  let token = $state<Kong.Token | null>(null);
  let isLoadingToken = $state(true);
  let balance = $state<TokenBalance | null>(null);
  let transactions = $state<Transaction[]>([]);
  let isLoading = $state(false);
  let hasMoreTransactions = $state(true);
  let currentPage = $state<bigint | undefined>(undefined);
  let oldestTxId = $state<bigint | undefined>(undefined);

  // maps ledger address to indexer canister id
  const indexMap: Record<string, string> = {
    [KONG_LEDGER_CANISTER_ID]: "onixt-eiaaa-aaaaq-aad2q-cai"
  };

  // Create indexer actor
  async function createIndexerActor(canisterId: string): Promise<ActorSubclass<IndexActor>> {
    return pnp.getActor<IndexActor>({
      canisterId,
      idl: icrcIndexIdl,
      anon: true,
      requiresSigning: false,
    });
  }

  // Load token data
  async function loadToken() {
    isLoadingToken = true;
    
    try {
      // First check if token is in user tokens
      const storedTokens = $userTokens.tokens;
      const foundToken = storedTokens.find(t => t.address === page.params.address);
      
      if (foundToken) {
        token = foundToken;
      } else {
        // Fetch from API if not found - pass array of canister IDs
        const response = await fetchTokensByCanisterId([page.params.address]);
        if (response && response.length > 0) {
          token = response[0];
        }
      }

      // Get balance from wallet data store
      if (token && $walletDataStore.balances[token.address]) {
        balance = $walletDataStore.balances[token.address];
      }
    } catch (error) {
      console.error("Error loading token:", error);
    } finally {
      isLoadingToken = false;
    }
  }

  // Load transactions from indexer
  async function loadTransactions(reset = false) {
    if (!token || isLoading || (!hasMoreTransactions && !reset)) return;
    
    // Check if token has an indexer
    const indexerCanisterId = indexMap[token.address];
    if (!indexerCanisterId) {
      console.log("No indexer available for this token");
      return;
    }

    isLoading = true;
    
    try {
      const indexer = await createIndexerActor(indexerCanisterId);
      const principal = Principal.fromText(page.params.principalId);
      
      // Prepare request
      const request: GetAccountTransactionsArgs = {
        account: {
          owner: principal,
          subaccount: [],
        },
        max_results: BigInt(20),
        start: reset ? [] : currentPage ? [currentPage] : [],
      };

      const result = await indexer.get_account_transactions(request);
      
      if ('Ok' in result) {
        const { transactions: txs, oldest_tx_id } = result.Ok;
        
        // Process transactions
        const processedTxs = txs.map((tx: any) => processTransaction(tx, token!));
        
        if (reset) {
          transactions = processedTxs;
        } else {
          transactions = [...transactions, ...processedTxs];
        }
        
        // Update pagination
        if (txs.length > 0) {
          currentPage = txs[txs.length - 1].id;
          oldestTxId = oldest_tx_id[0];
          hasMoreTransactions = oldest_tx_id.length > 0 && currentPage !== oldest_tx_id[0];
        } else {
          hasMoreTransactions = false;
        }
      } else {
        console.error("Error fetching transactions:", result.Err);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      isLoading = false;
    }
  }

  // Process raw transaction into our format
  function processTransaction(tx: any, token: Kong.Token): Transaction {
    const { id, transaction } = tx;
    
    let type: 'transfer' | 'mint' | 'burn' | 'approve' = 'transfer';
    let from: string | undefined;
    let to: string | undefined;
    let amount = BigInt(0);
    
    if (transaction.transfer) {
      type = 'transfer';
      from = transaction.transfer.from.owner.toText();
      to = transaction.transfer.to.owner.toText();
      amount = transaction.transfer.amount;
    } else if (transaction.mint) {
      type = 'mint';
      to = transaction.mint.to.owner.toText();
      amount = transaction.mint.amount;
    } else if (transaction.burn) {
      type = 'burn';
      from = transaction.burn.from.owner.toText();
      amount = transaction.burn.amount;
    } else if (transaction.approve) {
      type = 'approve';
      from = transaction.approve.from.owner.toText();
      to = transaction.approve.spender.owner.toText();
      amount = transaction.approve.amount;
    }
    
    const formattedAmount = formatBalance(amount.toString(), token.decimals);
    const price = token?.metrics?.price || 0;
    const usdValue = Number(amount) / Math.pow(10, token.decimals) * Number(price);
    
    return {
      id,
      type,
      from,
      to,
      amount: formattedAmount,
      value: `$${formatToNonZeroDecimal(usdValue)}`,
      timestamp: transaction.timestamp,
      memo: transaction.memo?.[0] ? new TextDecoder().decode(new Uint8Array(transaction.memo[0])) : undefined,
    };
  }

  // Get transaction icon based on type
  function getTransactionIcon(type: string) {
    switch (type) {
      case 'transfer':
        return ArrowRight;
      case 'mint':
        return ArrowDownLeft;
      case 'burn':
        return ArrowUpRight;
      case 'approve':
        return Activity;
      default:
        return ArrowRight;
    }
  }

  // Get transaction color based on type
  function getTransactionColor(type: string) {
    switch (type) {
      case 'transfer':
        return 'text-kong-text-secondary';
      case 'mint':
        return 'text-green-500';
      case 'burn':
        return 'text-red-500';
      case 'approve':
        return 'text-blue-500';
      default:
        return 'text-kong-text-secondary';
    }
  }

  // Get transaction description
  function getTransactionDescription(tx: Transaction): string {
    const currentPrincipal = page.params.principalId;
    
    switch (tx.type) {
      case 'transfer':
        if (tx.from === currentPrincipal) {
          return `Sent to ${tx.to ? tx.to.slice(0, 5) + '...' + tx.to.slice(-3) : 'Unknown'}`;
        } else {
          return `Received from ${tx.from ? tx.from.slice(0, 5) + '...' + tx.from.slice(-3) : 'Unknown'}`;
        }
      case 'mint':
        return 'Minted';
      case 'burn':
        return 'Burned';
      case 'approve':
        return `Approved ${tx.to ? tx.to.slice(0, 5) + '...' + tx.to.slice(-3) : 'Unknown'}`;
      default:
        return 'Transaction';
    }
  }

  // Format time ago
  function formatTimeAgo(timestamp: bigint): string {
    const now = Date.now();
    const txTime = Number(timestamp) / 1_000_000; // Convert nanoseconds to milliseconds
    const diff = now - txTime;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  // Refresh transactions
  async function refreshTransactions() {
    currentPage = undefined;
    hasMoreTransactions = true;
    await loadTransactions(true);
  }

  onMount(async () => {
    await loadToken();
    if (token && indexMap[token.address]) {
      await loadTransactions();
    }
  });
</script>

<svelte:head>
  <title
    >{token?.symbol || "Token"} Transactions - Wallet {page.params.principalId} -
    KongSwap</title
  >
</svelte:head>

<div class="space-y-2">
  <!-- Token Overview Card -->
  <Card className="p-4 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <button
        onclick={() => goto(`/wallets/${page.params.principalId}/tokens`)}
        class="text-sm text-kong-primary hover:text-opacity-80 flex items-center gap-1"
      >
        � Back to Tokens
      </button>
    </div>

    {#if isLoadingToken}
      <LoadingIndicator message="Loading token data..." />
    {:else if !token}
      <div class="text-center py-4">
        <p class="text-kong-text-secondary">Token not found</p>
      </div>
    {:else}
      <div class="flex flex-col sm:flex-row gap-6">
        <!-- Token Info -->
        <div class="flex items-center gap-4">
          <TokenImages tokens={[token]} size={64} />
          <div>
            <h1 class="text-2xl font-bold text-kong-text-primary">
              {token.symbol}
            </h1>
            <p class="text-sm text-kong-text-secondary">{token.name}</p>
          </div>
        </div>

        <!-- Balance Info -->
        <div class="flex-1 grid grid-cols-2 gap-4 sm:text-right">
          <div>
            <p class="text-sm text-kong-text-secondary">Balance</p>
            <p class="text-lg font-semibold text-kong-text-primary">
              {balance ? formatBalance(balance.in_tokens, token.decimals) : "0"}
              {token.symbol}
            </p>
          </div>
          <div>
            <p class="text-sm text-kong-text-secondary">Value</p>
            <p class="text-lg font-semibold text-kong-text-primary">
              ${balance ? formatToNonZeroDecimal(balance.in_usd) : "0.00"}
            </p>
          </div>
        </div>
      </div>

      <!-- Token Address -->
      <div class="mt-4 pt-4 border-t border-kong-border/30">
        <p class="text-sm text-kong-text-secondary mb-1">Token Address</p>
        <PrincipalDisplay principal={token.address} fontSize="text-sm" />
      </div>
    {/if}
  </Card>

  <!-- Transactions Card -->
  <Card className="p-4 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h3
        class="text-lg font-semibold text-kong-text-primary flex items-center gap-2"
      >
        <History size={20} />
        Transaction History
      </h3>
      {#if token && indexMap[token.address]}
        <button
          onclick={refreshTransactions}
          disabled={isLoading}
          class="text-sm text-kong-primary hover:text-opacity-80 flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      {/if}
    </div>

    {#if isLoading && transactions.length === 0}
      <LoadingIndicator message="Loading transactions..." />
    {:else if !token || !indexMap[token.address]}
      <div class="text-center py-8 text-kong-text-secondary">
        <p class="text-sm">
          Transaction history is not available for this token.
        </p>
        <p class="text-xs mt-2">
          Only tokens with ICRC-3 compatible indexers can display transaction history.
        </p>
      </div>
    {:else if transactions.length === 0}
      <div class="text-center py-8 text-kong-text-secondary">
        No transactions found for this token
      </div>
    {:else}
      <div class="space-y-3">
        {#each transactions as tx}
          {@const Icon = getTransactionIcon(tx.type)}
          <div
            class="p-4 bg-kong-bg-tertiary/30 rounded-lg hover:bg-kong-bg-tertiary/50 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-kong-bg-secondary rounded-full">
                  <Icon size={16} class={getTransactionColor(tx.type)} />
                </div>
                <div>
                  <p class="font-medium text-kong-text-primary">
                    {getTransactionDescription(tx)}
                  </p>
                  <p class="text-sm text-kong-text-secondary">
                    {formatTimeAgo(tx.timestamp)}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-medium text-kong-text-primary">
                  {tx.amount}
                  {token?.symbol || ""}
                </p>
                <p class="text-sm text-kong-text-secondary">{tx.value}</p>
              </div>
            </div>
            {#if tx.memo}
              <p class="text-xs text-kong-text-secondary mt-2">
                Memo: {tx.memo}
              </p>
            {/if}
          </div>
        {/each}
      </div>

      {#if hasMoreTransactions}
        <div class="mt-4 text-center">
          <button
            class="text-sm text-kong-primary hover:text-opacity-80"
            onclick={() => loadTransactions()}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load more transactions'}
          </button>
        </div>
      {/if}
    {/if}
  </Card>
</div>
