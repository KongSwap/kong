<script lang="ts"> 
	import { formatUsdValue } from '$lib/utils/tokenFormatters';
	import { fetchTokensByCanisterId } from '$lib/api/tokens';
    import { onMount } from 'svelte';
    import { Check, Coins, AlertTriangle } from 'lucide-svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import { calculateUsdValue } from '$lib/utils/liquidityUtils';

    let tokens: any[] = [];

    onMount(async () => {
        tokens = await fetchTokensByCanisterId(['7pail-xaaaa-aaaas-aabmq-cai', 'pcj6u-uaaaa-aaaak-aewnq-cai', 'gemj7-oyaaa-aaaaq-aacnq-cai', 'druyg-tyaaa-aaaaq-aactq-cai', 'rh2pm-ryaaa-aaaan-qeniq-cai', 'oj6if-riaaa-aaaaq-aaeha-cai', 'fw6jm-nqaaa-aaaam-qcchq-cai', 'ixraq-4iaaa-aaaam-qci5q-cai']);
    });

    $: matchups = [
        {
            player1: tokens.find(token => token.symbol === 'BOB'),
            player2: tokens.find(token => token.symbol === 'McDOMS'),
            hasBet: true,
            pickedLeft: true
        },
        {
            player1: tokens.find(token => token.symbol === 'CLOUD'),
            player2: tokens.find(token => token.symbol === 'PONZI'),
            hasBet: false
        },
        {
            player1: tokens.find(token => token.symbol === 'ELNA'),
            player2: tokens.find(token => token.symbol === 'PANDA'),
            hasBet: false
        },
        {
            player1: tokens.find(token => token.symbol === 'ALICE'),
            player2: tokens.find(token => token.symbol === 'EXE'),
            hasBet: true,
            pickedLeft: false
        }
    ];

    // Add navigation state
    let currentRound = 1;

    let showModal = false;
    let selectedToken: any = null;
    let opponent: any = null;

    function openModal(token: any) {
        selectedToken = token;
        opponent = matchups.find(match => 
            match.player1?.symbol === token.symbol || match.player2?.symbol === token.symbol
        );
        showModal = true;
    }

    function closeModal() {
        showModal = false;
    }

    // Add state for odds calculation
    let potentialWinnings = 0;
    let odds = 0;

    // Add pool state
    let poolSize = 0;
    let opponentPoolSize = 0;

    // Update odds calculation to use pool sizes
    function calculateOdds(token1Volume: number, token2Volume: number, token1Pool: number, token2Pool: number): number {
        // Use both volume and pool size to calculate odds
        const totalPool = token1Pool + token2Pool;
        if (totalPool === 0) {
            // If no bets yet, use volume for initial odds
            const totalVolume = token1Volume + token2Volume;
            if (totalVolume === 0) return 2; // Default 1:1 odds
            const probability = token1Volume / totalVolume;
            return probability > 0 ? 1 / probability : 2;
        }
        // Calculate odds based on pool size
        const probability = token1Pool / totalPool;
        return probability > 0 ? 1 / probability : 2;
    }

    // Calculate potential winnings based on pool sizes
    function calculatePotentialWinnings(amount: number, currentPool: number, opposingPool: number): number {
        // Your bet plus your proportional share of the opposing pool
        // proportion = (your_bet) / (current_pool + your_bet)
        const proportion = amount / (currentPool + amount);
        return amount + (proportion * opposingPool);
    }

    // Update bet form state and submit handler
    let betAmount = 0;
    let showConfirmation = false;

    $: if (betAmount && selectedToken) {
        if (opponent) {
            const opponentToken = opponent.player1?.symbol === selectedToken.symbol ? opponent.player2 : opponent.player1;
            
            // For demo, using mock pool sizes - replace with actual pool sizes from your backend
            poolSize = 100; // Mock value
            opponentPoolSize = 150; // Mock value
            
            odds = calculateOdds(
                selectedToken.metrics?.volume_24h || 0,
                opponentToken.metrics?.volume_24h || 0,
                poolSize,
                opponentPoolSize
            );
            potentialWinnings = calculatePotentialWinnings(betAmount, poolSize, opponentPoolSize);
        }
    }

    function handleBetSubmit(event: Event) {
        event.preventDefault();
        showConfirmation = true;
    }

    function confirmBet() {
        console.log('Bet confirmed with amount:', betAmount);
        showConfirmation = false;
        closeModal();
    }
</script>

<svelte:head>
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
                        </div>
                    </div>
                </div>

                <div class="vs text-3xl md:text-6xl mx-0 my-4 md:mx-8 md:my-0">VS</div>

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
                    <li>All bets are pooled together for each token</li>
                    <li>If your token wins, you get your bet back plus a share of the losing pool</li>
                    <li>Your share is proportional to your bet size vs the total winning pool</li>
                    <li>Bets are final once placed</li>
                    <li>{selectedToken.symbol} Pool: {poolSize} KONG</li>
                    {#if opponent}
                        <li>{opponent.player1?.symbol === selectedToken.symbol ? opponent.player2?.symbol : opponent.player1?.symbol} Pool: {opponentPoolSize} KONG</li>
                    {/if}
                </ul>
            </div>

            {#if !showConfirmation}
                <form on:submit|preventDefault={handleBetSubmit} class="flex flex-col gap-4">
                    <div class="bet-info bg-gray-800/50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-3">
                            <span class="text-sm text-kong-text-secondary">Current Pool Ratio</span>
                            <span class="text-lg font-bold text-kong-text-primary">{poolSize} : {opponentPoolSize}</span>
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
                                    <span class="text-lg font-bold text-green-400">{potentialWinnings.toFixed(2)} KONG</span>
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
                            <span class="text-kong-text-primary font-bold">{betAmount} KONG</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Token</span>
                            <span class="text-kong-text-primary font-bold">{selectedToken.symbol}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Current Pool Size</span>
                            <span class="text-kong-text-primary font-bold">{poolSize} KONG</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-kong-text-secondary">Potential Winnings</span>
                            <div class="text-right">
                                <span class="text-green-400 font-bold">{potentialWinnings.toFixed(2)} KONG</span>
                                <p class="text-xs text-kong-text-secondary">({((potentialWinnings/betAmount - 1) * 100).toFixed(1)}% return)</p>
                            </div>
                        </div>
                    </div>
                    
                  
                </div>
                  <div class="flex gap-3 mt-6">
                        <button 
                            class="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition-all"
                            on:click={() => showConfirmation = false}
                        >
                            Back
                        </button>
                        <button 
                            class="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-600 transition-all"
                            on:click={confirmBet}
                        >
                            Confirm Bet
                        </button>
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
</style>