<script lang="ts">
  import { ArrowLeft, HelpCircle, Shield, Clock, Coins, Users } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import GlossarySidebar from "./GlossarySidebar.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  
  // Define the tokens supported in prediction markets
  const predictionTokenIds = [
    "o7oak-iyaaa-aaaaq-aadzq-cai", // KONG
    "ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP
    "mxzaz-hqaaa-aaaar-qaada-cai", // ckBTC
    "ss2fx-dyaaa-aaaar-qacoq-cai", // ckETH
    "cngnf-vqaaa-aaaar-qag4q-cai", // ckUSDT
    "zfcdd-tqaaa-aaaaq-aaaga-cai", // DKP
    "6c7su-kiaaa-aaaar-qaira-cai"  // GLDT
  ];
  
  // Get token objects from the store
  const supportedTokens = $derived(
    predictionTokenIds
      .map(id => $userTokens.tokens.find(t => t.address === id))
      .filter(Boolean) as Kong.Token[]
  );
</script>

<svelte:head>
  <title>FAQ - KongSwap Prediction Markets</title>
  <meta name="description" content="Learn about time-weighted rewards, multi-token support, and dual resolution system in KongSwap Prediction Markets" />
</svelte:head>

<!-- Move outside the overflow constraints -->
<div class="text-kong-text-primary">
  <!-- Header -->
  <PageHeader 
    title="Prediction Markets FAQ"
    description="Everything you need to know about KongSwap Prediction Markets"
    icon={HelpCircle}
  />

  <div class="max-w-7xl mx-auto px-4 pb-8">
    <!-- Mobile Glossary -->
    <div class="lg:hidden mb-6">
      <GlossarySidebar />
    </div>
    
    <!-- Desktop Layout -->
    <div class="flex gap-8">
      <!-- Desktop Sidebar -->
      <div class="hidden lg:block w-72 flex-shrink-0">
        <GlossarySidebar />
      </div>
      
      <!-- Main Content -->
      <div class="flex-1 max-w-4xl">

        <!-- Time-Weighted Rewards System -->
        <section id="time-weighted" class="mb-8">
          <Panel className="space-y-6">
            <div class="flex items-center gap-3 mb-2">
              <div class="p-2 rounded-lg bg-kong-primary/10">
                <Clock class="w-6 h-6 text-kong-primary" />
              </div>
              <h2 class="text-2xl font-bold text-kong-text-primary">Time-Weighted Rewards System</h2>
            </div>

            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">What is time-weighted distribution?</h3>
                <p class="text-kong-text-secondary">
                  Time-weighted distribution rewards early bettors with higher payouts using an exponential decay model. 
                  The earlier you bet, the more weight your bet receives when calculating winnings.
                </p>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">How does the math work?</h3>
                <div class="bg-kong-bg-primary rounded-lg p-4 space-y-2">
                  <div class="flex justify-between">
                    <span class="text-kong-text-secondary">Default decay rate (α):</span>
                    <span class="text-kong-text-primary font-mono">0.1</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-kong-text-secondary">Weight formula:</span>
                    <span class="text-kong-text-primary font-mono">weight = e^(-α × relative_time)</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-kong-text-secondary">Relative time:</span>
                    <span class="text-kong-text-primary text-sm">Your bet time as % of market duration</span>
                  </div>
                </div>
                <p class="text-sm text-kong-text-secondary mt-2">
                  Example: With α=0.1, betting at market start gives ~10x the weight of betting at market end
                </p>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Why use time weighting?</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Incentivizes early price discovery</h4>
                    <p class="text-xs text-kong-text-secondary">Rewards users who take positions when uncertainty is highest</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Prevents last-minute manipulation</h4>
                    <p class="text-xs text-kong-text-secondary">Late bets have minimal impact on outcomes</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Guaranteed minimum return</h4>
                    <p class="text-xs text-kong-text-secondary">All winners get at least their original bet back</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Fairer distribution</h4>
                    <p class="text-xs text-kong-text-secondary">Rewards information and conviction over timing luck</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Time Weight Examples</h3>
                <div class="bg-kong-bg-primary rounded-lg overflow-hidden">
                  <div class="overflow-x-auto">
                    <table class="w-full min-w-[400px]">
                      <thead>
                        <tr class="border-b border-kong-border/30">
                          <th class="text-left p-3 text-kong-text-secondary font-medium text-sm">Bet Timing</th>
                          <th class="text-left p-3 text-kong-text-secondary font-medium text-sm">Weight Multiplier (α=0.1)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-b border-kong-border/20 hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 text-sm">Market Start</td>
                          <td class="p-3 font-mono text-kong-success text-sm">10.0x</td>
                        </tr>
                        <tr class="border-b border-kong-border/20 hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 text-sm">25% through</td>
                          <td class="p-3 font-mono text-kong-accent-yellow text-sm">6.1x</td>
                        </tr>
                        <tr class="border-b border-kong-border/20 hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 text-sm">50% through</td>
                          <td class="p-3 font-mono text-sm">3.7x</td>
                        </tr>
                        <tr class="border-b border-kong-border/20 hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 text-sm">75% through</td>
                          <td class="p-3 font-mono text-sm">2.2x</td>
                        </tr>
                        <tr class="hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 text-sm">Market End</td>
                          <td class="p-3 font-mono text-kong-text-secondary text-sm">1.0x</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <!-- Multi-Token Market Support -->
        <section id="multi-token" class="mb-8">
          <Panel className="space-y-6">
            <div class="flex items-center gap-3 mb-2">
              <div class="p-2 rounded-lg bg-kong-primary/10">
                <Coins class="w-6 h-6 text-kong-primary" />
              </div>
              <h2 class="text-2xl font-bold text-kong-text-primary">Multi-Token Market Support</h2>
            </div>

            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">What tokens can I use?</h3>
                <p class="text-kong-text-secondary mb-4">KongSwap supports multiple ICRC-compliant tokens:</p>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {#if supportedTokens.length > 0}
                    {#each supportedTokens as token}
                      <div class="bg-kong-bg-primary rounded-lg p-3 hover:bg-kong-bg-tertiary transition-colors cursor-pointer">
                        <div class="flex items-center gap-2">
                          <TokenImages 
                            tokens={[token]} 
                            size={28} 
                            showNetworkIcon={false}
                          />
                          <div class="flex-1 min-w-0">
                            <div class="font-semibold text-kong-text-primary text-sm">{token.symbol}</div>
                            <div class="text-xs text-kong-text-secondary truncate">{token.name}</div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <!-- Fallback if tokens aren't loaded yet -->
                    {#each [
                      { symbol: "KONG", name: "Platform native token" },
                      { symbol: "ICP", name: "Internet Computer Protocol" },
                      { symbol: "ckBTC", name: "Chain-key Bitcoin" },
                      { symbol: "ckETH", name: "Chain-key Ethereum" },
                      { symbol: "ckUSDT", name: "Chain-key Tether" },
                      { symbol: "DKP", name: "Draggin Karma Points" },
                      { symbol: "GLDT", name: "Gold Token" }
                    ] as token}
                      <div class="bg-kong-bg-primary rounded-lg p-3">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-full bg-kong-text-primary/10 flex items-center justify-center flex-shrink-0">
                            <span class="text-xs font-semibold text-kong-primary">{token.symbol.slice(0, 2)}</span>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="font-semibold text-kong-text-primary text-sm">{token.symbol}</div>
                            <div class="text-xs text-kong-text-secondary truncate">{token.name}</div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">How do user-created markets work?</h3>
                <div class="space-y-3">
                  {#each [
                    { step: 1, title: "Choose your token", desc: "Select which token type for your market" },
                    { step: 2, title: "Pay activation fee", desc: "Amount varies by token (prevents spam and incentivizes liquid markets)" },
                    { step: 3, title: "Market activation", desc: "Market becomes active once minimum bet threshold is met" },
                    { step: 4, title: "Single token per market", desc: "All bets and payouts use the same token" }
                  ] as item}
                    <div class="flex gap-3">
                      <div class="w-8 h-8 rounded-full bg-kong-primary/10 flex items-center justify-center flex-shrink-0">
                        <span class="text-sm font-semibold text-kong-primary">{item.step}</span>
                      </div>
                      <div>
                        <h4 class="font-semibold text-kong-text-primary">{item.title}</h4>
                        <p class="text-sm text-kong-text-secondary">{item.desc}</p>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Token-Specific Features</h3>
                <div class="bg-kong-bg-primary rounded-lg p-4 space-y-2">
                  <div class="flex items-start gap-2">
                    <span class="text-kong-primary">•</span>
                    <div>
                      <span class="font-semibold text-kong-text-primary">Different activation fees</span>
                      <span class="text-kong-text-secondary"> - Higher value tokens may require larger activation amounts</span>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-kong-primary">•</span>
                    <div>
                      <span class="font-semibold text-kong-text-primary">Platform fees vary</span>
                      <span class="text-kong-text-secondary"> - Fee percentages differ by token type</span>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-kong-primary">•</span>
                    <div>
                      <span class="font-semibold text-kong-text-primary">Automatic conversion</span>
                      <span class="text-kong-text-secondary"> - No need to convert tokens - bet directly with any supported type</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <!-- Dual Resolution System -->
        <section id="dual-resolution" class="mb-8">
          <Panel className="space-y-6">
            <div class="flex items-center gap-3 mb-2">
              <div class="p-2 rounded-lg bg-kong-primary/10">
                <Users class="w-6 h-6 text-kong-primary" />
              </div>
              <h2 class="text-2xl font-bold text-kong-text-primary">Dual Resolution System (Anti-Cheating)</h2>
            </div>

            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">How does dual resolution prevent manipulation?</h3>
                <p class="text-kong-text-secondary">
                  The dual approval system requires <span class="font-semibold text-kong-text-primary">both the market creator AND a platform admin</span> to agree on 
                  the outcome, preventing single-party manipulation.
                </p>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-3">Resolution Process for User Markets</h3>
                <div class="relative">
                  <!-- Connecting line -->
                  <div class="absolute left-5 top-10 bottom-0 w-0.5 bg-kong-border/30"></div>
                  
                  <!-- Steps -->
                  <div class="space-y-6">
                    <div class="flex gap-3 relative">
                      <div class="w-10 h-10 rounded-full bg-kong-primary/10 flex items-center justify-center flex-shrink-0 relative z-10 bg-kong-bg-secondary">
                        <span class="font-bold text-kong-primary">1</span>
                      </div>
                      <div class="flex-1 pb-2">
                        <h4 class="font-semibold text-kong-text-primary text-sm">Creator Proposes</h4>
                        <p class="text-xs text-kong-text-secondary mt-0.5">Market creator submits their resolution with winning outcomes</p>
                      </div>
                    </div>
                    
                    <div class="flex gap-3 relative">
                      <div class="w-10 h-10 rounded-full bg-kong-primary/10 flex items-center justify-center flex-shrink-0 relative z-10 bg-kong-bg-secondary">
                        <span class="font-bold text-kong-primary">2</span>
                      </div>
                      <div class="flex-1 pb-2">
                        <h4 class="font-semibold text-kong-text-primary text-sm">Admin Reviews</h4>
                        <p class="text-xs text-kong-text-secondary mt-0.5">Platform admin independently reviews and votes on resolution</p>
                      </div>
                    </div>
                    
                    <div class="flex gap-3 relative">
                      <div class="w-10 h-10 rounded-full bg-kong-primary/10 flex items-center justify-center flex-shrink-0 relative z-10 bg-kong-bg-secondary">
                        <span class="font-bold text-kong-primary">3</span>
                      </div>
                      <div class="flex-1">
                        <h4 class="font-semibold text-kong-text-primary text-sm mb-2">Agreement Check</h4>
                        <div class="space-y-2">
                          <div class="bg-kong-success/10 rounded-lg p-2.5 border border-kong-success/20">
                            <div class="flex items-start gap-2">
                              <span class="text-kong-success">✅</span>
                              <div>
                                <span class="text-kong-success font-semibold text-xs">Both agree</span>
                                <span class="text-kong-text-secondary text-xs"> → Market resolves, payouts begin</span>
                              </div>
                            </div>
                          </div>
                          <div class="bg-kong-error/10 rounded-lg p-2.5 border border-kong-error/20">
                            <div class="flex items-start gap-2">
                              <span class="text-kong-error">❌</span>
                              <div>
                                <span class="text-kong-error font-semibold text-xs">Disagreement</span>
                                <span class="text-kong-text-secondary text-xs"> → Market is voided, all bets refunded, creator's deposit burned</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Why This Prevents Cheating</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="bg-kong-bg-primary rounded-lg p-3 border border-kong-border/30">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">No single authority</h4>
                    <p class="text-xs text-kong-text-secondary">Neither creator nor admin can unilaterally resolve</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3 border border-kong-border/30">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Economic incentive</h4>
                    <p class="text-xs text-kong-text-secondary">Creators lose their deposit if they submit incorrect resolutions</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3 border border-kong-border/30">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Admin oversight</h4>
                    <p class="text-xs text-kong-text-secondary">Platform admins verify outcomes against objective criteria</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3 border border-kong-border/30">
                    <h4 class="font-medium text-kong-text-primary mb-1 text-sm">Transparent voting</h4>
                    <p class="text-xs text-kong-text-secondary">All votes are visible in the API for full transparency</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Admin vs User Markets</h3>
                <div class="bg-kong-bg-primary rounded-lg overflow-hidden">
                  <div class="overflow-x-auto">
                    <table class="w-full min-w-[400px]">
                      <thead>
                        <tr class="border-b border-kong-border/30">
                          <th class="text-left p-3 text-kong-text-secondary font-medium text-sm">Market Type</th>
                          <th class="text-left p-3 text-kong-text-secondary font-medium text-sm">Resolution Method</th>
                          <th class="text-left p-3 text-kong-text-secondary font-medium text-sm">Approval Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-b border-kong-border/20 hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 font-semibold text-kong-text-primary text-sm">Admin-Created</td>
                          <td class="p-3 text-sm">Direct resolution</td>
                          <td class="p-3 text-sm">Admin only</td>
                        </tr>
                        <tr class="hover:bg-kong-bg-tertiary transition-colors">
                          <td class="p-3 font-semibold text-kong-text-primary text-sm">User-Created</td>
                          <td class="p-3 text-sm">Dual approval</td>
                          <td class="p-3 text-sm">Creator + Admin</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <!-- Claims & Winnings System -->
        <section id="claims" class="mb-6">
          <Panel className="space-y-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 rounded-lg bg-kong-primary/10 flex-shrink-0">
                <Shield class="w-5 h-5 text-kong-primary" />
              </div>
              <h2 class="text-xl font-bold text-kong-text-primary">Claims & Winnings System</h2>
            </div>

            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">How do I claim my winnings?</h3>
                <div class="bg-kong-bg-primary rounded-lg p-4 space-y-3">
                  <div class="flex gap-3">
                    <span class="text-kong-primary font-bold">1.</span>
                    <div>
                      <span class="font-semibold text-kong-text-primary">Automatic processing</span>
                      <span class="text-kong-text-secondary"> - System automatically creates claims for winning bets</span>
                    </div>
                  </div>
                  <div class="flex gap-3">
                    <span class="text-kong-primary font-bold">2.</span>
                    <div>
                      <span class="font-semibold text-kong-text-primary">Check claims</span>
                      <span class="text-kong-text-secondary"> - Use the "My Claims" section to see pending winnings</span>
                    </div>
                  </div>
                  <div class="flex gap-3">
                    <span class="text-kong-primary font-bold">3.</span>
                    <div>
                      <span class="font-semibold text-kong-text-primary">Transaction recovery</span>
                      <span class="text-kong-text-secondary"> - Failed transfers are automatically retried</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Claim Status Types</h3>
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-kong-bg-primary rounded-lg p-3 flex items-center gap-3">
                    <span class="text-xl">🟡</span>
                    <div>
                      <div class="font-medium text-kong-text-primary text-sm">Pending</div>
                      <div class="text-xs text-kong-text-secondary">Ready to claim</div>
                    </div>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3 flex items-center gap-3">
                    <span class="text-xl">🔄</span>
                    <div>
                      <div class="font-medium text-kong-text-primary text-sm">Processing</div>
                      <div class="text-xs text-kong-text-secondary">Transfer in progress</div>
                    </div>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3 flex items-center gap-3">
                    <span class="text-xl">✅</span>
                    <div>
                      <div class="font-medium text-kong-text-primary text-sm">Completed</div>
                      <div class="text-xs text-kong-text-secondary">Successfully claimed</div>
                    </div>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3 flex items-center gap-3">
                    <span class="text-xl">❌</span>
                    <div>
                      <div class="font-medium text-kong-text-primary text-sm">Failed</div>
                      <div class="text-xs text-kong-text-secondary">Transfer failed (will auto-retry)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-2">Important Notes</h3>
                <div class="bg-kong-accent-yellow/10 border border-kong-accent-yellow/20 rounded-lg p-4 space-y-2">
                  <div class="flex items-start gap-2">
                    <span class="text-kong-accent-yellow">•</span>
                    <p class="text-sm"><span class="font-semibold text-kong-text-primary">Winners only</span> <span class="text-kong-text-secondary">- Only users who bet on winning outcomes receive claims</span></p>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-kong-accent-yellow">•</span>
                    <p class="text-sm"><span class="font-semibold text-kong-text-primary">Original bet returned</span> <span class="text-kong-text-secondary">- You always get your original bet amount back</span></p>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-kong-accent-yellow">•</span>
                    <p class="text-sm"><span class="font-semibold text-kong-text-primary">Bonus winnings</span> <span class="text-kong-text-secondary">- Additional winnings come from losing bets (minus platform fees)</span></p>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-kong-accent-yellow">•</span>
                    <p class="text-sm"><span class="font-semibold text-kong-text-primary">Time-weighted bonus</span> <span class="text-kong-text-secondary">- Earlier bets receive larger bonus amounts</span></p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <!-- Security & Trust -->
        <section id="security" class="mb-6">
          <Panel className="space-y-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 rounded-lg bg-kong-primary/10 flex-shrink-0">
                <Shield class="w-5 h-5 text-kong-primary" />
              </div>
              <h2 class="text-xl font-bold text-kong-text-primary">Security & Trust</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-3">Market Integrity</h3>
                <div class="space-y-2">
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Transparent voting</h4>
                    <p class="text-sm text-kong-text-secondary">All resolution votes are publicly visible</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Immutable history</h4>
                    <p class="text-sm text-kong-text-secondary">All bets and resolutions stored permanently on-chain</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Economic incentives</h4>
                    <p class="text-sm text-kong-text-secondary">Creators risk deposits, admins maintain reputation</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-3">Fund Safety</h3>
                <div class="space-y-2">
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">On-chain storage</h4>
                    <p class="text-sm text-kong-text-secondary">All funds secured by Internet Computer blockchain</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Automatic recovery</h4>
                    <p class="text-sm text-kong-text-secondary">Failed transactions are detected and retried</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">No custodial risk</h4>
                    <p class="text-sm text-kong-text-secondary">You control your tokens through your Internet Identity</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-kong-text-primary mb-3">Platform Guarantees</h3>
                <div class="space-y-2">
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Fair resolution</h4>
                    <p class="text-sm text-kong-text-secondary">Dual approval system ensures objective outcomes</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Guaranteed payouts</h4>
                    <p class="text-sm text-kong-text-secondary">Claims system ensures all winners receive their funds</p>
                  </div>
                  <div class="bg-kong-bg-primary rounded-lg p-3">
                    <h4 class="font-medium text-kong-text-primary">Anti-manipulation</h4>
                    <p class="text-sm text-kong-text-secondary">Time weighting and dual approval prevent gaming</p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  </div>
</div>