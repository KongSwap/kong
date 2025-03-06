<script lang="ts">
    import { onMount } from 'svelte';
    import { canisterStore, type CanisterMetadata } from '$lib/stores/canisters';
    import { auth } from '$lib/services/auth';
    import { Principal } from '@dfinity/principal';
    import { InstallService, type WasmMetadata, agent, getICManagementActor } from '$lib/services/canister/install_wasm';
    import { idlFactory as icManagementIdlFactory } from '$lib/services/canister/ic-management.idl';
    import Canister from './Canister.svelte';
    import KongInterface from './KongInterface.svelte';
    import { goto } from '$app/navigation';
    import KongInterfaceModal from './KongInterfaceModal.svelte';
    import { fade, fly } from 'svelte/transition';
    import { registerCanister } from '$lib/api/canisters';
    import { toastStore } from '$lib/stores/toastStore';

    // Available WASM types
    const AVAILABLE_WASMS: Record<string, WasmMetadata> = {
        'token_backend': {
            path: '/wasms/token_backend/token_backend.wasm.gz',
            description: 'Token implementation canister',
            initArgsType: null
        },
        'ledger': {
            path: '/wasms/ledger/ledger.wasm',
            description: 'Ledger canister',
            initArgsType: null
        },
        'miner': {
            path: '/wasms/miner/miner.wasm',
            description: 'Miner canister',
            initArgsType: null
        }
    };

    // WASM versions - increment these when new versions are available
    // These version numbers are used to determine if a canister has an upgrade available
    // When a new WASM version is released, increment the corresponding version number here
    // and the UI will automatically show an upgrade notification for affected canisters
    // current: token_backend: 1, ledger: 1, miner: 1
    const WASM_VERSIONS: Record<string, number> = {
        'token_backend': 1,
        'ledger': 1,
        'miner': 1
    };

    // UI state
    let canisters: CanisterMetadata[] = [];
    let editingCanister: CanisterMetadata | null = null;
    let newName = '';
    let newTags = '';
    let principal: Principal | null = null;
    let newCanisterId = '';
    let newCanisterType = '';
    let showAddModal = false;
    let addError = '';
    
    // Filter state
    let selectedFilter = 'miner'; // Default to showing miners
    let showHidden = false;
    let searchQuery = '';
    
    // Filtered canisters
    $: filteredCanisters = canisters.filter(canister => {
        // Filter by hidden status
        if (!showHidden && canister.hidden) return false;
        
        // Filter by type
        if (selectedFilter && selectedFilter !== 'all') {
            if (canister.wasmType !== selectedFilter) return false;
        }
        
        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const name = (canister.name || '').toLowerCase();
            const id = canister.id.toLowerCase();
            const tags = canister.tags ? canister.tags.join(' ').toLowerCase() : '';
            
            if (!name.includes(query) && !id.includes(query) && !tags.includes(query)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Install WASM state
    let showInstallModal = false;
    let selectedCanisterId: string | null = null;
    let selectedWasm = '';
    let installing = false;
    let installError: string | null = null;
    
    // Kong Agent state
    let showKongAgent = false;
    let kongAgentCanisterId: string | null = null;
    let kongAgentWasmType: string | null = null;
    
    // Canister status tracking
    interface CanisterStatus {
        status: 'running' | 'stopping' | 'stopped';
        memorySize: bigint;
        cycles: bigint;
        moduleHash?: Uint8Array;
        settings?: any;
        idleCyclesBurnedPerDay?: bigint;
        queryStats?: any;
        controllers?: Principal[];
        recentChanges?: any[];
        totalChanges?: bigint;
        noWasmModule?: boolean;
    }
    
    let canisterStatuses: Record<string, CanisterStatus | null> = {};
    let loadingStatuses: Record<string, boolean> = {};
    let statusErrors: Record<string, string | null> = {};

    // Animation for the hidden canisters button
    let pulseHiddenButton = false;
    
    // Toggle the pulse animation every 3 seconds if there are hidden canisters
    $: hiddenCanistersCount = canisters.filter(c => c.hidden).length;

    // Format helpers
    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }
    
    function formatCycles(cycles: bigint): string {
        const num = Number(cycles);
        if (num >= 1e12) {
            return `${(num / 1e12).toFixed(2)}T`;
        } else if (num >= 1e9) {
            return `${(num / 1e9).toFixed(2)}B`;
        } else if (num >= 1e6) {
            return `${(num / 1e6).toFixed(2)}M`;
        }
        return num.toString();
    }
    
    function formatMemorySize(bytes: bigint | undefined): string {
        if (!bytes || bytes === 0n) return 'No memory allocated';
        const mb = Number(bytes) / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }
    
    function formatStatus(status: string | undefined): string {
        if (!status) return 'Unknown';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    // Editing functions
    function startEdit(event: CustomEvent) {
        const canister = event.detail.canister;
        editingCanister = canister;
        newName = canister.name || '';
        newTags = canister.tags ? canister.tags.join(', ') : '';
    }

    function handleTopUp(event: CustomEvent) {
        const canisterId = event.detail.id;
        // Redirect to the top-up page with the canister ID
        goto(`/launch/top-up?canisterId=${canisterId}`);
    }

    function saveEdit() {
        if (!editingCanister) return;

        const updates: Partial<CanisterMetadata> = {
            name: newName || undefined,
            tags: newTags ? newTags.split(',').map(t => t.trim()).filter(t => t) : undefined
        };

        canisterStore.updateCanister(editingCanister.id, updates);
        editingCanister = null;
    }

    function cancelEdit() {
        editingCanister = null;
        newName = '';
        newTags = '';
    }

    function hideCanister(event: CustomEvent) {
        const id = event.detail.id;
        const canister = canisters.find(c => c.id === id);
        
        if (canister) {
            if (canister.hidden) {
                // If already hidden, show it
                canisterStore.showCanister(id);
            } else {
                // If visible, hide it
                canisterStore.hideCanister(id);
            }
        }
    }
    
    function toggleShowHidden() {
        showHidden = !showHidden;
    }

    // Add custom canister
    function showAddCanisterModal() {
        newCanisterId = '';
        newCanisterType = '';
        addError = '';
        showAddModal = true;
    }
    
    function closeAddModal() {
        showAddModal = false;
    }
    
    async function addCustomCanister() {
        try {
            // Validate canister ID
            const canisterId = newCanisterId.trim();
            Principal.fromText(canisterId); // Will throw if invalid
            
            // Add to store
            canisterStore.addCanister({
                id: canisterId,
                createdAt: Date.now(),
                wasmType: newCanisterType || undefined // Include the selected type if provided
            });
            
            // Register the canister with the API
            if (principal && newCanisterType) {
                try {
                    const registerResult = await registerCanister(
                        principal,
                        canisterId,
                        newCanisterType === 'miner' ? 'miner' : 'token_backend'
                    );
                    
                    if (registerResult.success) {
                        toastStore.success('Canister registered successfully');
                    } else {
                        toastStore.error(`Failed to register canister: ${registerResult.error}`);
                    }
                } catch (registerError) {
                    console.error('Error registering canister:', registerError);
                    toastStore.error('Failed to register canister with API');
                }
            }
            
            // Close modal and fetch status
            closeAddModal();
            fetchCanisterStatus(canisterId);
        } catch (error) {
            addError = error instanceof Error ? error.message : 'Invalid canister ID';
        }
    }

    // Install WASM functions
    function openInstallModal(event: CustomEvent) {
        selectedCanisterId = event.detail.id;
        selectedWasm = '';
        installError = null;
        
        // Check if this is an upgrade or a fresh install
        const canister = canisters.find(c => c.id === selectedCanisterId);
        const isUpgrade = canister && canister.wasmType;
        
        // If it's an upgrade, pre-select the current WASM type
        if (isUpgrade && canister.wasmType) {
            selectedWasm = canister.wasmType;
        }
        
        showInstallModal = true;
    }

    function closeInstallModal() {
        showInstallModal = false;
        selectedCanisterId = null;
        selectedWasm = '';
    }

    // Kong Agent functions
    function openKongAgent(event: CustomEvent) {
        kongAgentCanisterId = event.detail.id;
        kongAgentWasmType = event.detail.wasmType;
        showKongAgent = true;
    }
    
    function closeKongAgent() {
        showKongAgent = false;
        kongAgentCanisterId = null;
        kongAgentWasmType = null;
    }

    async function installWasm() {
        if (!selectedCanisterId || !selectedWasm) {
            installError = 'Please select a WASM file to install';
            return;
        }

        await InstallService.clearChunkStore(selectedCanisterId);

        try {
            installing = true;
            installError = null;
            
            const wasmMetadata = AVAILABLE_WASMS[selectedWasm];
            console.log("Selected WASM metadata:", wasmMetadata);
            
            console.log(`Using chunked upload for WASM installation`);
            await InstallService.installWasm(selectedCanisterId, wasmMetadata);
            
            // Update canister metadata with WASM type
            canisterStore.updateCanister(selectedCanisterId, {
                wasmType: selectedWasm
            });
            
            // Refresh status
            fetchCanisterStatus(selectedCanisterId);
            
            // Close modal
            closeInstallModal();
        } catch (error) {
            console.error("WASM installation error:", error);
            installError = error instanceof Error ? error.message : String(error);
        } finally {
            installing = false;
        }
    }

    // Helper function to check if a canister has a newer version available
    function hasNewerVersion(canister: CanisterMetadata): boolean {
        // If no WASM type is set, we can't determine if there's a newer version
        if (!canister.wasmType) return false;
        
        // If the canister has a wasmVersion property and it's less than the current version,
        // then a newer version is available
        const currentVersion = canister.wasmVersion || 0;
        const latestVersion = WASM_VERSIONS[canister.wasmType] || 0;
        
        return currentVersion < latestVersion;
    }

    // When upgrading, update the wasmVersion to the latest
    async function upgradeWasm() {
        if (!selectedCanisterId || !selectedWasm) {
            installError = 'Please select a WASM file to upgrade to';
            return;
        }

        await InstallService.clearChunkStore(selectedCanisterId);

        try {
            installing = true;
            installError = null;
            
            const wasmMetadata = AVAILABLE_WASMS[selectedWasm];
            console.log("Selected WASM metadata for upgrade:", wasmMetadata);
            
            console.log(`Upgrading canister with new WASM`);
            await InstallService.upgradeWasm(selectedCanisterId, wasmMetadata);
            
            // Update canister metadata with WASM type and version
            canisterStore.updateCanister(selectedCanisterId, {
                wasmType: selectedWasm,
                wasmVersion: WASM_VERSIONS[selectedWasm] || 1
            });
            
            // Refresh status
            fetchCanisterStatus(selectedCanisterId);
            
            // Close modal
            closeInstallModal();
        } catch (error) {
            console.error("WASM upgrade error:", error);
            installError = error instanceof Error ? error.message : String(error);
        } finally {
            installing = false;
        }
    }

    // Fetch canister status
    async function fetchCanisterStatus(canisterId: string) {
        loadingStatuses[canisterId] = true;
        statusErrors[canisterId] = null;
        console.log(agent)
        
        try {
            // Try to get status directly
            let management = await getICManagementActor();
            console.log("Management actor:", management);
            
            try {
                const response = await management.canisterStatus(Principal.fromText(canisterId));

                console.log("Canister status response:", response);
                canisterStatuses[canisterId] = {
                    status: 'running' in response.status ? 'running' 
                        : 'stopping' in response.status ? 'stopping'
                        : 'stopped',
                    memorySize: response.memory_size,
                    cycles: response.cycles,
                    moduleHash: response.module_hash?.[0],
                    settings: response.settings,
                    idleCyclesBurnedPerDay: response.idle_cycles_burned_per_day,
                    queryStats: response.query_stats
                };
            } catch (statusError) {
                // Check for specific error types
                const errorStr = String(statusError);
                if (errorStr.includes('IC0537') || errorStr.includes('no wasm module')) {
                    console.log("Canister has no WASM module, trying canister_info instead");
                    console.log("Full error object:", statusError);
                    
                    // Try to extract cycles from the error response
                    let cycles = 0n;
                    
                    // The IC response often contains the cycles in the message
                    try {
                        // Different ways the cycles might be stored in the error
                        if (statusError.response?.cycles) {
                            cycles = statusError.response.cycles;
                        } else if (statusError.message && typeof statusError.message === 'string') {
                            // Try to extract cycles from error message which might contain JSON
                            const jsonMatch = statusError.message.match(/\{.*\}/);
                            if (jsonMatch) {
                                try {
                                    const jsonData = JSON.parse(jsonMatch[0]);
                                    if (jsonData.cycles) {
                                        cycles = BigInt(jsonData.cycles);
                                    }
                                } catch (e) {
                                    console.error("Failed to parse JSON from error message", e);
                                }
                            }
                            
                            // Try to extract cycles using regex
                            const cyclesMatch = statusError.message.match(/cycles:\s*(\d+)/i);
                            if (cyclesMatch && cyclesMatch[1]) {
                                cycles = BigInt(cyclesMatch[1]);
                            }
                        } else if (statusError.error_code === "IC0537" && statusError.reject_message) {
                            console.log("Reject message:", statusError.reject_message);
                            // Try to extract from reject_message which may contain cycles info
                        }
                    } catch (e) {
                        console.error("Couldn't extract cycles from error", e);
                    }
                    
                    console.log("Extracted cycles:", cycles.toString());
                    
                    try {
                        // Try to get canister info which works even without a WASM module
                        const infoResponse = await management.canister_info({
                            canister_id: Principal.fromText(canisterId),
                            num_requested_changes: []
                        });
                        
                        console.log("Canister info response:", infoResponse);
                        
                        // No WASM module installed - show status but indicate no WASM
                        canisterStatuses[canisterId] = {
                            status: 'running', // Assume it's running since it exists
                            memorySize: 0n,    // No WASM = no memory usage
                            cycles: cycles,
                            controllers: infoResponse.controllers,
                            noWasmModule: true
                        };
                        
                        // Set a more informative message
                        statusErrors[canisterId] = "This canister exists but has no WASM module installed yet.";
                    } catch (infoError) {
                        // No WASM module installed - show status but indicate no WASM
                        canisterStatuses[canisterId] = {
                            status: 'running', // Assume it's running since it exists
                            memorySize: 0n,    // No WASM = no memory usage
                            cycles: cycles,
                            noWasmModule: true
                        };
                        
                        statusErrors[canisterId] = "This canister exists but has no WASM module installed yet.";
                    }
                } else if (errorStr.includes('canister_not_found') || errorStr.includes('Only controllers') || errorStr.includes('IC0512')) {
                    // Set a more user-friendly error message
                    statusErrors[canisterId] = "You need controller access to view detailed status. You can still view it on the IC Dashboard.";
                    
                    // Set a minimal status so the UI shows something
                    canisterStatuses[canisterId] = {
                        status: 'running', // Assume it's running since it exists
                        memorySize: 0n,
                        cycles: 0n
                    };
                } else {
                    statusErrors[canisterId] = errorStr;
                }
            }
        } catch (error) {
            statusErrors[canisterId] = String(error);
        } finally {
            loadingStatuses[canisterId] = false;
        }
    }

    // Initialize
    onMount(() => {
        const unsubscribe = auth.subscribe(($auth) => {
            if ($auth.isConnected && $auth.account?.owner) {
                principal = Principal.fromText($auth.account.owner.toText());
            } else {
                principal = null;
            }
        });

        const canisterUnsubscribe = canisterStore.subscribe((updatedCanisters) => {
            canisters = updatedCanisters;
            // Fetch status for any new canisters
            updatedCanisters.forEach(canister => {
                if (!canisterStatuses[canister.id]) {
                    fetchCanisterStatus(canister.id);
                }
            });
        });

        // Set up pulse animation for hidden canisters button
        const pulseInterval = setInterval(() => {
            if (!showHidden && hiddenCanistersCount > 0) {
                pulseHiddenButton = true;
                setTimeout(() => {
                    pulseHiddenButton = false;
                }, 1000);
            }
        }, 5000);

        return () => {
            unsubscribe();
            canisterUnsubscribe();
            clearInterval(pulseInterval);
        };
    });
</script>

<style>
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.7);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(147, 51, 234, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(147, 51, 234, 0);
        }
    }
    
    .pulse {
        animation: pulse 1.5s ease-out;
    }
</style>

<div class="container px-4 py-8 mx-auto">
    {#if !principal}
        <div class="p-8 text-center bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg backdrop-blur-sm">
            <p class="text-lg text-gray-300">Please connect your wallet to view your canisters.</p>
        </div>
    {:else if canisters.length === 0}
        <div class="p-8 text-center bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg backdrop-blur-sm">
            <p class="mb-4 text-lg text-gray-300">You haven't created any canisters yet.</p>
            <div class="flex justify-center gap-4">
                <a href="/launch/create-token" class="px-4 py-2 text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700">
                    Create Proof of Work Token
                </a>
                <a href="/launch/create-miner" class="px-4 py-2 text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    Create Miner
                </a>
            </div>
        </div>
    {:else}
        <!-- Filter Controls -->
        <div class="p-4 mb-6 border border-gray-700 rounded-lg bg-gray-800/50 backdrop-blur-sm">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <!-- Type Filter -->
                <div class="flex flex-wrap gap-2">
                    <button 
                        on:click={() => selectedFilter = 'all'}
                        class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                    >
                        All
                    </button>
                    <button 
                        on:click={() => selectedFilter = 'miner'}
                        class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'miner' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                    >
                        Miners
                    </button>
                    <button 
                        on:click={() => selectedFilter = 'token_backend'}
                        class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'token_backend' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                    >
                        Tokens
                    </button>
                    <button 
                        on:click={() => selectedFilter = 'ledger'}
                        class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'ledger' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                    >
                        Ledgers
                    </button>
                </div>
                
                <!-- Search, Hidden Toggle, and Add Existing Canister -->
                <div class="flex flex-col gap-2 sm:flex-row">
                    <div class="relative">
                        <input 
                            type="text" 
                            bind:value={searchQuery} 
                            placeholder="Search canisters..." 
                            class="w-full px-3 py-2 pl-9 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                    
                    <button 
                        on:click={toggleShowHidden}
                        class="px-3 py-2 text-sm transition-colors rounded-md {showHidden ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} flex items-center {!showHidden && hiddenCanistersCount > 0 && pulseHiddenButton ? 'pulse' : ''}"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                            {#if showHidden}
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            {:else}
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            {/if}
                        </svg>
                        {showHidden ? 'Hide Hidden Canisters' : 'Show Hidden Canisters'}
                        {#if !showHidden && canisters.filter(c => c.hidden).length > 0}
                            <span class="ml-2 px-2 py-0.5 text-xs bg-purple-500 text-white rounded-full">
                                {canisters.filter(c => c.hidden).length}
                            </span>
                        {/if}
                    </button>
                    
                    <button 
                        on:click={showAddCanisterModal}
                        class="px-3 py-2 text-sm transition-colors rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Existing
                    </button>
                </div>
            </div>
            
            <!-- Stats -->
            <div class="mt-4 text-sm text-gray-400">
                Showing {filteredCanisters.length} of {canisters.length} canisters
                {#if canisters.filter(c => c.hidden).length > 0}
                    <span class="ml-2">
                        (<span class="{!showHidden ? 'text-purple-400 font-medium' : ''}">{canisters.filter(c => c.hidden).length} hidden</span>)
                        {#if !showHidden && canisters.filter(c => c.hidden).length > 0}
                            <button 
                                on:click={toggleShowHidden}
                                class="ml-2 text-xs text-purple-400 hover:text-purple-300 underline"
                            >
                                Show hidden
                            </button>
                        {/if}
                    </span>
                {/if}
            </div>
        </div>
        
        {#if filteredCanisters.length === 0}
            <div class="p-8 text-center bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg backdrop-blur-sm">
                <p class="text-lg text-gray-300">No canisters match your current filters.</p>
                {#if !showHidden && canisters.some(c => c.hidden)}
                    <button 
                        on:click={toggleShowHidden}
                        class="px-4 py-2 mt-4 text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700"
                    >
                        Show Hidden Canisters
                    </button>
                {/if}
            </div>
        {:else}
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {#each filteredCanisters as canister (canister.id)}
                    <div in:fly={{ y: 20, duration: 300, delay: 100 }} out:fade={{ duration: 200 }}>
                        <Canister 
                            canister={canister}
                            canisterStatus={canisterStatuses[canister.id]}
                            statusError={statusErrors[canister.id]}
                            loadingStatus={loadingStatuses[canister.id]}
                            isEditing={editingCanister?.id === canister.id}
                            newName={newName}
                            newTags={newTags}
                            hasUpgrade={hasNewerVersion(canister)}
                            on:edit={startEdit}
                            on:save={saveEdit}
                            on:cancel={cancelEdit}
                            on:hide={hideCanister}
                            on:refresh-status={(e) => fetchCanisterStatus(e.detail.id)}
                            on:install-wasm={openInstallModal}
                            on:top-up={handleTopUp}
                            on:open-kong-agent={openKongAgent}
                        />
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<!-- Add Canister Modal -->
{#if showAddModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
        <div class="w-full max-w-md p-6 bg-gray-800 border border-gray-700 rounded-lg backdrop-blur-sm">
            <h2 class="mb-4 text-xl font-bold text-white">Add Existing Canister</h2>
            
            <div class="mb-4">
                <label class="block mb-1 text-sm font-medium text-gray-300">Canister ID</label>
                <input 
                    type="text" 
                    bind:value={newCanisterId} 
                    placeholder="Enter canister ID" 
                    class="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {#if addError}
                    <p class="mt-1 text-sm text-red-400">{addError}</p>
                {/if}
            </div>
            
            <div class="mb-4">
                <label class="block mb-1 text-sm font-medium text-gray-300">Canister Type</label>
                <select 
                    bind:value={newCanisterType}
                    class="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="">-- Select Type (Optional) --</option>
                    {#each Object.entries(AVAILABLE_WASMS) as [key, wasm]}
                        <option value={key}>{wasm.description}</option>
                    {/each}
                </select>
                <p class="mt-1 text-xs text-gray-400">Selecting the correct type helps Kong Agent provide appropriate functionality.</p>
            </div>
            
            <div class="flex justify-end space-x-2">
                <button 
                    on:click={closeAddModal} 
                    class="px-4 py-2 text-gray-300 transition-colors bg-gray-700 rounded-md hover:bg-gray-600"
                >
                    Cancel
                </button>
                <button 
                    on:click={addCustomCanister} 
                    class="px-4 py-2 text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                    Add Canister
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Install WASM Modal -->
{#if showInstallModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
        <div class="w-full max-w-md p-6 bg-gray-800 border border-gray-700 rounded-lg backdrop-blur-sm">
            {#if canisters.find(c => c.id === selectedCanisterId)?.wasmType}
                <h2 class="mb-4 text-xl font-bold text-white">Upgrade Canister</h2>
            {:else}
                <h2 class="mb-4 text-xl font-bold text-white">Install WASM</h2>
            {/if}
            
            <div class="mb-4">
                <label class="block mb-2 text-sm font-medium text-gray-300">Select WASM to upgrade to</label>
                <select 
                    bind:value={selectedWasm}
                    class="w-full px-3 py-2 text-gray-800 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">-- Select WASM --</option>
                    {#each Object.entries(AVAILABLE_WASMS) as [key, wasm]}
                        <option value={key}>{wasm.description}</option>
                    {/each}
                </select>
            </div>
            
            {#if installError}
                <div class="p-3 mb-4 text-sm text-red-400 bg-red-900 bg-opacity-50 border border-red-700 rounded">
                    {installError}
                </div>
            {/if}
            
            <div class="flex justify-end space-x-2">
                {#if canisters.find(c => c.id === selectedCanisterId)?.wasmType}
                    <button 
                        on:click={upgradeWasm} 
                        disabled={installing || !selectedWasm}
                        class="px-4 py-2 text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if installing}
                            <span class="flex items-center">
                                <svg class="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Upgrading...
                            </span>
                        {:else}
                            Upgrade
                        {/if}
                    </button>
                {:else}
                    <button 
                        on:click={installWasm} 
                        disabled={installing || !selectedWasm}
                        class="px-4 py-2 text-white transition-colors bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if installing}
                            <span class="flex items-center">
                                <svg class="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Installing...
                            </span>
                        {:else}
                            Install
                        {/if}
                    </button>
                {/if}
                <button 
                    on:click={closeInstallModal} 
                    class="px-4 py-2 text-gray-300 transition-colors bg-gray-700 rounded-md hover:bg-gray-600"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if} 

<!-- Kong Agent Chat Interface -->
{#if showKongAgent && kongAgentCanisterId}
    <KongInterfaceModal 
        isOpen={showKongAgent}
        onClose={closeKongAgent}
        canisterId={kongAgentCanisterId} 
        wasmType={kongAgentWasmType}
    />
{/if} 
