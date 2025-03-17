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
    import { registerCanister, syncCanistersToLocalStore } from '$lib/api/canisters';
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
    // current: token_backend: 1, ledger: 1, miner: 2
    const WASM_VERSIONS: Record<string, number> = {
        'token_backend': 1,
        'ledger': 1,
        'miner': 2
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
            // Special case for token/token_backend compatibility
            if (selectedFilter === 'token_backend') {
                if (canister.wasmType !== 'token_backend' && canister.wasmType !== 'token') {
                    return false;
                }
            } else if (canister.wasmType !== selectedFilter) {
                return false;
            }
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
        cycleUsageStats?: any;
    }
    
    let canisterStatuses: Record<string, CanisterStatus | null> = {};
    let loadingStatuses: Record<string, boolean> = {};
    let statusErrors: Record<string, string | null> = {};

    // Animation for the hidden canisters button
    let pulseHiddenButton = false;
    
    // Toggle the pulse animation every 3 seconds if there are hidden canisters
    $: hiddenCanistersCount = canisters.filter(c => c.hidden).length;

    // ICRC version tracking
    let canisterVersions: Record<string, number> = {};

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
            
            // // Register the canister with the API
            // if (principal && newCanisterType) {
            //     try {
            //         const registerResult = await registerCanister(
            //             principal,
            //             canisterId,
            //             newCanisterType === 'miner' ? 'miner' : 'token_backend'
            //         );
                    
            //         if (registerResult.success) {
            //             toastStore.success('Canister registered successfully');
            //         } else {
            //             toastStore.error(`Failed to register canister: ${registerResult.error}`);
            //         }
            //     } catch (registerError) {
            //         console.error('Error registering canister:', registerError);
            //         toastStore.error('Failed to register canister with API');
            //     }
            // }
            
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
        
        // Map 'token' to 'token_backend' for version checking
        const wasmType = canister.wasmType === 'token' ? 'token_backend' : canister.wasmType;
        
        // If the canister has a wasmVersion property and it's less than the current version,
        // then a newer version is available
        const currentVersion = canister.wasmVersion || 0;
        const latestVersion = WASM_VERSIONS[wasmType] || 0;
        
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
        
        try {
            // Try to get status directly
            let management = await getICManagementActor();
            console.log("Management actor:", management);
            
            try {
                const canisterStatus = await management.canisterStatus(Principal.fromText(canisterId));
                
                canisterStatuses[canisterId] = canisterStatus;
                
                // Also try to get ICRC version if possible
                await fetchCanisterVersion(canisterId);
                
                // If this is a miner canister, fetch cycle usage stats
                const canister = canisters.find(c => c.id === canisterId);
                if (canister && canister.wasmType === 'miner' && agent) {
                    try {
                        const minerActor = await agent.createActor(canisterId, {
                            agentOptions: {
                                host: 'https://icp-api.io'
                            }
                        });
                        
                        const cycleUsageStats = await minerActor.get_cycle_usage();
                        console.log(`Miner ${canisterId} cycle usage stats:`, cycleUsageStats);
                        
                        // Add cycle usage stats to canister status
                        canisterStatuses[canisterId] = {
                            ...canisterStatus,
                            cycleUsageStats
                        };
                    } catch (error) {
                        console.error(`Error fetching cycle usage stats for miner ${canisterId}:`, error);
                    }
                }
                
                loadingStatuses[canisterId] = false;
            } catch (error) {
                console.error("Error fetching canister status:", error);
                
                // Handle permission errors gracefully
                if (error.toString().includes('IC0512') || error.toString().includes('Only controllers')) {
                    statusErrors[canisterId] = "You need controller access to view detailed status. You can still view it on the IC Dashboard.";
                    
                    // Set a minimal status so the UI shows something
                    canisterStatuses[canisterId] = {
                        status: 'running', // Assume it's running since it exists
                        memorySize: 0n,
                        cycles: 0n
                    };
                } else {
                    statusErrors[canisterId] = error instanceof Error ? error.message : String(error);
                }
                
                loadingStatuses[canisterId] = false;
            }
        } catch (error) {
            console.error("Error creating management actor:", error);
            statusErrors[canisterId] = error instanceof Error ? error.message : String(error);
            loadingStatuses[canisterId] = false;
        }
    }
    
    // Fetch ICRC version from canister
    async function fetchCanisterVersion(canisterId: string) {
        if (!agent) {
            console.error(`Cannot fetch ICRC version for ${canisterId}: agent is null`);
            canisterVersions[canisterId] = 0;
            return;
        }
        
        try {
            // Create an actor for the canister
            const canisterActor = await agent.createActor(canisterId, {
                agentOptions: {
                    host: 'https://icp-api.io'
                }
            });
            
            try {
                // Try to call icrc1_version
                const version = await canisterActor.icrc1_version();
                canisterVersions[canisterId] = version;
                console.log(`Canister ${canisterId} ICRC version:`, version);
            } catch (e) {
                // If that fails, try to call get_info which might have icrc_version
                try {
                    const info = await canisterActor.get_info();
                    if (info && info.icrc_version) {
                        canisterVersions[canisterId] = info.icrc_version;
                        console.log(`Canister ${canisterId} ICRC version from get_info:`, info.icrc_version);
                    } else {
                        // Default to 0 if we can't determine version
                        canisterVersions[canisterId] = 0;
                    }
                } catch (e2) {
                    // Default to 0 if we can't determine version
                    canisterVersions[canisterId] = 0;
                }
            }
        } catch (error) {
            console.error(`Error fetching ICRC version for ${canisterId}:`, error);
            canisterVersions[canisterId] = 0;
        }
    }

    // Initialize
    onMount(() => {
        const unsubscribe = auth.subscribe(($auth) => {
            if ($auth.isConnected && $auth.account?.owner) {
                principal = Principal.fromText($auth.account.owner.toText());
                
                // When principal changes, sync canisters from API
                syncCanistersToLocalStore().catch(error => {
                    console.error("Failed to sync canisters:", error);
                    toastStore.error("Failed to load canisters from API");
                });
            } else {
                principal = null;
            }
        });

        // Track previously seen canister IDs to avoid redundant fetches
        let previousCanisterIds = new Set<string>();
        
        const canisterUnsubscribe = canisterStore.subscribe((updatedCanisters) => {
            canisters = updatedCanisters;
            
            // Only fetch status for new canisters that we haven't seen before
            const currentCanisterIds = new Set(updatedCanisters.map(c => c.id));
            
            // Find new canisters that weren't in the previous set
            updatedCanisters.forEach(canister => {
                if (!previousCanisterIds.has(canister.id) && !canisterStatuses[canister.id]) {
                    fetchCanisterStatus(canister.id);
                }
            });
            
            // Update the set of previously seen canister IDs
            previousCanisterIds = currentCanisterIds;
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

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
    <!-- Left sidebar with navigation -->
    <div class="lg:col-span-3">
        <div class="sticky flex flex-col gap-5 top-6">
            <!-- Back button -->
            <button 
                on:click={() => goto('/launch')}
                class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <span>Back to Launch</span>
            </button>
            
            <!-- Help card -->
            <div class="p-5 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
                <div class="flex items-start gap-3">
                    <div class="p-2 rounded-lg bg-kong-bg-light/10 text-kong-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="mb-1 text-sm font-medium">Create a Canister</h3>
                        <p class="text-xs text-kong-text-secondary">
                            Start by creating a token or miner canister. Then you can install WASM, top up with cycles, and interact with your canister.
                        </p>
                        <div class="mt-3 flex gap-2">
                            <a href="/launch/create-token" class="inline-flex items-center gap-1 text-xs text-kong-primary hover:underline">
                                <span>Create Token</span>
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                            <a href="/launch/create-miner" class="inline-flex items-center gap-1 text-xs text-kong-primary hover:underline">
                                <span>Create Miner</span>
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main content area -->
    <div class="lg:col-span-9">
        <h1 class="text-2xl font-bold mb-6">My Canisters</h1>
        
        {#if !principal}
            <div class="p-8 text-center transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
                <p class="text-lg text-kong-text-primary">Please connect your wallet to view your canisters.</p>
            </div>
        {:else if canisters.length === 0}
            <div class="p-8 text-center transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
                <p class="mb-4 text-lg text-kong-text-primary">You haven't created any canisters yet.</p>
                <div class="flex justify-center gap-4">
                    <a href="/launch/create-token" class="px-4 py-2 text-white transition-colors bg-kong-primary rounded-lg hover:bg-kong-primary/90">
                        Create Proof of Work Token
                    </a>
                    <a href="/launch/create-miner" class="px-4 py-2 text-white transition-colors bg-kong-accent-blue rounded-lg hover:bg-kong-accent-blue/90">
                        Create Miner
                    </a>
                </div>
            </div>
        {:else}
            <!-- Filter Controls -->
            <div class="mb-6 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
                <div class="p-4">
                    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <!-- Type Filter -->
                        <div class="flex flex-wrap gap-2">
                            <button 
                                on:click={() => selectedFilter = 'all'}
                                class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'all' ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary hover:bg-kong-bg-light/20'}"
                            >
                                All
                            </button>
                            <button 
                                on:click={() => selectedFilter = 'miner'}
                                class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'miner' ? 'bg-kong-accent-blue text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary hover:bg-kong-bg-light/20'}"
                            >
                                Miners
                            </button>
                            <button 
                                on:click={() => selectedFilter = 'token_backend'}
                                class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'token_backend' ? 'bg-kong-accent-green text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary hover:bg-kong-bg-light/20'}"
                            >
                                Tokens
                            </button>
                            <button 
                                on:click={() => selectedFilter = 'ledger'}
                                class="px-3 py-1.5 text-sm rounded-full transition-colors {selectedFilter === 'ledger' ? 'bg-yellow-500 text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary hover:bg-kong-bg-light/20'}"
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
                                    class="w-full px-3 py-2 pl-9 text-kong-text-primary bg-kong-bg-light/10 border border-kong-border/20 rounded-md focus:outline-none focus:ring-kong-primary focus:border-kong-primary"
                                />
                                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-kong-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>
                            
                            <button 
                                on:click={toggleShowHidden}
                                class="px-3 py-2 text-sm transition-colors rounded-md {showHidden ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary hover:bg-kong-bg-light/20'} flex items-center {!showHidden && hiddenCanistersCount > 0 && pulseHiddenButton ? 'pulse' : ''}"
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
                                    <span class="ml-2 px-2 py-0.5 text-xs bg-kong-primary/20 text-kong-primary rounded-full">
                                        {canisters.filter(c => c.hidden).length}
                                    </span>
                                {/if}
                            </button>
                            
                            <button 
                                on:click={showAddCanisterModal}
                                class="px-3 py-2 text-sm transition-colors rounded-md bg-kong-primary text-white hover:bg-kong-primary/90 flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add Existing
                            </button>
                        </div>
                    </div>
                </div>
                    
                    <!-- Stats -->
                    <div class="px-4 py-2 border-t border-kong-border/20">
                        <div class="text-sm text-kong-text-secondary">
                            Showing {filteredCanisters.length} of {canisters.length} canisters
                            {#if canisters.filter(c => c.hidden).length > 0}
                                <span class="ml-2">
                                    (<span class="{!showHidden ? 'text-kong-primary font-medium' : ''}">{canisters.filter(c => c.hidden).length} hidden</span>)
                                    {#if !showHidden && canisters.filter(c => c.hidden).length > 0}
                                        <button 
                                            on:click={toggleShowHidden}
                                            class="ml-2 text-xs text-kong-primary hover:text-kong-primary/90 underline"
                                        >
                                            Show hidden
                                        </button>
                                    {/if}
                                </span>
                            {/if}
                        </div>
                    </div>
                </div>
                
                {#if filteredCanisters.length === 0}
                    <div class="p-8 text-center transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
                        <p class="text-lg text-kong-text-primary">No canisters match your current filters.</p>
                        {#if !showHidden && canisters.some(c => c.hidden)}
                            <button 
                                on:click={toggleShowHidden}
                                class="px-4 py-2 mt-4 text-white transition-colors bg-kong-primary rounded-lg hover:bg-kong-primary/90"
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
                                    icrcVersion={canisterVersions[canister.id] || 0}
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
</div>

<!-- Add Canister Modal -->
{#if showAddModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
        <div class="w-full max-w-md p-6 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/90 border-kong-border/30 backdrop-blur-xl">
            <h2 class="mb-4 text-xl font-bold text-kong-text-primary">Add Existing Canister</h2>
            
            <div class="mb-4">
                <label class="block mb-1 text-sm font-medium text-kong-text-primary">Canister ID</label>
                <input 
                    type="text" 
                    bind:value={newCanisterId} 
                    placeholder="Enter canister ID" 
                    class="w-full px-3 py-2 text-kong-text-primary bg-kong-bg-light/10 border border-kong-border/20 rounded-md focus:outline-none focus:ring-kong-primary focus:border-kong-primary"
                />
                {#if addError}
                    <p class="mt-1 text-sm text-red-400">{addError}</p>
                {/if}
            </div>
            
            <div class="mb-4">
                <label class="block mb-1 text-sm font-medium text-kong-text-primary">Canister Type</label>
                <select 
                    bind:value={newCanisterType}
                    class="w-full px-3 py-2 text-kong-text-primary bg-kong-bg-light/10 border border-kong-border/20 rounded-md focus:outline-none focus:ring-kong-primary focus:border-kong-primary"
                >
                    <option value="">-- Select Type (Optional) --</option>
                    {#each Object.entries(AVAILABLE_WASMS) as [key, wasm]}
                        <option value={key}>{wasm.description}</option>
                    {/each}
                </select>
                <p class="mt-1 text-xs text-kong-text-secondary">Selecting the correct type helps Kong Agent provide appropriate functionality.</p>
            </div>
            
            <div class="flex justify-end space-x-2">
                <button 
                    on:click={closeAddModal} 
                    class="px-4 py-2 transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 text-kong-text-secondary"
                >
                    Cancel
                </button>
                <button 
                    on:click={addCustomCanister} 
                    class="px-4 py-2 text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90"
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
        <div class="w-full max-w-md p-6 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/90 border-kong-border/30 backdrop-blur-xl">
            {#if canisters.find(c => c.id === selectedCanisterId)?.wasmType}
                <h2 class="mb-4 text-xl font-bold text-kong-text-primary">Upgrade Canister</h2>
            {:else}
                <h2 class="mb-4 text-xl font-bold text-kong-text-primary">Install WASM</h2>
            {/if}
            
            <div class="mb-4">
                <label class="block mb-2 text-sm font-medium text-kong-text-primary">Select WASM to install</label>
                <select 
                    bind:value={selectedWasm}
                    class="w-full px-3 py-2 text-kong-text-primary bg-kong-bg-light/10 border border-kong-border/20 rounded-md focus:outline-none focus:ring-kong-primary focus:border-kong-primary"
                >
                    <option value="">-- Select WASM --</option>
                    {#each Object.entries(AVAILABLE_WASMS) as [key, wasm]}
                        <option value={key}>{wasm.description}</option>
                    {/each}
                </select>
            </div>
            
            {#if installError}
                <div class="p-3 mb-4 text-sm text-red-400 bg-red-900/20 border border-red-700/20 rounded-lg">
                    {installError}
                </div>
            {/if}
            
            <div class="flex justify-end space-x-2">
                {#if canisters.find(c => c.id === selectedCanisterId)?.wasmType}
                    <button 
                        on:click={upgradeWasm} 
                        disabled={installing || !selectedWasm}
                        class="px-4 py-2 text-white transition-colors rounded-lg bg-kong-accent-blue hover:bg-kong-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        class="px-4 py-2 text-white transition-colors rounded-lg bg-kong-accent-green hover:bg-kong-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    class="px-4 py-2 transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 text-kong-text-secondary"
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
