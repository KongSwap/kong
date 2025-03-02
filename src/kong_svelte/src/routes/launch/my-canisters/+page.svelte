<script lang="ts">
    import { onMount } from 'svelte';
    import { canisterStore, type CanisterMetadata } from '$lib/stores/canisters';
    import { auth } from '$lib/services/auth';
    import { Principal } from '@dfinity/principal';
    import { InstallService, type WasmMetadata, agent, getICManagementActor } from '$lib/services/canister/install_wasm';
    import { idlFactory as icManagementIdlFactory } from '$lib/services/canister/ic-management.idl';
    import Canister from './Canister.svelte';
    import PageWrapper from '$lib/components/layout/PageWrapper.svelte';

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
    // current: token_backend: 14, ledger: 1, miner: 1
    const WASM_VERSIONS: Record<string, number> = {
        'token_backend': 14,
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
    let showAddModal = false;
    let addError = '';
    
    // Install WASM state
    let showInstallModal = false;
    let selectedCanisterId: string | null = null;
    let selectedWasm = '';
    let installing = false;
    let installError: string | null = null;
    
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
        // Redirect to the top-up page or open a top-up modal
        console.log(`Top up canister: ${canisterId}`);
        // This is a placeholder - implement actual top-up functionality
        alert(`Top up functionality for canister ${canisterId} would be implemented here.`);
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

    function removeCanister(event: CustomEvent) {
        const id = event.detail.id;
        if (confirm('Are you sure you want to remove this canister from your list? This will not delete the canister from the Internet Computer.')) {
            canisterStore.removeCanister(id);
        }
    }

    // Add custom canister
    function showAddCanisterModal() {
        newCanisterId = '';
        addError = '';
        showAddModal = true;
    }
    
    function closeAddModal() {
        showAddModal = false;
    }
    
    function addCustomCanister() {
        try {
            // Validate canister ID
            const canisterId = newCanisterId.trim();
            Principal.fromText(canisterId); // Will throw if invalid
            
            // Add to store
            canisterStore.addCanister({
                id: canisterId,
                createdAt: Date.now()
            });
            
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

        return () => {
            unsubscribe();
            canisterUnsubscribe();
        };
    });
</script>

<PageWrapper page="launch/my-canisters">
    <div class="container px-4 py-8 mx-auto">
        <div class="flex items-center justify-between mb-8">
            <h1 class="text-2xl font-bold text-white">My Canisters</h1>
            <div class="flex gap-2">
                <button 
                    on:click={showAddCanisterModal}
                    class="px-4 py-2 text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                    Add Existing Canister
                </button>
                <div class="relative group">
                    <button 
                        class="px-4 py-2 text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700"
                    >
                        Create New Canister
                    </button>
                    <div class="absolute right-0 z-10 hidden w-48 mt-2 overflow-hidden transition-all duration-300 bg-gray-800 border border-gray-700 rounded-lg shadow-lg group-hover:block">
                        <a 
                            href="/launch/create-token" 
                            class="block px-4 py-2 text-white hover:bg-purple-700"
                        >
                            Proof of Work Token
                        </a>
                        <a 
                            href="/launch/create-miner" 
                            class="block px-4 py-2 text-white hover:bg-purple-700"
                        >
                            Miner
                        </a>
                    </div>
                </div>
            </div>
        </div>

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
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {#each canisters as canister (canister.id)}
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
                        on:remove={removeCanister}
                        on:refresh-status={(e) => fetchCanisterStatus(e.detail.id)}
                        on:install-wasm={openInstallModal}
                        on:top-up={handleTopUp}
                    />
                {/each}
            </div>
        {/if}
    </div>
</PageWrapper>

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
