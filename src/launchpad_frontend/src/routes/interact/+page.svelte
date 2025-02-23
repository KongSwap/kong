<script lang="ts">
    import { auth } from '$lib/services/auth';
    import { Principal } from '@dfinity/principal';
    import { createActor, idlFactory } from '../../../../declarations/token_backend';
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';

    // Store for the canister ID input
    let canisterId = '';
    let actor: any = null;
    let isValidCanisterId = false;

    // Store for function results
    const results = writable<{
        getInfo?: { 
            success: boolean; 
            data?: { 
                name: string; 
                ticker: string; 
                total_supply: number; 
                ledger_id: Principal | null 
            }; 
            error?: string 
        };
        submitSolution?: { 
            success: boolean; 
            error?: string;
            reward?: number;
        };
        startToken?: { 
            success: boolean; 
            ledger_id?: Principal; 
            error?: string 
        };
        getTarget?: {
            success: boolean;
            target?: number;
            error?: string;
        };
    }>({});

    // Game state
    let isInitialized = false;
    let currentTarget: number | null = null;
    let guessHistory: { guess: number; result: string; timestamp: number }[] = [];

    // Loading states
    let loadingGetInfo = false;
    let loadingSubmitSolution = false;
    let loadingStartToken = false;
    let loadingGetTarget = false;
    let solution = '';

    // Error state
    let error: string | null = null;

    // Authentication state
    let isAuthenticated = false;
    let principal: Principal | null = null;

    onMount(() => {
        const unsubscribe = auth.subscribe(($auth) => {
            isAuthenticated = $auth.isConnected;
            principal = $auth.account?.owner ?? null;
        });

        return unsubscribe;
    });

    // Validate canister ID and create actor
    async function updateCanisterId(id: string) {
        try {
            console.log('Updating canister ID:', id);
            canisterId = id;
            if (!id) {
                console.log('Empty canister ID, resetting state');
                isValidCanisterId = false;
                actor = null;
                return;
            }

            // Validate principal
            try {
                const principal = Principal.fromText(id);
                console.log('Valid principal created:', principal.toText());
            } catch (err) {
                console.error('Principal validation failed:', err);
                throw new Error(`Invalid principal format: ${err.message}`);
            }

            isValidCanisterId = true;
            console.log('Creating actor for canister:', id);

            try {
                // Create actor using auth.getActor with IDL
                actor = await auth.getActor(id, idlFactory, {
                    requiresSigning: true
                });
                console.log('Actor created successfully:', actor);
                
                // Validate actor methods
                if (!actor.get_info || typeof actor.get_info !== 'function') {
                    throw new Error('Actor missing get_info method');
                }
            } catch (err) {
                console.error('Actor creation failed:', err);
                throw new Error(`Failed to create actor: ${err.message}`);
            }

            // Check if token is initialized
            await checkInitialization();
        } catch (err) {
            console.error('updateCanisterId failed:', err);
            isValidCanisterId = false;
            actor = null;
            error = err instanceof Error ? err.message : 'Invalid canister ID';
        }
    }

    // Check if token is initialized
    async function checkInitialization() {
        try {
            console.log('Checking initialization...');
            const info = await getInfo();
            console.log('Got info:', info);
            
            // Type guard for info
            if (info && 'data' in info && info.data?.ledger_id !== null) {
                isInitialized = true;
                console.log('Token is initialized');
                await getTarget();
            } else {
                isInitialized = false;
                console.log('Token is not initialized');
            }
        } catch (err) {
            console.error('Failed to check initialization:', err);
            isInitialized = false;
        }
    }

    // Call get_info
    async function getInfo() {
        if (!actor) {
            console.log('No actor available for get_info');
            return null;
        }

        try {
            loadingGetInfo = true;
            error = null;
            console.log('Calling get_info on actor:', actor);
            
            const result = await actor.get_info();
            console.log('Raw get_info result:', result);
            
            if (!result) {
                throw new Error('Received null/undefined result from get_info');
            }

            if ('Ok' in result) {
                console.log('Successful get_info result:', result.Ok);
                const info = {
                    success: true,
                    data: {
                        name: result.Ok.name,
                        ticker: result.Ok.ticker,
                        total_supply: Number(result.Ok.total_supply),
                        ledger_id: result.Ok.ledger_id ? Principal.fromText(result.Ok.ledger_id) : null
                    }
                };
                results.update(r => ({
                    ...r,
                    getInfo: info
                }));
                return info;
            } else if ('Err' in result) {
                console.error('get_info returned error:', result.Err);
                const errorInfo = {
                    success: false,
                    error: result.Err
                };
                results.update(r => ({
                    ...r,
                    getInfo: errorInfo
                }));
                return errorInfo;
            } else {
                throw new Error(`Unexpected result format: ${JSON.stringify(result)}`);
            }
        } catch (err) {
            console.error('get_info failed:', err);
            error = err instanceof Error ? err.message : 'Failed to get info';
            return null;
        } finally {
            loadingGetInfo = false;
        }
    }

    // Call get_target
    async function getTarget() {
        if (!actor) return;

        try {
            loadingGetTarget = true;
            error = null;
            const result = await actor.get_target();
            
            if ('Ok' in result) {
                currentTarget = Number(result.Ok);
                results.update(r => ({
                    ...r,
                    getTarget: {
                        success: true,
                        target: currentTarget
                    }
                }));
            } else {
                results.update(r => ({
                    ...r,
                    getTarget: {
                        success: false,
                        error: result.Err
                    }
                }));
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to get target';
        } finally {
            loadingGetTarget = false;
        }
    }

    // Call submit_solution
    async function submitSolution() {
        if (!actor || !solution) return;

        try {
            loadingSubmitSolution = true;
            error = null;
            const guess = BigInt(solution);
            const result = await actor.submit_solution(guess);
            
            // Add to history
            guessHistory.unshift({
                guess: Number(guess),
                result: 'Ok' in result ? 'Correct! (+1 token)' : `Wrong: ${result.Err}`,
                timestamp: Date.now()
            });
            guessHistory = guessHistory.slice(0, 10); // Keep last 10 guesses

            if ('Ok' in result) {
                results.update(r => ({
                    ...r,
                    submitSolution: {
                        success: true,
                        reward: 1 // 1 token reward
                    }
                }));
                // Get new target after successful guess
                await getTarget();
            } else {
                results.update(r => ({
                    ...r,
                    submitSolution: {
                        success: false,
                        error: result.Err
                    }
                }));
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to submit solution';
        } finally {
            loadingSubmitSolution = false;
            solution = ''; // Clear input after submission
        }
    }

    // Call start_token
    async function startToken() {
        if (!actor) return;

        try {
            loadingStartToken = true;
            error = null;
            const result = await actor.start_token();
            
            if ('Ok' in result) {
                results.update(r => ({
                    ...r,
                    startToken: {
                        success: true,
                        ledger_id: result.Ok
                    }
                }));
                // Refresh info and get initial target after starting token
                await checkInitialization();
            } else {
                results.update(r => ({
                    ...r,
                    startToken: {
                        success: false,
                        error: result.Err
                    }
                }));
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to start token';
        } finally {
            loadingStartToken = false;
        }
    }

    // Format principal for display
    function formatPrincipal(principal: Principal): string {
        const text = principal.toText();
        if (text.length <= 12) return text;
        return `${text.slice(0, 6)}...${text.slice(-6)}`;
    }

    // Format timestamp
    function formatTimestamp(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString();
    }
</script>

<div class="min-h-screen p-8 bg-gradient-to-b from-gray-900 to-gray-800">
    <div class="max-w-4xl mx-auto">
        <header class="mb-12">
            <h1 class="text-4xl font-bold tracking-tight text-white">Token Mining Game</h1>
            <p class="mt-4 text-lg text-gray-400">Mine tokens by guessing the correct number. Each correct guess earns you 1 token!</p>
        </header>

        {#if !isAuthenticated}
            <div class="p-12 text-center border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                <p class="text-lg text-gray-300">Please connect your wallet to start mining tokens.</p>
            </div>
        {:else}
            <div class="space-y-8">
                <!-- Canister ID Input -->
                <div class="p-6 border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                    <h2 class="mb-4 text-xl font-semibold text-white">Select Token Canister</h2>
                    <div class="space-y-4">
                        <input
                            type="text"
                            bind:value={canisterId}
                            on:input={(e) => updateCanisterId(e.currentTarget.value)}
                            placeholder="Enter token canister ID"
                            class="w-full px-4 py-3 text-base font-medium text-white transition-all border rounded-lg bg-gray-900/50 border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                        />
                        {#if error}
                            <p class="text-sm text-red-400">{error}</p>
                        {/if}
                    </div>
                </div>

                {#if isValidCanisterId && actor}
                    <div class="space-y-6">
                        <!-- Token Info -->
                        <div class="p-6 border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold text-white">Token Information</h3>
                                <button
                                    on:click={getInfo}
                                    disabled={loadingGetInfo}
                                    class="px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {#if loadingGetInfo}
                                        <div class="flex items-center gap-2">
                                            <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading...
                                        </div>
                                    {:else}
                                        Refresh Info
                                    {/if}
                                </button>
                            </div>

                            {#if $results.getInfo}
                                <div class="p-4 mt-4 space-y-2 rounded-lg bg-gray-900/50">
                                    {#if $results.getInfo.success && $results.getInfo.data}
                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <div class="text-sm font-medium text-gray-400">Name</div>
                                                <div class="mt-1 text-sm text-white">{$results.getInfo.data.name}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm font-medium text-gray-400">Ticker</div>
                                                <div class="mt-1 text-sm text-white">{$results.getInfo.data.ticker}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm font-medium text-gray-400">Total Supply</div>
                                                <div class="mt-1 text-sm text-white">{$results.getInfo.data.total_supply}</div>
                                            </div>
                                            {#if $results.getInfo.data.ledger_id}
                                                <div>
                                                    <div class="text-sm font-medium text-gray-400">Ledger ID</div>
                                                    <div class="mt-1 text-sm text-white">{formatPrincipal($results.getInfo.data.ledger_id)}</div>
                                                </div>
                                            {/if}
                                        </div>
                                    {:else}
                                        <p class="text-sm text-red-400">{$results.getInfo.error}</p>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <!-- Token Initialization -->
                        {#if !isInitialized}
                            <div class="p-6 border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                                <div class="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 class="text-lg font-semibold text-white">Initialize Token</h3>
                                        <p class="mt-1 text-sm text-gray-400">Start the token to begin mining. This only needs to be done once.</p>
                                    </div>
                                    <button
                                        on:click={startToken}
                                        disabled={loadingStartToken}
                                        class="px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {#if loadingStartToken}
                                            <div class="flex items-center gap-2">
                                                <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Initializing...
                                            </div>
                                        {:else}
                                            Initialize Token
                                        {/if}
                                    </button>
                                </div>

                                {#if $results.startToken}
                                    <div class="p-4 mt-4 rounded-lg bg-gray-900/50">
                                        {#if $results.startToken.success}
                                            <p class="text-sm text-green-400">Token initialized successfully! You can now start mining.</p>
                                        {:else}
                                            <p class="text-sm text-red-400">{$results.startToken.error}</p>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Mining Interface -->
                        {#if isInitialized}
                            <div class="p-6 border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-white">Mine Tokens</h3>
                                    <p class="mt-1 text-sm text-gray-400">Guess the target number to earn tokens. Each correct guess earns you 1 token!</p>
                                </div>

                                <!-- Current Target (Development Only) -->
                                {#if $results.getTarget}
                                    <div class="p-4 mb-4 rounded-lg bg-gray-900/50">
                                        {#if $results.getTarget.success}
                                            <div class="text-sm font-medium text-gray-400">Current Target (Development Only)</div>
                                            <div class="mt-1 text-sm text-white">{$results.getTarget.target}</div>
                                        {:else}
                                            <p class="text-sm text-red-400">{$results.getTarget.error}</p>
                                        {/if}
                                    </div>
                                {/if}
                                
                                <div class="space-y-4">
                                    <input
                                        type="text"
                                        bind:value={solution}
                                        placeholder="Enter your guess (1-10)"
                                        class="w-full px-4 py-3 text-base font-medium text-white transition-all border rounded-lg bg-gray-900/50 border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />

                                    <div class="flex justify-end">
                                        <button
                                            on:click={submitSolution}
                                            disabled={loadingSubmitSolution || !solution}
                                            class="px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {#if loadingSubmitSolution}
                                                <div class="flex items-center gap-2">
                                                    <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Submitting...
                                                </div>
                                            {:else}
                                                Submit Guess
                                            {/if}
                                        </button>
                                    </div>

                                    {#if $results.submitSolution}
                                        <div class="p-4 mt-4 rounded-lg bg-gray-900/50">
                                            {#if $results.submitSolution.success}
                                                <p class="text-sm text-green-400">
                                                    Congratulations! You earned {$results.submitSolution.reward} token(s)!
                                                </p>
                                            {:else}
                                                <p class="text-sm text-red-400">{$results.submitSolution.error}</p>
                                            {/if}
                                        </div>
                                    {/if}

                                    <!-- Guess History -->
                                    {#if guessHistory.length > 0}
                                        <div class="mt-6">
                                            <h4 class="mb-3 text-sm font-medium text-gray-400">Recent Guesses</h4>
                                            <div class="space-y-2">
                                                {#each guessHistory as {guess, result, timestamp}}
                                                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                                                        <div class="flex items-center gap-3">
                                                            <span class="text-sm font-medium text-white">Guess: {guess}</span>
                                                            <span class="text-sm {result.includes('Correct') ? 'text-green-400' : 'text-red-400'}">
                                                                {result}
                                                            </span>
                                                        </div>
                                                        <span class="text-xs text-gray-500">{formatTimestamp(timestamp)}</span>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Add debug info section -->
        {#if error || (isValidCanisterId && actor)}
            <div class="p-6 mt-4 border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                <h3 class="mb-4 text-lg font-semibold text-white">Debug Information</h3>
                <div class="space-y-2 font-mono text-sm">
                    <div class="p-2 rounded bg-gray-900/50">
                        <div class="text-gray-400">Canister ID:</div>
                        <div class="text-white break-all">{canisterId || 'None'}</div>
                    </div>
                    <div class="p-2 rounded bg-gray-900/50">
                        <div class="text-gray-400">Valid Canister ID:</div>
                        <div class="text-white">{isValidCanisterId.toString()}</div>
                    </div>
                    <div class="p-2 rounded bg-gray-900/50">
                        <div class="text-gray-400">Actor Created:</div>
                        <div class="text-white">{actor ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="p-2 rounded bg-gray-900/50">
                        <div class="text-gray-400">Is Initialized:</div>
                        <div class="text-white">{isInitialized.toString()}</div>
                    </div>
                    {#if error}
                        <div class="p-2 rounded bg-gray-900/50">
                            <div class="text-red-400">Error:</div>
                            <div class="text-red-300 break-all">{error}</div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div> 
