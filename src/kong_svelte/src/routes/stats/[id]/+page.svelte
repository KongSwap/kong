<script lang="ts">
import { page } from "$app/stores";
import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
import { fetchTransactions, tokens, type Transaction } from "$lib/services/indexer/api";
import { poolStore } from "$lib/services/pools";
import { formatDistance } from 'date-fns';

const tokenAddress = $page.params.id;

$: token = $tokens?.find(t => t.address === tokenAddress);
$: biggestPool = $poolStore?.pools?.filter(p => p.address_0 === tokenAddress)
  .sort((a, b) => b.tvl - a.tvl)[1];

// Update state type
let transactions: Transaction[] = [];
let isLoadingTxns = true;

// Add pagination state
let currentPage = 1;
const pageSize = 20;
let totalTransactions = 0;

// Add state for pagination info
let totalPages = 0;

// Update fetch function to use pagination
const loadTransactionData = async (page: number = 1) => {
  if (!biggestPool) return;
  
  try {
    isLoadingTxns = true;
    console.log('Loading transactions for pool:', biggestPool.pool_id, 'page:', page);
    const response = await fetchTransactions(Number(biggestPool.pool_id), page, pageSize);
    transactions = response;
    console.log('Received transactions:', transactions);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
  } finally {
    isLoadingTxns = false;
  }
};

// Add pagination controls to the template
const loadNextPage = () => {
  currentPage++;
  loadTransactionData(currentPage);
};

const loadPrevPage = () => {
  if (currentPage > 1) {
    currentPage--;
    loadTransactionData(currentPage);
  }
};

// Watch for changes in biggestPool
$: if (biggestPool) {
  currentPage = 1; // Reset to first page when pool changes
  loadTransactionData(currentPage);
}

// Add helper functions to handle the number formatting
const formatAmount = (amount: string, decimals: number): string => {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(2);
};

const formatPrice = (price: string): string => {
  return Number(price).toFixed(6);
};

// Add helper function to calculate the correct price
const calculatePrice = (tx: Transaction, tokenSymbol: string | undefined): string => {
  if (!tokenSymbol) return "0";
  
  // If we're selling the token (it's the pay token), divide receive by pay
  if (tx.paySymbol === tokenSymbol) {
    return (Number(tx.receiveAmount) / Math.pow(10, tx.receiveToken.decimals) / 
           (Number(tx.payAmount) / Math.pow(10, tx.payToken.decimals))).toFixed(6);
  }
  // If we're buying the token (it's the receive token), divide pay by receive
  else {
    return (Number(tx.payAmount) / Math.pow(10, tx.payToken.decimals) / 
           (Number(tx.receiveAmount) / Math.pow(10, tx.receiveToken.decimals))).toFixed(6);
  }
};
</script>

<div class="p-4">
  <h1 class="text-2xl font-bold text-white mb-6">{token?.name} ({token?.symbol})</h1>
  
  {#if token && biggestPool}
    <TradingViewChart 
      poolId={Number(biggestPool.pool_id)} 
      symbol={biggestPool.symbol} 
    />

    <!-- Transactions Table -->
    <div class="bg-[#14161A] rounded-lg p-4">
      <h2 class="text-xl font-semibold text-white mb-4">Recent Transactions</h2>
      
      {#if isLoadingTxns}
        <div class="text-white">Loading transactions...</div>
      {:else if transactions.length === 0}
        <div class="text-white">No transactions found</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-white">
            <thead class="text-sm uppercase bg-gray-800">
              <tr>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3">Price</th>
                <th class="px-4 py-3">Amount</th>
                <th class="px-4 py-3">Total Value</th>
                <th class="px-4 py-3">Time</th>
                <th class="px-4 py-3">Tx</th>
              </tr>
            </thead>
            <tbody>
              {#each transactions as tx}
                <tr class="border-b border-slate-700">
                  <td class="px-4 py-3">
                    <span class={tx.paySymbol === token?.symbol ? 'text-red-500' : 'text-green-500'}>
                      {tx.paySymbol === token?.symbol ? 'Sell' : 'Buy'}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    ${calculatePrice(tx, token?.symbol)}
                  </td>
                  <td class="px-4 py-3">
                    {formatAmount(tx.payAmount, tx.payToken.decimals)} {tx.paySymbol}
                  </td>
                  <td class="px-4 py-3">
                    {formatAmount(tx.receiveAmount, tx.receiveToken.decimals)} {tx.receiveSymbol}
                  </td>
                  <td class="px-4 py-3">
                    {formatDistance(new Date(Number(tx.ts) / 1_000_000), new Date(), { addSuffix: true })}
                  </td>
                  <td class="px-4 py-3">
                    <a 
                      href={`https://explorer.sui.io/txblock/${tx.txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-400 hover:text-blue-300"
                    >
                      View
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          
          <!-- Add pagination controls -->
          <div class="mt-4 flex justify-between items-center">
            <button 
              class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              on:click={loadPrevPage}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span class="text-white">Page {currentPage}</span>
            <button 
              class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              on:click={loadNextPage}
              disabled={transactions.length < pageSize}
            >
              Next
            </button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-white">Loading...</div>
  {/if}
</div>

<style>
  :global(.tv-lightweight-charts) {
    font-family: inherit !important;
  }
</style>
