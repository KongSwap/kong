<script lang="ts"> 
	import { formatUsdValue } from '$lib/utils/tokenFormatters';
	import { fetchTokensByCanisterId } from '$lib/api/tokens';
    import { onMount } from 'svelte';
    import { Check, Coins, AlertTriangle } from 'lucide-svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import { KONG_LEDGER_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
    import { getMarket, placeBet, getUserHistory } from '$lib/api/predictionMarket';
    import { auth } from '$lib/stores/auth';
    import { Principal } from '@dfinity/principal';
    import { formatBalance } from '$lib/utils/numberFormatUtils';

    let tokens: any[] = [];
    let market: any = null;
    let betError: string | null = null;
    let isBetting = false;
    let isApprovingAllowance = false;

    interface Matchup {
        id: number;
        player1: any;
        player2: any;
        hasBet?: boolean;
        pickedLeft?: boolean;
        pool1: number;
        pool2: number;
        betCount1: number;
        betCount2: number;
        total_pool: number;
    }

    let matchups: Matchup[] = [];

    let userBets: any = null;
    let isLoadingBets = false;

    async function loadUserBets() {
        try {
            if (!auth.pnp?.account?.owner) {
                userBets = null;
                return;
            }
            
            isLoadingBets = true;
            const principal = auth.pnp.account.owner.toString();
            
            // Validate principal format
            try {
                Principal.fromText(principal); // Validate the principal string
            } catch (error) {
                console.error('Invalid principal format:', error);
                userBets = null;
                return;
            }
            
            userBets = await getUserHistory(principal);
        } catch (error) {
            console.error('Error loading user bets:', error);
            userBets = null;
        } finally {
            isLoadingBets = false;
        }
    }

    // Add reactive statement for auth changes
    $: if ($auth.isConnected) {
        loadUserBets();
    }

    onMount(async () => {
        tokens = await fetchTokensByCanisterId([KONG_LEDGER_CANISTER_ID, ICP_CANISTER_ID]);
        market = await getMarket(0);
        await loadUserBets();
        
        // Create matchup from market data
        if (market && market.length > 0) {
            const currentMarket = market[0];
            matchups = [{
                id: 0,
                player1: tokens.find(t => t.symbol === currentMarket.outcomes[0]),
                player2: tokens.find(t => t.symbol === currentMarket.outcomes[1]),
                pool1: Number(currentMarket.outcome_pools[0]),
                pool2: Number(currentMarket.outcome_pools[1]),
                betCount1: Number(currentMarket.bet_counts[0]),
                betCount2: Number(currentMarket.bet_counts[1]),
                hasBet: false, // TODO: Check if user has bet
                pickedLeft: false, // TODO: Check which side user picked if they bet
                total_pool: Number(currentMarket.total_pool)
            }];
        }
        console.log('Market:', market);
        console.log('Matchups:', matchups);
    });

    // Add navigation state
    let currentRound = 1;

    let showModal = false;
    let selectedToken: any = null;
    let opponent: Matchup | null = null;

    function openModal(token: any) {
        selectedToken = token;
        opponent = matchups.find(match => 
            match.player1?.symbol === token.symbol || match.player2?.symbol === token.symbol
        ) || null;
        showModal = true;
    }

    function closeModal() {
        showModal = false;
    }

    // Add state for odds calculation
    let potentialWinnings = 0;
    let odds = 0;

    // Update odds calculation to use pool sizes from market
    function calculateOdds(pool1: number, pool2: number): number {
        const totalPool = pool1 + pool2;
        if (totalPool === 0) return 2; // Default 1:1 odds
        const probability = pool1 / totalPool;
        return probability > 0 ? 1 / probability : 2;
    }

    // Calculate potential winnings based on pool sizes
    function calculatePotentialWinnings(amount: number, currentPool: number, opposingPool: number): number {
        const proportion = amount / (currentPool + amount);
        return amount + (proportion * opposingPool);
    }

    // Update bet form state and submit handler
    let betAmount = 0;
    let showConfirmation = false;

    $: if (betAmount && selectedToken && opponent) {
        const isPlayer1 = opponent.player1?.symbol === selectedToken.symbol;
        const currentPool = isPlayer1 ? opponent.pool1 : opponent.pool2;
        const opposingPool = isPlayer1 ? opponent.pool2 : opponent.pool1;
        
        odds = calculateOdds(currentPool, opposingPool);
        potentialWinnings = calculatePotentialWinnings(betAmount, currentPool, opposingPool);
    }

    function handleBetSubmit(event: Event) {
        event.preventDefault();
        showConfirmation = true;
    }

    async function confirmBet() {
        if (!selectedToken || !opponent || !market || market.length === 0) {
            betError = "Invalid bet state";
            return;
        }

        try {
            isBetting = true;
            isApprovingAllowance = true;
            betError = null;

            // Determine the outcome index based on selected token
            const currentMarket = market[0];
            const outcomeIndex = currentMarket.outcomes.findIndex(
                (outcome: string) => outcome === selectedToken.symbol
            );

            if (outcomeIndex === -1) {
                throw new Error("Selected token not found in market outcomes");
            }

            // Find the KONG token from our tokens list
            const kongToken = tokens.find(t => t.canister_id === KONG_LEDGER_CANISTER_ID);
            if (!kongToken) {
                throw new Error("KONG token not found");
            }

            // Convert bet amount to natural number (removing decimals)
            const betAmountNat = Math.floor(betAmount);

            try {
                // First phase: Approve allowance
                isApprovingAllowance = true;
                await placeBet(kongToken, 0, outcomeIndex, betAmountNat.toString());
                isApprovingAllowance = false;

                // Update UI state after successful bet
                const updatedMarket = await getMarket(0);
                if (updatedMarket) {
                    market = updatedMarket;
                    // Update matchups with new market data
                    if (market && market.length > 0) {
                        const currentMarket = market[0];
                        matchups = [{
                            id: 0,
                            player1: tokens.find(t => t.symbol === currentMarket.outcomes[0]),
                            player2: tokens.find(t => t.symbol === currentMarket.outcomes[1]),
                            pool1: Number(currentMarket.outcome_pools[0]),
                            pool2: Number(currentMarket.outcome_pools[1]),
                            betCount1: Number(currentMarket.bet_counts[0]),
                            betCount2: Number(currentMarket.bet_counts[1]),
                            hasBet: true,
                            pickedLeft: outcomeIndex === 0,
                            total_pool: Number(currentMarket.total_pool)
                        }];
                    }
                }

                showConfirmation = false;
                closeModal();
                
                // Refresh user's bets after successful bet
                await loadUserBets();
                
            } catch (error) {
                console.error('Bet error:', error);
                if (error instanceof Error) {
                    // Check for common ICRC2 errors
                    if (error.message.includes("No allowance")) {
                        betError = "Please approve KONG token spending first";
                    } else if (error.message.includes("Insufficient balance")) {
                        betError = "Insufficient KONG balance";
                    } else if (error.message.includes("Transfer failed")) {
                        betError = "Failed to transfer KONG tokens. Please try again.";
                    } else {
                        betError = error.message;
                    }
                } else {
                    betError = "Failed to place bet. Please try again.";
                }
            }
        } finally {
            isBetting = false;
            isApprovingAllowance = false;
        }
    }
</script>

<svelte:head>
    <title>Kong Madness - KongSwap</title>
    <meta name="description" content="Kong Madness is a tournament where the token with the highest volume wins the matchup." />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Teko:wght@700&display=swap" rel="stylesheet">
</svelte:head>

<div class="tournament-container flex flex-col md:flex-row">
    <div class="dots-overlay"></div>
    <!-- First column: Tournament Info -->
    <div class="flex flex-col w-full md:w-1/2 px-4 mb-6 md:mb-0">
        <div class="header text-center flex w-full justify-center">
            <img src="/titles/kong-madness.webp" alt="Kong Madness" class="logo mb-8">
        </div>
        <div class="competition-info mx-4 p-6 mb-6">
            <h2 class="text-4xl font-bold mb-5 tracking-wider text-white">RULES</h2>
            <p class="text-2xl mb-3 font-teko"><strong class="uppercase tracking-wide font-semibold">Start Time:</strong> 12:00 AM UTC</p>
            <ul class="mt-3 space-y-3">
                <li class="text-2xl font-teko pl-8 text-white/90">Each round runs for 24 hours.</li>
                <li class="text-2xl font-teko pl-8 text-white/90">There are 4 rounds total.</li>
                <li class="text-2xl font-teko pl-8 text-white/90">There is one day off between each round.</li>
                <li class="text-2xl font-teko pl-8 text-white/90">The token with the higher volume wins the matchup.</li>
                <li class="text-2xl font-teko pl-8 text-white/90">Bets are final once placed.</li>
            </ul>
        </div>
        
        <!-- Add My Bets Section -->
        <div class="my-bets-section competition-info mx-4 p-6">
            <h2 class="text-4xl font-bold mb-5 tracking-wider text-white flex items-center gap-3">
                MY PREDICTIONS
                {#if isLoadingBets}
                    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                {/if}
            </h2>
            
            {#if !auth.pnp?.account?.owner}
                <div class="text-center py-4 text-gray-400">
                    Connect your wallet to view your predictions
                </div>
            {:else if userBets}
                <div class="bets-container space-y-4">
                    {#if userBets.active_bets?.length > 0}
                        <div class="bet-section">
                            {#each userBets.active_bets as bet}
                                <div class="bet-card bg-white/5 rounded-lg p-3 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-lg font-teko">{bet.outcome_text}</span>
                                        <span class="text-green-400 font-bold">{formatBalance(bet.bet_amount, 8)} KONG</span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    {#if userBets.resolved_bets?.length > 0}
                        <div class="bet-section">
                            <h3 class="text-2xl font-teko text-green-400 mb-2">Resolved Bets</h3>
                            {#each userBets.resolved_bets as bet}
                                <div class="bet-card bg-white/5 rounded-lg p-3 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-lg font-teko">{bet.outcome_text}</span>
                                        <div class="text-right">
                                            <div class="text-gray-400 text-sm">Bet: {formatBalance(bet.bet_amount, 8)} KONG</div>
                                            {#if bet.winnings}
                                                <div class="text-green-400 font-bold">Won: {formatBalance(bet.winnings, 8)} KONG</div>
                                            {:else}
                                                <div class="text-red-400">Lost</div>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <div class="stats-section mt-4 pt-4 border-t border-white/10">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="stat-card bg-white/5 rounded-lg p-3 text-center">
                                <div class="text-sm text-gray-400">Total Wagered</div>
                                <div class="text-xl font-bold text-white">{formatBalance(userBets.total_wagered, 8)} KONG</div>
                            </div>
                            <div class="stat-card bg-white/5 rounded-lg p-3 text-center">
                                <div class="text-sm text-gray-400">Total Won</div>
                                <div class="text-xl font-bold text-green-400">{formatBalance(userBets.total_won, 8)} KONG</div>
                            </div>
                        </div>
                    </div>
                </div>
            {:else}
                <div class="text-center py-4 text-gray-400">
                    No predictions found
                </div>
            {/if}
        </div>
    </div>
    
    <!-- Second column: Matchups -->
    <div class="matchups w-full px-4 flex flex-col gap-6">
        <div class="navigation flex items-center justify-center gap-4">
            <button class="nav-button text-white text-3xl px-4 cursor-pointer bg-transparent border-0">←</button>
            <h1 class="text-3xl font-bold uppercase">ROUND {currentRound} MATCHUPS:</h1>
            <button class="nav-button text-white text-3xl px-4 cursor-pointer bg-transparent border-0">→</button>
        </div>
        {#each matchups as match}
            <div class="matchup rounded-2xl flex flex-col md:flex-row items-center md:justify-between mb-2 p-4">
                <div class="player flex flex-col items-center gap-2 flex-1">
                    <div class="player-info flex flex-col md:flex-row items-center gap-4">
                        <div class="icon-container rounded-full p-1.5 flex items-center justify-center">
                            <img src={match.player1?.logo_url} alt={match.player1?.symbol} class="player-icon rounded-full">
                            {#if Number(match.player1?.metrics?.volume_24h ?? 0) > Number(match.player2?.metrics?.volume_24h ?? 0)}
                                <div class="winner-indicator rounded-full">🏆</div>
                            {/if}
                        </div>
                        <div class="flex flex-col items-center md:items-start text-center md:text-left">
                            <span class="player-name text-3xl">{match.player1?.symbol}</span>
                            <span class="player-volume text-xl">Vol: {formatUsdValue(match.player1?.metrics?.volume_24h)}</span>
                            <div class="bet-stats flex flex-col items-center md:items-start text-sm">
                                <div class="bet-count flex items-center gap-2">
                                    <span class="text-blue-400 flex items-center gap-1">
                                        <Coins class="w-4 h-4" strokeWidth={2} />
                                        Predictions: {match.betCount1.toLocaleString()}
                                    </span>
                                    {#if userBets?.active_bets?.some(bet => bet.market.id === match.id && bet.outcome_text === match.player1?.symbol)}
                                        <span class="text-green-400 flex items-center gap-1 ml-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                                            </svg>
                                            Your prediction: {formatBalance(userBets.active_bets.find(bet => bet.market.id === match.id && bet.outcome_text === match.player1?.symbol)?.bet_amount, 8)} KONG
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="vs-container flex flex-col items-center gap-2">
                    <div class="vs text-3xl md:text-6xl mx-0 my-4 md:mx-8 md:my-0">VS</div>
                    {#if match.total_pool > 0}
                        <div class="share-percentages flex justify-between items-center w-full text-sm px-2">
                            <span class="text-yellow-400 font-bold text-lg">{((match.pool1 / match.total_pool) * 100).toFixed(1)}%</span>
                            <span class="text-white/80 font-bold uppercase text-xs tracking-wider">Pool Distribution</span>
                            <span class="text-[#60A5FA] font-bold text-lg">{((match.pool2 / match.total_pool) * 100).toFixed(1)}%</span>
                        </div>
                        <div class="relative w-[300px] h-3 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-gray-700">
                            <!-- Left side (pool1) -->
                            <div class="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
                                 style="width: {((match.pool1 / match.total_pool) * 100)}%; background: linear-gradient(90deg, #EAB308 0%, #FCD34D 100%);">
                                <div class="absolute inset-0 bg-[url('/effects/noise.png')] mix-blend-overlay opacity-30"></div>
                                <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                            </div>
                            
                            <!-- Right side (pool2) -->
                            <div class="absolute top-0 right-0 h-full transition-all duration-500 ease-out"
                                 style="width: {((match.pool2 / match.total_pool) * 100)}%; background: linear-gradient(90deg, #60A5FA 0%, #93C5FD 100%);">
                                <div class="absolute inset-0 bg-[url('/effects/noise.png')] mix-blend-overlay opacity-30"></div>
                                <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                            </div>
                            
                            <!-- Center line -->
                            <div class="absolute top-0 left-1/2 w-0.5 h-full bg-white/30 backdrop-blur-sm"></div>
                            
                            <!-- Tick marks -->
                            <div class="absolute inset-0 flex justify-between px-3">
                                {#each Array(8) as _, i}
                                    <div class="h-1.5 w-px bg-white/10"></div>
                                {/each}
                            </div>
                            
                            <!-- Pool amounts -->
                            <div class="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-gray-400 px-1">
                                <span>{match.pool1.toLocaleString()} KONG</span>
                                <span>{match.pool2.toLocaleString()} KONG</span>
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="player flex flex-col items-center gap-2 flex-1">
                    <div class="player-info flex flex-col md:flex-row items-center gap-4">
                        <div class="icon-container rounded-full p-1.5 flex items-center justify-center">
                            <img src={match.player2?.logo_url} alt={match.player2?.symbol} class="player-icon rounded-full">
                            {#if Number(match.player2?.metrics?.volume_24h ?? 0) > Number(match.player1?.metrics?.volume_24h ?? 0)}
                                <div class="winner-indicator rounded-full">🏆</div>
                            {/if}
                        </div>
                        <div class="flex flex-col items-center md:items-start text-center md:text-left">
                            <span class="player-name text-3xl">{match.player2?.symbol}</span>
                            <span class="player-volume text-xl">Vol: {formatUsdValue(match.player2?.metrics?.volume_24h)}</span>
                            <div class="bet-stats flex flex-col items-center md:items-start text-sm">
                                <div class="bet-count flex items-center gap-2">
                                    <span class="text-blue-400 flex items-center gap-1">
                                        <Coins class="w-4 h-4" strokeWidth={2} />
                                        Predictions: {match.betCount2.toLocaleString()}
                                    </span>
                                    {#if userBets?.active_bets?.some(bet => bet.market.id === match.id && bet.outcome_text === match.player2?.symbol)}
                                        <span class="text-green-400 flex items-center gap-1 ml-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                                            </svg>
                                            Your prediction: {formatBalance(userBets.active_bets.find(bet => bet.market.id === match.id && bet.outcome_text === match.player2?.symbol)?.bet_amount, 8)} KONG
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mb-4 flex flex-col md:flex-row gap-4 w-full justify-between px-8">
                {#if match.hasBet}
                    <div class="flex w-full" class:justify-start={match.pickedLeft} class:justify-end={!match.pickedLeft}>
                        <button class="action-button your-pick w-full md:w-1/3 py-1.5 font-teko text-[2rem] border-0 cursor-pointer uppercase text-white rounded-tr-lg rounded-bl-lg hover:scale-105 transition-transform font-black flex items-center justify-center gap-2 [text-shadow:0_2px_0_rgba(0,0,0,1))_drop-shadow(1px_1px_0_rgba(0,0,0,1))_drop-shadow(1px_0_0_rgba(0,0,0,1))]">
                            <span class="[filter:drop-shadow(0_1px_0_rgba(0,0,0,1))_drop-shadow(1px_1px_0_rgba(0,0,0,1))_drop-shadow(1px_0_0_rgba(0,0,0,1))]">
                                <Check class="w-8 h-8" strokeWidth={3} />
                            </span>
                            <span class="tracking-wide">{match.pickedLeft ? match.player1?.symbol : match.player2?.symbol}</span>
                        </button>
                    </div>
                {:else}
                    <button on:click={() => openModal(match.player1)} class="action-button bet-button w-full md:w-1/3 py-1.5 font-teko text-[2rem] border-0 cursor-pointer uppercase text-white rounded-tr-lg rounded-bl-lg hover:scale-105 transition-transform font-black [text-shadow:0_2px_0_#000,2px_2px_0_#000,2px_0_0_#000] flex items-center justify-center gap-2">
                        <span class="[filter:drop-shadow(0_1px_0_rgba(0,0,0,1))_drop-shadow(1px_1px_0_rgba(0,0,0,1))_drop-shadow(1px_0_0_rgba(0,0,0,1))]">
                            <Coins class="w-8 h-8" strokeWidth={3} />
                        </span>
                        <span class="tracking-wide">BET {match.player1?.symbol}</span>
                    </button>
                    <button on:click={() => openModal(match.player2)} class="action-button bet-button w-full md:w-1/3 py-1.5 font-teko text-[2rem] border-0 cursor-pointer uppercase text-white rounded-tr-lg rounded-bl-lg hover:scale-105 transition-transform font-black [text-shadow:0_2px_0_#000,2px_2px_0_#000,2px_0_0_#000] flex items-center justify-center gap-2">
                        <span class="[filter:drop-shadow(0_1px_0_rgba(0,0,0,1))_drop-shadow(1px_1px_0_rgba(0,0,0,1))_drop-shadow(1px_0_0_rgba(0,0,0,1))]">
                            <Coins class="w-8 h-8" strokeWidth={3} />
                        </span>
                        <span class="tracking-wide">BET {match.player2?.symbol}</span>
                    </button>
                {/if}
            </div>
        {/each}
    </div>
</div>

<Modal isOpen={showModal} variant="transparent" on:close={closeModal} title="Place your bet" width="500px">
    {#if selectedToken}
        <div class="flex flex-col gap-4 p-4">
            <div class="token-info flex items-center gap-4 mb-2">
                <div class="icon-container rounded-full p-1.5 flex items-center justify-center bg-white relative">
                    <img src={selectedToken.logo_url} alt={selectedToken.symbol} class="player-icon object-cover rounded-full" />
                    {#if opponent}
                        {#if selectedToken.metrics?.volume_24h > (opponent.player1?.symbol === selectedToken.symbol ? opponent.player2?.metrics?.volume_24h : opponent.player1?.metrics?.volume_24h)}
                            <div class="winner-indicator rounded-full">🏆</div>
                        {/if}
                    {/if}
                </div>
                <div>
                    <p class="text-lg font-bold text-kong-text-primary">{selectedToken.symbol}</p>
                    {#if selectedToken.metrics?.volume_24h}
                        <p class="text-sm text-kong-text-secondary">Volume: {formatUsdValue(selectedToken.metrics.volume_24h)}</p>
                    {/if}
                </div>
            </div>

            <div class="info-box bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-200">
                <h4 class="font-bold mb-2">How Betting Works</h4>
                <ul class="list-disc pl-4 space-y-1">
                    <li>All predictions are pooled together for each token</li>
                    <li>If your token wins, you get your bet back plus a share of the losing pool</li>
                    <li>Your share is proportional to your bet size vs the total winning pool</li>
                    <li>Transactions are final once placed</li>
                    <li>{selectedToken.symbol} Pool: {opponent?.pool1} KONG</li>
                    {#if opponent}
                        <li>{opponent.player1?.symbol === selectedToken.symbol ? opponent.player2?.symbol : opponent.player1?.symbol} Pool: {opponent?.pool2} KONG</li>
                    {/if}
                </ul>
            </div>

            {#if !showConfirmation}
                <form on:submit|preventDefault={handleBetSubmit} class="flex flex-col gap-4">
                    <div class="bet-info bg-gray-800/50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-3">
                            <span class="text-sm text-kong-text-secondary">Current Pool Ratio</span>
                            <span class="text-lg font-bold text-kong-text-primary">{opponent?.pool1} : {opponent?.pool2}</span>
                        </div>
                        <div class="flex gap-2 items-center">
                            <input 
                                type="number" 
                                id="betAmount" 
                                bind:value={betAmount} 
                                class="p-2.5 w-full rounded bg-gray-700 text-white" 
                                min="0"
                                step="0.1"
                                placeholder="Enter amount"
                                required 
                            />
                            <span class="text-kong-text-primary font-bold">KONG</span>
                        </div>
                        {#if betAmount > 0}
                            <div class="mt-3 flex justify-between items-center">
                                <span class="text-sm text-kong-text-secondary">Potential Winnings</span>
                                <div class="text-right">
                                    <span class="text-lg font-bold text-green-400">{formatBalance(potentialWinnings, 8)} KONG</span>
                                    <p class="text-xs text-kong-text-secondary">({((potentialWinnings/betAmount - 1) * 100).toFixed(1)}% return)</p>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <button 
                        type="submit" 
                        class="mt-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg font-bold hover:from-orange-600 hover:to-yellow-600 transition-all"
                    >
                        Review Bet
                    </button>
                </form>
            {:else}
                <div class="confirmation-summary bg-gray-800/50 rounded-lg p-4">
                    <h3 class="text-lg font-bold text-kong-text-primary mb-4">Confirm Your Bet</h3>
                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Amount</span>
                            <span class="text-kong-text-primary font-bold">{formatBalance(betAmount, 8)} KONG</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Token</span>
                            <span class="text-kong-text-primary font-bold">{selectedToken.symbol}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Current Pool Size</span>
                            <span class="text-kong-text-primary font-bold">{opponent?.pool1} KONG</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Potential Winnings</span>
                            <div class="text-right">
                                <span class="text-green-400 font-bold">{formatBalance(potentialWinnings, 8)} KONG</span>
                                <p class="text-xs text-kong-text-secondary">({((potentialWinnings/betAmount - 1) * 100)}% return)</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-4">
                        {#if betError}
                            <div class="bg-red-500/20 border border-red-500/40 rounded-lg p-4 text-red-200 flex items-center gap-2">
                                <AlertTriangle class="w-5 h-5" />
                                <span>{betError}</span>
                            </div>
                        {/if}
                        <div class="flex gap-3">
                            <button 
                                class="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                on:click={() => showConfirmation = false}
                                disabled={isBetting}
                            >
                                Back
                            </button>
                            <button 
                                class="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                on:click={confirmBet}
                                disabled={isBetting}
                            >
                                {#if isBetting}
                                    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    {#if isApprovingAllowance}
                                        Approving KONG...
                                    {:else}
                                        Placing Bet...
                                    {/if}
                                {:else}
                                    Confirm Bet
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</Modal>

<style>
    .tournament-container {
        position: relative;
        color: white;
    }

    .dots-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.1) 1px, transparent 0);
        background-size: 24px 24px;
        pointer-events: none;
        z-index: 1;
    }

    .header, .matchups {
        position: relative;
        z-index: 2;
    }

    .logo {
        width: 300px;
        height: auto;
        display: block;
    }

    .matchups {
        overflow-y: scroll;
    }

    .matchup {
        background: rgba(255, 255, 255, 0.05);
    }

    .icon-container {
        position: relative;
        background: white;
        width: 80px;
        height: 80px;
    }

    .player-icon {
        width: 70px;
        height: 70px;
        object-fit: cover;
    }

    .player-name {
        font-family: 'Teko', sans-serif;
        font-weight: 700;
        color: white;
    }

    .player-volume {
        font-family: 'Teko', sans-serif;
        font-weight: 400;
        color: #ccc;
    }

    .vs {
        font-family: 'Cafe Felix', 'Teko', sans-serif;
        font-weight: 700;
        text-transform: uppercase;
        position: relative;
        color: white;
        text-shadow: 2px 2px 3px rgba(0,0,0,0.5);
        letter-spacing: 3px;
        animation: vsPulse 2s infinite ease-in-out;
        transform: scale(1);
    }

    .action-button {
        position: relative;
        transform: skew(-10deg);
        transition: all 0.2s ease-out;
        letter-spacing: 0.05em;
    }

    .action-button span {
        display: block;
        transform: skew(10deg);
    }

    .your-pick {
        background: linear-gradient(to bottom, #4caf50 0%, #2e7d32 100%);
        box-shadow: 0 0 20px rgba(76, 175, 80, 0);
    }

    .your-pick:hover {
        background: linear-gradient(to bottom, #66bb6a 0%, #388e3c 100%);
        box-shadow: 0 0 20px rgba(76, 175, 80, 0.4), 0 4px 8px rgba(0, 0, 0, 0.2);
        transform: skew(-10deg) translateY(-2px);
    }

    .bet-button {
        background: linear-gradient(to bottom, #ffb74d 0%, #e65100 100%);
        box-shadow: 0 0 20px rgba(255, 183, 77, 0);
    }

    .bet-button:hover {
        background: linear-gradient(to bottom, #ffc77d 0%, #f57c00 100%);
        box-shadow: 0 0 20px rgba(255, 183, 77, 0.4), 0 4px 8px rgba(0, 0, 0, 0.2);
        transform: skew(-10deg) translateY(-2px);
    }

    .winner-indicator {
        position: absolute;
        top: -5px;
        left: -5px;
        background: gold;
        border: 2px solid white;
        padding: 2px;
        font-size: 1rem;
        line-height: 1;
    }

    @keyframes vsPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }

    /* Competition Information Styling */
    .competition-info {
        background: linear-gradient(135deg, rgba(33, 33, 33, 0.95), rgba(22, 22, 22, 0.9));
        position: relative;
        overflow: hidden;
        transform: skew(-5deg);
        box-shadow: 
            0 0 0 2px rgba(255, 255, 255, 0.1),
            0 0 20px rgba(79, 195, 247, 0.1);
    }

    .competition-info > * {
        transform: skew(5deg);
    }

    .competition-info::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, 
            transparent 0%,
            rgba(79, 195, 247, 0.1) 25%,
            rgba(79, 195, 247, 0.05) 50%,
            transparent 100%
        );
        transform: skew(5deg);
    }

    .competition-info::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(to bottom, #4fc3f7, #2196f3);
    }

    .competition-info h2 {
        font-family: 'Teko', sans-serif;
        text-transform: uppercase;
        text-shadow: 
            2px 2px 0 rgba(79, 195, 247, 0.5),
            -2px -2px 0 rgba(33, 150, 243, 0.5);
        position: relative;
        display: inline-block;
    }

    .competition-info h2::after {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, #4fc3f7, transparent);
    }

    .competition-info strong {
        color: #4fc3f7;
    }

    .competition-info li::before {
        content: '▸';
        position: absolute;
        left: 0;
        color: #ffa726;
        font-size: 1.4em;
        line-height: 1;
        text-shadow: 0 0 10px rgba(255, 167, 38, 0.5);
    }

    .my-bets-section {
        margin-top: 2rem;
    }

    .bet-card {
        transition: all 0.2s ease-out;
    }

    .bet-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .stat-card {
        transition: all 0.2s ease-out;
    }

    .stat-card:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.1);
    }

    @keyframes pulse-subtle {
        0% { opacity: 0.3; }
        50% { opacity: 0.5; }
        100% { opacity: 0.3; }
    }

    .animate-pulse-subtle {
        animation: pulse-subtle 3s ease-in-out infinite;
    }
</style>