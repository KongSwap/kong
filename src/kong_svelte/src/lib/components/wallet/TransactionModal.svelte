<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  // Props
  export let isOpen: boolean;
  export let onClose: () => void;
  export let transaction: any;
  export let tokens: Kong.Token[] = [];
</script>

<Modal
  {isOpen}
  variant="transparent"
  {onClose}
  title="Transaction Details"
  width="400px"
  height="auto"
>
  {#if transaction}
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Type</span>
        <span class="text-sm font-medium">{transaction.type}</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Status</span>
        <span
          class="text-xs px-2 py-1 rounded-full {transaction.status ===
          'Success'
            ? 'bg-kong-success/10 text-kong-success'
            : 'bg-kong-error/10 text-kong-error'}"
        >
          {transaction.status}
        </span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Date</span>
        <span class="text-sm">{transaction.formattedDate}</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Transaction ID</span>
        <span class="text-sm font-mono">{transaction.tx_id}</span>
      </div>

      <div class="space-y-2">
        <div class="text-sm text-kong-text-secondary mb-2">
          Transaction Details
        </div>
        {#if transaction.type === "Swap"}
          <div class="bg-kong-bg-primary/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">From</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages
                    tokens={[
                      tokens.find(
                        (token) =>
                          token.address ===
                          transaction.details.pay_token_canister,
                      ),
                    ]}
                    size={22}
                  />
                  <span class="text-sm font-medium"
                    >{transaction.details.pay_amount}
                    {transaction.details.pay_token_symbol}</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono"
                  >{transaction.details.pay_token_id}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono"
                  >{transaction.details.pay_token_canister}</span
                >
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">To</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages
                    tokens={[
                      tokens.find(
                        (token) =>
                          token.address ===
                          transaction.details.receive_token_canister,
                      ),
                    ]}
                    size={22}
                  />
                  <span class="text-sm font-medium"
                    >{transaction.details.receive_amount}
                    {transaction.details.receive_token_symbol}</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono"
                  >{transaction.details.receive_token_id}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono"
                  >{transaction.details.receive_token_canister}</span
                >
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Price</span>
                <span class="text-xs">{transaction.details.price}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Slippage</span>
                <span class="text-xs"
                  >{transaction.details.slippage || "0"}%</span
                >
              </div>
            </div>
          </div>
        {:else if transaction.type === "Add Liquidity" || transaction.type === "Remove Liquidity"}
          <div class="bg-kong-bg-primary/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 1</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages
                    tokens={[
                      tokens.find(
                        (token) =>
                          token.address ===
                          transaction.details.token_0_canister,
                      ),
                    ]}
                    size={22}
                  />
                  <span class="text-sm font-medium"
                    >{transaction.details.amount_0}
                    {transaction.details.token_0_symbol}</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono"
                  >{transaction.details.token_0_id}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono"
                  >{transaction.details.token_0_canister}</span
                >
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 2</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages
                    tokens={[
                      tokens.find(
                        (token) =>
                          token.address ===
                          transaction.details.token_1_canister,
                      ),
                    ]}
                    size={22}
                  />
                  <span class="text-sm font-medium"
                    >{transaction.details.amount_1}
                    {transaction.details.token_1_symbol}</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono"
                  >{transaction.details.token_1_id}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono"
                  >{transaction.details.token_1_canister}</span
                >
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">LP Token</span>
                <span class="text-xs"
                  >{transaction.details.lp_token_symbol}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">LP Amount</span>
                <span class="text-xs"
                  >{transaction.details.lp_token_amount}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Pool ID</span>
                <span class="text-xs"
                  >{transaction.details.pool_id}</span
                >
              </div>
            </div>
          </div>
        {:else if transaction.type === "Send"}
          <div class="bg-kong-bg-primary/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages
                    tokens={[
                      tokens.find(
                        (token) =>
                          token.address ===
                          transaction.details.token_canister,
                      ),
                    ]}
                    size={22}
                  />
                  <span class="text-sm font-medium"
                    >{transaction.details.amount}
                    {transaction.details.token_symbol}</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono"
                  >{transaction.details.token_id}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono"
                  >{transaction.details.token_canister}</span
                >
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">From</span>
                <span class="text-xs font-mono"
                  >{transaction.details.from}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">To</span>
                <span class="text-xs font-mono"
                  >{transaction.details.to}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Fee</span>
                <span class="text-xs"
                  >{transaction.details.fee || "0"}
                  {transaction.details.token_symbol}</span
                >
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal> 