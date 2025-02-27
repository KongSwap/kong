<script lang="ts">
    import { onMount } from 'svelte';
    import { canisterStore, type CanisterMetadata } from '$lib/stores/canisters';
    import { auth } from '$lib/services/auth';
    import { Principal } from '@dfinity/principal';
    import { InstallService, type WasmMetadata, agent, getICManagementActor } from '$lib/services/canister/install_wasm';
    import { idlFactory as icManagementIdlFactory } from '$lib/services/canister/ic-management.idl';

    // Available WASM types
    const AVAILABLE_WASMS: Record<string, WasmMetadata> = {
        'token_backend': {
            path: '/wasms/token_backend/token_backend.wasm',
            // compressedPath: '/wasms/token_backend/token_backend.wasm.gz',  // Comment out compressed path
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
    let loadingStatus: Record<string, boolean> = {};
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
    function startEdit(canister: CanisterMetadata) {
        editingCanister = canister;
        newName = canister.name || '';
        newTags = canister.tags?.join(', ') || '';
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

    function removeCanister(id: string) {
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
    function openInstallModal(canisterId: string) {
        selectedCanisterId = canisterId;
        selectedWasm = '';
        installError = null;
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

        try {
            installing = true;
            installError = null;
            
            const wasmMetadata = AVAILABLE_WASMS[selectedWasm];
            console.log("Selected WASM metadata:", wasmMetadata);
            
            // Always use chunked upload for WASM installation to handle large files
            console.log(`Using chunked upload for WASM installation`);
            await InstallService.installWasmChunked(selectedCanisterId, wasmMetadata);
            
            // Update canister metadata with WASM type
            canisterStore.updateCanister(selectedCanisterId, {
                wasmType: selectedWasm
            });
            
            // Refresh status
            fetchCanisterStatus(selectedCanisterId);
            
            // Close modal
            closeInstallModal();
        } catch (error) {
            console.error('Failed to install WASM:', error);
            
            // Create a more detailed error message
            let errorMessage = '';
            if (error instanceof Error) {
                errorMessage = error.message;
                // Add stack trace for debugging
                console.error('Error stack:', error.stack);
                
                // Check for specific error types
                if (errorMessage.includes('decompress') || errorMessage.includes('header check')) {
                    errorMessage += '\n\nThe WASM file appears to be corrupted or not properly compressed. Please check the file format.';
                } else if (errorMessage.includes('canister module format')) {
                    errorMessage += '\n\nThe WASM module format is not supported. Please ensure you are using a compatible WASM file.';
                } else if (errorMessage.includes('out of cycles')) {
                    errorMessage += '\n\nYour canister is out of cycles. Please top up your canister and try again.';
                }
            } else {
                errorMessage = String(error);
            }
            
            installError = errorMessage;
        } finally {
            installing = false;
        }
    }

    // Fetch canister status
    async function fetchCanisterStatus(canisterId: string) {
        loadingStatus[canisterId] = true;
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
            loadingStatus[canisterId] = false;
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

<div class="container px-4 py-8 mx-auto">
    <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold">My Canisters</h1>
        <div class="flex gap-2">
            <button 
                on:click={showAddCanisterModal}
                class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
                Add Existing Canister
            </button>
            <a 
                href="/canister" 
                class="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
                Create New Canister
            </a>
        </div>
    </div>

    {#if !principal}
        <div class="p-8 text-center bg-gray-100 rounded-lg">
            <p class="text-lg text-gray-600">Please connect your wallet to view your canisters.</p>
        </div>
    {:else if canisters.length === 0}
        <div class="p-8 text-center bg-gray-100 rounded-lg">
            <p class="mb-4 text-lg text-gray-600">You haven't created any canisters yet.</p>
            <a href="/canister" class="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Create Your First Canister
            </a>
        </div>
    {:else}
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each canisters as canister (canister.id)}
                <div class="overflow-hidden border border-gray-200 rounded-lg shadow-md">
                    {#if editingCanister?.id === canister.id}
                        <div class="p-4">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Name</label>
                                    <input 
                                        type="text" 
                                        bind:value={newName} 
                                        class="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
                                    <input 
                                        type="text" 
                                        bind:value={newTags} 
                                        class="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div class="flex justify-end space-x-2">
                                    <button 
                                        on:click={saveEdit} 
                                        class="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                    >
                                        Save
                                    </button>
                                    <button 
                                        on:click={cancelEdit} 
                                        class="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div class="p-4">
                            <div class="flex items-start justify-between mb-4">
                                <div>
                                    <h3 class="text-lg font-semibold">{canister.name || 'Unnamed Canister'}</h3>
                                    <p class="text-sm text-gray-500">ID: {canister.id}</p>
                                    <p class="text-sm text-gray-500">Created: {formatDate(canister.createdAt)}</p>
                                </div>
                                <div class="flex space-x-1">
                                    <button 
                                        on:click={() => startEdit(canister)} 
                                        class="p-1 text-gray-500 hover:text-gray-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                        </svg>
                                    </button>
                                    <button 
                                        on:click={() => removeCanister(canister.id)} 
                                        class="p-1 text-red-500 hover:text-red-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {#if canister.tags && canister.tags.length > 0}
                                <div class="flex flex-wrap gap-1 mb-4">
                                    {#each canister.tags as tag}
                                        <span class="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded-full">{tag}</span>
                                    {/each}
                                </div>
                            {/if}

                            <!-- Status Section -->
                            <div class="p-3 mb-4 rounded-lg bg-gray-50">
                                <div class="flex items-center justify-between mb-2">
                                    <h4 class="text-sm font-medium text-gray-700">Status</h4>
                                    <button
                                        on:click={() => fetchCanisterStatus(canister.id)}
                                        class="p-1 text-blue-600 hover:text-blue-800"
                                        disabled={loadingStatus[canister.id]}
                                    >
                                        {#if loadingStatus[canister.id]}
                                            <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        {:else}
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                                
                                {#if statusErrors[canister.id]}
                                    <div class="p-2 text-sm text-yellow-700 bg-yellow-100 rounded">
                                        {statusErrors[canister.id]}
                                    </div>
                                    {#if canisterStatuses[canister.id]}
                                        <div class="mt-2 text-sm text-gray-600">
                                            <a 
                                                href={`https://dashboard.internetcomputer.org/canister/${canister.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="text-blue-600 hover:underline"
                                            >
                                                View on IC Dashboard
                                            </a>
                                        </div>
                                    {/if}
                                {:else if canisterStatuses[canister.id]}
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">Status</div>
                                            <div class="text-sm font-medium text-green-600">
                                                {formatStatus(canisterStatuses[canister.id]?.status)}
                                            </div>
                                        </div>
                                        <div class="p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">Cycles</div>
                                            <div class="text-sm font-medium text-blue-600">
                                                {formatCycles(canisterStatuses[canister.id]?.cycles || 0n)}
                                            </div>
                                        </div>
                                        <div class="p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">Memory</div>
                                            <div class="text-sm font-medium text-purple-600">
                                                {formatMemorySize(canisterStatuses[canister.id]?.memorySize)}
                                            </div>
                                        </div>
                                        <div class="p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">WASM</div>
                                            <div class="text-sm font-medium text-green-600">
                                                {canisterStatuses[canister.id]?.moduleHash ? 'Installed' : 'Not installed'}
                                            </div>
                                        </div>
                                        
                                        {#if canisterStatuses[canister.id]?.controllers}
                                        <div class="col-span-2 p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">Controllers</div>
                                            <div class="text-sm font-medium text-gray-800 truncate">
                                                {canisterStatuses[canister.id]?.controllers?.length || 0} controller(s)
                                                {#if canisterStatuses[canister.id]?.controllers?.length > 0}
                                                <div class="mt-1 text-xs">
                                                    {#each canisterStatuses[canister.id]?.controllers?.slice(0, 2) || [] as controller}
                                                    <div class="truncate">{controller.toText()}</div>
                                                    {/each}
                                                    {#if (canisterStatuses[canister.id]?.controllers?.length || 0) > 2}
                                                    <div>+ {(canisterStatuses[canister.id]?.controllers?.length || 0) - 2} more</div>
                                                    {/if}
                                                </div>
                                                {/if}
                                            </div>
                                        </div>
                                        {/if}
                                        
                                        {#if canisterStatuses[canister.id]?.idleCyclesBurnedPerDay}
                                        <div class="col-span-2 p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">Idle Cycles Burned/Day</div>
                                            <div class="text-sm font-medium text-orange-600">
                                                {formatCycles(canisterStatuses[canister.id]?.idleCyclesBurnedPerDay || 0n)}
                                            </div>
                                        </div>
                                        {/if}
                                        
                                        {#if canisterStatuses[canister.id]?.recentChanges && canisterStatuses[canister.id]?.recentChanges.length > 0}
                                        <div class="col-span-2 p-2 bg-gray-100 rounded">
                                            <div class="text-xs text-gray-500">Recent Changes</div>
                                            <div class="text-sm font-medium text-gray-800">
                                                <div class="mt-1 text-xs">
                                                    {#each canisterStatuses[canister.id]?.recentChanges?.slice(0, 2) || [] as change}
                                                    <div class="flex justify-between">
                                                        <span>
                                                            {change.details.creation ? 'Created' : 
                                                             change.details.code_deployment ? 'Code deployed' :
                                                             change.details.controllers_change ? 'Controllers changed' :
                                                             change.details.code_uninstall ? 'Code uninstalled' :
                                                             change.details.load_snapshot ? 'Snapshot loaded' : 'Changed'}
                                                        </span>
                                                        <span class="text-gray-500">
                                                            {new Date(Number(change.timestamp_nanos) / 1000000).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="p-2 text-sm text-center text-gray-500">
                                        Loading status...
                                    </div>
                                {/if}
                            </div>

                            <!-- Actions -->
                            <div class="space-y-2">
                                <button
                                    on:click={() => openInstallModal(canister.id)}
                                    class="w-full px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                                >
                                    Install WASM
                                </button>
                                
                                <div class="grid grid-cols-2 gap-2">
                                    <a
                                        href={`https://dashboard.internetcomputer.org/canister/${canister.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center justify-center px-3 py-2 text-sm text-white bg-purple-600 rounded hover:bg-purple-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                        </svg>
                                        IC Dashboard
                                    </a>
                                    
                                    <button
                                        class="flex items-center justify-center px-3 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
                                        </svg>
                                        Interact
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Add Canister Modal -->
{#if showAddModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div class="w-full max-w-md p-6 bg-white rounded-lg">
            <h2 class="mb-4 text-xl font-bold">Add Existing Canister</h2>
            
            <div class="mb-4">
                <label class="block mb-1 text-sm font-medium text-gray-700">Canister ID</label>
                <input 
                    type="text" 
                    bind:value={newCanisterId} 
                    placeholder="Enter canister ID" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {#if addError}
                    <p class="mt-1 text-sm text-red-600">{addError}</p>
                {/if}
            </div>
            
            <div class="flex justify-end space-x-2">
                <button 
                    on:click={closeAddModal} 
                    class="px-4 py-2 text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                    Cancel
                </button>
                <button 
                    on:click={addCustomCanister} 
                    class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    Add Canister
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Install WASM Modal -->
{#if showInstallModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div class="w-full max-w-md p-6 bg-white rounded-lg">
            <h2 class="mb-4 text-xl font-bold">Install WASM</h2>
            
            <div class="mb-4">
                <label class="block mb-1 text-sm font-medium text-gray-700">Select WASM</label>
                <select
                    bind:value={selectedWasm}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Select WASM to install...</option>
                    {#each Object.entries(AVAILABLE_WASMS) as [name, metadata]}
                        <option value={name}>{name} - {metadata.description}</option>
                    {/each}
                </select>
            </div>
            
            {#if installError}
                <div class="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
                    {installError}
                </div>
            {/if}
            
            <div class="flex justify-end space-x-2">
                <button 
                    on:click={closeInstallModal} 
                    class="px-4 py-2 text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                    Cancel
                </button>
                <button 
                    on:click={installWasm} 
                    disabled={installing || !selectedWasm}
                    class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                    {#if installing}
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-2 -ml-1 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Installing...
                        </span>
                    {:else}
                        Install WASM
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if} 
