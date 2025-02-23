<script lang="ts">
    import { canisterStore, type CanisterMetadata } from '$lib/stores/canisters';
    import { auth, getICManagementActor } from '$lib/services/auth';
    import { Principal } from '@dfinity/principal';
    import { onMount } from 'svelte';
    import { IDL } from '@dfinity/candid';
    import { writable } from 'svelte/store';
    import { inflate } from 'pako';

    // Define proper types for initialization arguments
    interface TokenInitArgs {
        ticker: string;
        name: string;
        total_supply: bigint;
    }

    interface MinerInitArgs {
        owner: Principal;
        token_backend: Principal;
    }

    // Updated LedgerInitArgs to match full ICRC-1 spec
    interface LedgerInitArgs {
        token_name: string;
        token_symbol: string;
        decimals: number;
        transfer_fee: bigint;
        metadata: Array<[string, { Int: bigint } | { Nat: bigint } | { Blob: number[] } | { Text: string }]>;
        minting_account: {
            owner: Principal;
            subaccount: number[];
        };
        initial_balances: Array<[{
            owner: Principal;
            subaccount: number[];
        }, bigint]>;
        archive_options: {
            num_blocks_to_archive: bigint;
            trigger_threshold: bigint;
            controller_id: Principal;
            max_transactions_per_response: bigint | null;
            max_message_size_bytes: bigint | null;
            cycles_for_archive_creation: bigint | null;
            node_max_memory_size_bytes: bigint | null;
        };
        fee_collector_account?: {
            owner: Principal;
            subaccount: number[];
        };
        maximum_number_of_accounts?: bigint;
        accounts_overflow_trim_quantity?: bigint;
        max_memo_length?: number;
        feature_flags?: {
            icrc2: boolean;
        };
    }

    type InitArgsType = TokenInitArgs | LedgerInitArgs | MinerInitArgs;

    // Define proper types for WASM metadata
    interface BaseWasmMetadata {
        path: string;
        compressedPath?: string;
        description: string;
    }

    // Define IDL types for initialization arguments
    const TokenInitArgsIDL = IDL.Record({
        ticker: IDL.Text,
        name: IDL.Text,
        total_supply: IDL.Nat64
    });

    const MinerInitArgsIDL = IDL.Record({
        owner: IDL.Principal,
        token_backend: IDL.Principal
    });

    const AccountRecordIDL = IDL.Record({ 
        owner: IDL.Principal, 
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) 
    });

    // Updated IDL definitions for ICRC-1 Ledger
    const MetadataValue = IDL.Variant({
        Int: IDL.Int,
        Nat: IDL.Nat,
        Blob: IDL.Vec(IDL.Nat8),
        Text: IDL.Text
    });

    const ArchiveOptionsIDL = IDL.Record({
        num_blocks_to_archive: IDL.Nat64,
        trigger_threshold: IDL.Nat64,
        controller_id: IDL.Principal,
        max_transactions_per_response: IDL.Opt(IDL.Nat64),
        max_message_size_bytes: IDL.Opt(IDL.Nat64),
        cycles_for_archive_creation: IDL.Opt(IDL.Nat64),
        node_max_memory_size_bytes: IDL.Opt(IDL.Nat64)
    });

    const FeatureFlagsIDL = IDL.Record({
        icrc2: IDL.Bool
    });

    const LedgerInitArgsIDL = IDL.Variant({
        Init: IDL.Record({
            token_name: IDL.Text,
            token_symbol: IDL.Text,
            decimals: IDL.Nat8,
            transfer_fee: IDL.Nat,
            metadata: IDL.Vec(IDL.Tuple(IDL.Text, MetadataValue)),
            minting_account: AccountRecordIDL,
            initial_balances: IDL.Vec(IDL.Tuple(AccountRecordIDL, IDL.Nat)),
            archive_options: ArchiveOptionsIDL,
            fee_collector_account: IDL.Opt(AccountRecordIDL),
            maximum_number_of_accounts: IDL.Opt(IDL.Nat64),
            accounts_overflow_trim_quantity: IDL.Opt(IDL.Nat64),
            max_memo_length: IDL.Opt(IDL.Nat16),
            feature_flags: IDL.Opt(FeatureFlagsIDL)
        }),
        Upgrade: IDL.Opt(IDL.Record({}))
    });

    // Update WASM metadata type to use IDL types
    interface TokenWasmMetadata extends BaseWasmMetadata {
        initArgsType: typeof TokenInitArgsIDL;
    }

    interface MinerWasmMetadata extends BaseWasmMetadata {
        initArgsType: typeof MinerInitArgsIDL;
    }

    interface LedgerWasmMetadata extends BaseWasmMetadata {
        initArgsType: typeof LedgerInitArgsIDL;
    }

    interface BackendWasmMetadata extends BaseWasmMetadata {
        initArgsType: null;
    }

    type WasmMetadata = TokenWasmMetadata | LedgerWasmMetadata | MinerWasmMetadata | BackendWasmMetadata;

    // Update AVAILABLE_WASMS with proper IDL types
    const AVAILABLE_WASMS: Record<string, WasmMetadata> = {
        'backend': {
            path: '/wasms/backend.wasm',
            compressedPath: '/wasms/backend.wasm.gz',
            description: 'General purpose backend canister (TEST, contains only a hello world)',
            initArgsType: null
        },
        'ledger': {
            path: '/wasms/ledger.wasm',
            compressedPath: '/wasms/ledger.wasm.gz',
            description: 'ICRC-1 Ledger canister',
            initArgsType: LedgerInitArgsIDL
        },
        'token_backend': {
            path: '/wasms/token_backend.wasm',
            compressedPath: '/wasms/token_backend.wasm.gz',
            description: 'Token implementation canister',
            initArgsType: TokenInitArgsIDL
        },
        'miner': {
            path: '/wasms/miner.wasm',
            description: 'Mining canister for token mining',
            initArgsType: MinerInitArgsIDL
        }
    } as const;

    interface CanisterStatus {
        status: 'running' | 'stopping' | 'stopped';
        memorySize: bigint;
        cycles: bigint;
        moduleHash?: Uint8Array;
    }

    const IC_DASHBOARD_URL = "https://dashboard.internetcomputer.org/canister/";
    
    // Helper function to format cycles in a human-readable way
    function formatCycles(cycles: number): string {
        if (cycles >= 1e12) {
            return `${(cycles / 1e12).toFixed(2)}T`;
        } else if (cycles >= 1e9) {
            return `${(cycles / 1e9).toFixed(2)}B`;
        } else if (cycles >= 1e6) {
            return `${(cycles / 1e6).toFixed(2)}M`;
        }
        return cycles.toString();
    }

    // Helper function to extract cycles amount from error message
    function extractRequiredCycles(error: string): number | null {
        const match = error.match(/at least (\d+(?:_\d+)*) additional cycles/);
        if (match) {
            // Remove underscores and convert to number
            return parseInt(match[1].replace(/_/g, ''));
        }
        return null;
    }
    
    let canisters: CanisterMetadata[] = [];
    let editingCanister: CanisterMetadata | null = null;
    let newName: string = '';
    let newTags: string = '';
    let principal: Principal | null = null;
    let selectedWasm: string = '';
    let installing = false;
    let installError: string | null = null;
    let initArgs: any = null;
    let currentWasmMetadata: WasmMetadata | null = null;

    // Track canister statuses
    let canisterStatuses: Record<string, CanisterStatus | null> = {};
    let loadingStatus: Record<string, boolean> = {};
    let statusErrors: Record<string, string | null> = {};

    let showInstallModal = false;
    let selectedCanisterId: string | null = null;
    let showAdvancedOptions = false;

    // Create a store for hidden canisters with proper typing
    const hiddenCanisters = writable<Set<string>>(new Set());
    let showHidden = false;

    // Ensure proper reactivity by using store update
    function toggleCanisterVisibility(id: string) {
        hiddenCanisters.update(hidden => {
            const newHidden = new Set(hidden);
            if (newHidden.has(id)) {
                newHidden.delete(id);
            } else {
                newHidden.add(id);
            }
            return newHidden;
        });
    }

    // Reactive statement for filtering canisters
    $: visibleCanisters = showHidden 
        ? canisters 
        : canisters.filter(c => !$hiddenCanisters.has(c.id));

    // Reset init args when WASM selection changes
    $: {
        if (selectedWasm) {
            currentWasmMetadata = AVAILABLE_WASMS[selectedWasm as keyof typeof AVAILABLE_WASMS];
            if (selectedWasm === 'token_backend') {
                initArgs = {
                    ticker: '',
                    name: '',
                    total_supply: BigInt(0)
                };
            } else if (selectedWasm === 'ledger') {
                initArgs = {
                    token_name: '',
                    token_symbol: '',
                    decimals: 8,
                    transfer_fee: BigInt(10000),
                    metadata: [],
                    minting_account: {
                        owner: principal,
                        subaccount: []
                    },
                    initial_balances: [],
                    archive_options: {
                        num_blocks_to_archive: BigInt(1000),
                        trigger_threshold: BigInt(2000),
                        controller_id: principal,
                        max_transactions_per_response: null,
                        max_message_size_bytes: null,
                        cycles_for_archive_creation: null,
                        node_max_memory_size_bytes: null
                    },
                    fee_collector_account: undefined,
                    maximum_number_of_accounts: undefined,
                    accounts_overflow_trim_quantity: undefined,
                    max_memo_length: undefined,
                    feature_flags: {
                        icrc2: true
                    }
                };
            } else if (selectedWasm === 'miner') {
                initArgs = {
                    owner: principal,
                    token_backend: null
                };
            } else {
                initArgs = null;
            }
            // Reset advanced options visibility when changing WASM type
            showAdvancedOptions = false;
        } else {
            currentWasmMetadata = null;
            initArgs = null;
        }
    }

    // Helper function to format canister status
    function formatStatus(status: string | undefined): string {
        if (!status) return 'Unknown';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    // Helper to format memory size with proper type handling
    function formatMemorySize(bytes: bigint | undefined): string {
        if (!bytes || bytes === 0n) return 'No memory allocated';
        const mb = Number(bytes) / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }

    // Extend onMount to fetch initial statuses
    onMount(() => {
        const unsubscribe = auth.subscribe(($auth) => {
            if ($auth.isConnected && $auth.account?.owner) {
                principal = Principal.fromText($auth.account.owner.toText());
                // Fetch status for all canisters
                canisters.forEach(canister => fetchCanisterStatus(canister.id));
            } else {
                principal = null;
            }
        });

        const canisterUnsubscribe = canisterStore.subscribe((updatedCanisters: CanisterMetadata[]) => {
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

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function removeCanister(id: string) {
        if (confirm('Are you sure you want to remove this canister from your list? This will not delete the canister from the Internet Computer.')) {
            canisterStore.removeCanister(id);
        }
    }

    // Helper to validate and parse principal IDs
    function validatePrincipal(text: string): Principal | null {
        try {
            return Principal.fromText(text);
        } catch {
            return null;
        }
    }

    // Helper to validate and parse bigint values
    function validateBigInt(text: string): bigint | null {
        try {
            return BigInt(text.replace(/[_,]/g, ''));
        } catch {
            return null;
        }
    }

    function openInstallModal(canisterId: string) {
        selectedCanisterId = canisterId;
        showInstallModal = true;
    }

    function closeInstallModal() {
        showInstallModal = false;
        selectedCanisterId = null;
        selectedWasm = '';
        initArgs = null;
    }

    // Helper function to convert TypeScript args to Candid format
    function convertToCandidArgs(args: InitArgsType): any {
        if ('ticker' in args) {
            // TokenInitArgs
            return {
                ticker: args.ticker,
                name: args.name,
                total_supply: args.total_supply
            };
        } else if ('token_backend' in args) {
            // MinerInitArgs
            return {
                owner: args.owner,
                token_backend: args.token_backend
            };
        } else {
            // LedgerInitArgs - wrap in Init variant
            const result = {
                Init: {
                    token_name: args.token_name,
                    token_symbol: args.token_symbol,
                    decimals: Number(args.decimals),
                    transfer_fee: args.transfer_fee,
                    metadata: args.metadata || [],
                    minting_account: {
                        owner: args.minting_account.owner,
                        subaccount: args.minting_account.subaccount?.length 
                            ? [Uint8Array.from(args.minting_account.subaccount)]
                            : []
                    },
                    initial_balances: (args.initial_balances || []).map(([account, amount]) => ([
                        {
                            owner: account.owner,
                            subaccount: account.subaccount?.length
                                ? [Uint8Array.from(account.subaccount)]
                                : []
                        },
                        amount
                    ])),
                    archive_options: {
                        num_blocks_to_archive: args.archive_options.num_blocks_to_archive,
                        trigger_threshold: args.archive_options.trigger_threshold,
                        controller_id: args.archive_options.controller_id,
                        max_transactions_per_response: args.archive_options.max_transactions_per_response ? [args.archive_options.max_transactions_per_response] : [],
                        max_message_size_bytes: args.archive_options.max_message_size_bytes ? [args.archive_options.max_message_size_bytes] : [],
                        cycles_for_archive_creation: args.archive_options.cycles_for_archive_creation ? [args.archive_options.cycles_for_archive_creation] : [],
                        node_max_memory_size_bytes: args.archive_options.node_max_memory_size_bytes ? [args.archive_options.node_max_memory_size_bytes] : []
                    },
                    fee_collector_account: args.fee_collector_account ? [{
                        owner: args.fee_collector_account.owner,
                        subaccount: args.fee_collector_account.subaccount?.length
                            ? [Uint8Array.from(args.fee_collector_account.subaccount)]
                            : []
                    }] : [],
                    maximum_number_of_accounts: args.maximum_number_of_accounts ? [args.maximum_number_of_accounts] : [],
                    accounts_overflow_trim_quantity: args.accounts_overflow_trim_quantity ? [args.accounts_overflow_trim_quantity] : [],
                    max_memo_length: args.max_memo_length ? [args.max_memo_length] : [],
                    feature_flags: args.feature_flags ? [{
                        icrc2: args.feature_flags.icrc2
                    }] : []
                }
            };

            console.log('Converted Candid args:', result);
            return result;
        }
    }

    async function installWasm(canisterId: string) {
        if (!selectedWasm || !currentWasmMetadata) {
            installError = 'Please select a WASM file to install';
            return;
        }

        try {
            installing = true;
            installError = null;

            // Try compressed version first
            let wasmModule: Uint8Array;
            if (currentWasmMetadata.compressedPath) {
                try {
                    const compressedResponse = await fetch(currentWasmMetadata.compressedPath);
                    if (compressedResponse.ok) {
                        const compressedData = await compressedResponse.arrayBuffer();
                        // Use pako to decompress the gzipped data
                        wasmModule = new Uint8Array(inflate(new Uint8Array(compressedData)));
                    } else {
                        throw new Error('Compressed WASM not available');
                    }
                } catch (error) {
                    console.warn('Failed to fetch/decompress WASM, falling back to uncompressed:', error);
                    const response = await fetch(currentWasmMetadata.path);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch WASM file: ${response.statusText}`);
                    }
                    wasmModule = new Uint8Array(await response.arrayBuffer());
                }
            } else {
                const response = await fetch(currentWasmMetadata.path);
                if (!response.ok) {
                    throw new Error(`Failed to fetch WASM file: ${response.statusText}`);
                }
                wasmModule = new Uint8Array(await response.arrayBuffer());
            }

            // Get the management canister actor
            const management = await getICManagementActor();

            // Encode init args if present
            let arg = new Uint8Array();
            if (currentWasmMetadata.initArgsType && initArgs) {
                try {
                    const candidArgs = convertToCandidArgs(initArgs);
                    console.log('Pre-encoding args:', candidArgs);
                    const encoded = IDL.encode([currentWasmMetadata.initArgsType], [candidArgs]);
                    arg = new Uint8Array(encoded);
                    console.log('Encoded args:', arg);
                } catch (error) {
                    console.error('Failed to encode init args:', error);
                    throw new Error(`Failed to encode initialization arguments: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            // Install the WASM
            await management.installCode({
                canisterId: Principal.fromText(canisterId),
                wasmModule,
                mode: { install: null },
                arg
            });

            // Clear selection after successful install
            selectedWasm = '';
            initArgs = null;
            closeInstallModal();
        } catch (error) {
            console.error('Failed to install WASM:', error);
            
            // Check if it's a cycles-related error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('out of cycles')) {
                const requiredCycles = extractRequiredCycles(errorMessage);
                if (requiredCycles) {
                    installError = `Canister needs to be topped up with ${formatCycles(requiredCycles)} cycles before installing the WASM. Please top up your canister and try again.`;
                } else {
                    installError = 'Canister needs more cycles. Please top up your canister and try again.';
                }
            } else {
                installError = errorMessage;
            }
        } finally {
            installing = false;
        }
    }

    async function fetchCanisterStatus(canisterId: string) {
        console.log('Fetching status for canister:', canisterId);
        loadingStatus[canisterId] = true;
        statusErrors[canisterId] = null;
        try {
            const management = await getICManagementActor();
            console.log('Got management actor, fetching status...');
            const response = await management.canisterStatus(Principal.fromText(canisterId));
            console.log('Received status response:', response);
            
            // Transform the response to match our expected format
            canisterStatuses[canisterId] = {
                status: 'running' in response.status ? 'running' 
                    : 'stopping' in response.status ? 'stopping'
                    : 'stopped',
                memorySize: response.memory_size,
                cycles: response.cycles,
                moduleHash: response.module_hash?.[0] instanceof Uint8Array 
                    ? response.module_hash[0]
                    : new Uint8Array(response.module_hash?.[0] ?? [])
            };
            console.log('Transformed status:', canisterStatuses[canisterId]);
        } catch (error) {
            console.error('Failed to fetch canister status:', error);
            statusErrors[canisterId] = error instanceof Error ? error.message : String(error);
        } finally {
            loadingStatus[canisterId] = false;
        }
    }

    // Helper function to safely update text values
    function updateTextValue(value: string, field: 'name' | 'symbol' | 'token_name' | 'token_symbol') {
        if (!initArgs) return;
        
        if (field === 'name' && 'name' in initArgs) {
            initArgs.name = value;
        } else if (field === 'symbol' && 'symbol' in initArgs) {
            initArgs.symbol = value;
        } else if (field === 'token_name' && 'token_name' in initArgs) {
            initArgs.token_name = value;
        } else if (field === 'token_symbol' && 'token_symbol' in initArgs) {
            initArgs.token_symbol = value;
        }
    }

    // Helper function to safely update decimal values
    function updateDecimalValue(value: string, field: 'decimals') {
        if (!initArgs) return;
        
        const num = parseInt(value);
        if (!isNaN(num) && num >= 0 && num <= 18) {
            if ('decimals' in initArgs) {
                initArgs.decimals = num;
            }
        }
    }

    // Helper function to safely update bigint values with validation
    function updateBigIntValue(value: string, field: 'initialSupply' | 'transfer_fee') {
        if (!initArgs) return;
        
        // Allow empty value
        if (!value.trim()) {
            if (field === 'initialSupply' && 'initialSupply' in initArgs) {
                initArgs.initialSupply = BigInt(0);
            } else if (field === 'transfer_fee' && 'transfer_fee' in initArgs) {
                initArgs.transfer_fee = BigInt(0);
            }
            return;
        }

        try {
            // Remove any non-numeric characters except underscores
            const cleanValue = value.replace(/[^0-9_]/g, '');
            const bigIntValue = BigInt(cleanValue);
            
            if (field === 'initialSupply' && 'initialSupply' in initArgs) {
                initArgs.initialSupply = bigIntValue;
            } else if (field === 'transfer_fee' && 'transfer_fee' in initArgs) {
                initArgs.transfer_fee = bigIntValue;
            }
        } catch (error) {
            console.error(`Failed to parse BigInt value for ${String(field)}:`, error);
        }
    }

    let showInteractModal = false;
    let selectedCanisterForInteraction: CanisterMetadata | null = null;
    let selectedFunction: string = '';
    let functionArgs: Record<string, any> = {};

    // Function to open interaction modal
    function openInteractModal(canister: CanisterMetadata) {
        selectedCanisterForInteraction = canister;
        showInteractModal = true;
        selectedFunction = '';
        functionArgs = {};
    }

    // Function to close interaction modal
    function closeInteractModal() {
        showInteractModal = false;
        selectedCanisterForInteraction = null;
        selectedFunction = '';
        functionArgs = {};
    }

    // Function to get canister interface based on installed WASM
    function getCanisterInterface(canister: CanisterMetadata): Array<{ name: string; args: any[]; returnType: any }> {
        // This is where we'll define the available functions for each canister type
        const interfaces = {
            'token_backend': [
                { name: 'get_info', args: [], returnType: 'Result' },
                { name: 'get_target', args: [], returnType: 'Result_1' },
                { name: 'start_token', args: [], returnType: 'Result_2' },
                { name: 'submit_solution', args: [{ name: 'solution', type: 'nat64' }], returnType: 'Result_3' }
            ],
            'ledger': [
                { name: 'icrc1_balance_of', args: [{ name: 'account', type: 'Account' }], returnType: 'nat' },
                { name: 'icrc1_decimals', args: [], returnType: 'nat8' },
                { name: 'icrc1_name', args: [], returnType: 'text' },
                { name: 'icrc1_symbol', args: [], returnType: 'text' },
                { name: 'icrc1_total_supply', args: [], returnType: 'nat' }
            ]
        };

        // Return the interface based on the canister's installed WASM
        // You'll need to determine which interface to return based on the canister's metadata
        return interfaces['token_backend'] || [];
    }

    // Function to call canister method
    async function callCanisterMethod() {
        if (!selectedCanisterForInteraction || !selectedFunction) return;

        try {
            // Get the management canister actor
            const management = await getICManagementActor();

            // Here you would:
            // 1. Create an actor for the specific canister
            // 2. Call the selected function with the provided arguments
            // 3. Handle the response

            // This is a placeholder for the actual implementation
            console.log('Calling', selectedFunction, 'on canister', selectedCanisterForInteraction.id);
            console.log('With arguments:', functionArgs);

            // TODO: Implement actual canister call
        } catch (error) {
            console.error('Error calling canister method:', error);
            errorMessage.set(error instanceof Error ? error.message : 'Failed to call canister method');
        }
    }
</script>

<div class="min-h-screen p-8 bg-gradient-to-b from-gray-900 to-gray-800">
    <div class="mx-auto max-w-7xl">
        <header class="flex items-center justify-between mb-12">
            <div class="flex items-center gap-6">
                <h1 class="text-4xl font-bold tracking-tight text-white">My Canisters</h1>
                {#if canisters.length > 0}
                    <button
                        on:click={() => showHidden = !showHidden}
                        class="px-4 py-2 text-sm font-medium text-blue-200 transition-all rounded-lg bg-blue-500/10 hover:bg-blue-500/20"
                    >
                        {showHidden ? 'Hide Hidden' : 'Show Hidden'} ({$hiddenCanisters.size})
                    </button>
                {/if}
            </div>
            <a href="/canister" class="px-6 py-3 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900">
                Create New Canister
            </a>
        </header>

        {#if !principal}
            <div class="p-12 text-center border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                <p class="text-lg text-gray-300">Please connect your wallet to view your canisters.</p>
            </div>
        {:else if canisters.length === 0}
            <div class="p-12 text-center border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm">
                <p class="mb-6 text-lg text-gray-300">You haven't created any canisters yet.</p>
                <a href="/canister" class="px-6 py-3 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400">
                    Create Your First Canister
                </a>
            </div>
        {:else}
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {#each visibleCanisters as canister (canister.id)}
                    <div class="overflow-hidden transition-all border border-gray-700/50 rounded-xl bg-gray-800/30 backdrop-blur-sm hover:border-gray-600/50 hover:bg-gray-800/40">
                        {#if editingCanister?.id === canister.id}
                            <div class="p-6">
                                <div class="flex flex-col gap-4">
                                    <input
                                        type="text"
                                        bind:value={newName}
                                        placeholder="Canister name"
                                        class="w-full px-4 py-3 text-base font-medium text-white transition-all border rounded-lg bg-gray-900/50 border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <input
                                        type="text"
                                        bind:value={newTags}
                                        placeholder="Tags (comma-separated)"
                                        class="w-full px-4 py-3 text-base font-medium text-white transition-all border rounded-lg bg-gray-900/50 border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <div class="flex justify-end gap-3">
                                        <button on:click={saveEdit} class="px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400">Save</button>
                                        <button on:click={cancelEdit} class="px-4 py-2 text-sm font-medium text-white transition-all bg-gray-700 rounded-lg shadow-lg hover:bg-gray-600">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="p-6">
                                <div class="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 class="text-xl font-semibold tracking-tight text-white">{canister.name || 'Unnamed Canister'}</h3>
                                        <p class="mt-1 text-sm text-gray-400">ID: {canister.id}</p>
                                        <p class="mt-1 text-sm text-gray-400">Created: {formatDate(canister.createdAt)}</p>
                                    </div>
                                    <div class="flex gap-2">
                                        <button on:click={() => startEdit(canister)} class="p-2 text-sm font-medium text-blue-200 transition-all rounded-lg bg-blue-500/10 hover:bg-blue-500/20">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                        </button>
                                        <button 
                                            on:click={() => toggleCanisterVisibility(canister.id)} 
                                            class="p-2 text-sm font-medium text-gray-200 transition-all rounded-lg bg-gray-500/10 hover:bg-gray-500/20"
                                        >
                                            {#if $hiddenCanisters.has(canister.id)}
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                                                </svg>
                                            {:else}
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
                                                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                                </svg>
                                            {/if}
                                        </button>
                                    </div>
                                </div>

                                {#if canister.tags && canister.tags.length > 0}
                                    <div class="flex flex-wrap gap-2 mb-6">
                                        {#each canister.tags as tag}
                                            <span class="px-3 py-1 text-xs font-medium text-blue-200 rounded-full bg-blue-500/10">{tag}</span>
                                        {/each}
                                    </div>
                                {/if}

                                <!-- Status Section -->
                                <div class="p-4 mb-6 border rounded-lg border-gray-700/50 bg-gray-900/30">
                                    <div class="flex items-center justify-between mb-4">
                                        <h4 class="text-sm font-medium text-gray-300">Status</h4>
                                        <button
                                            on:click={() => fetchCanisterStatus(canister.id)}
                                            class="px-3 py-1.5 text-xs font-medium text-blue-200 transition-all rounded-lg bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50"
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
                                        <div class="p-3 text-sm text-red-200 rounded-lg bg-red-500/10">
                                            {statusErrors[canister.id]}
                                        </div>
                                    {:else if canisterStatuses[canister.id]}
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="p-3 rounded-lg bg-gray-800/50">
                                                <div class="text-xs font-medium text-gray-400">Status</div>
                                                <div class="mt-1 text-sm font-medium text-green-400">
                                                    {canisterStatuses[canister.id]?.status ? formatStatus(canisterStatuses[canister.id].status) : 'Unknown'}
                                                </div>
                                            </div>
                                            <div class="p-3 rounded-lg bg-gray-800/50">
                                                <div class="text-xs font-medium text-gray-400">Cycles</div>
                                                <div class="mt-1 text-sm font-medium text-blue-400">
                                                    {canisterStatuses[canister.id]?.cycles ? formatCycles(Number(canisterStatuses[canister.id].cycles)) : 'No cycles'}
                                                </div>
                                            </div>
                                            <div class="p-3 rounded-lg bg-gray-800/50">
                                                <div class="text-xs font-medium text-gray-400">Memory</div>
                                                <div class="mt-1 text-sm font-medium text-purple-400">
                                                    {formatMemorySize(canisterStatuses[canister.id]?.memorySize)}
                                                </div>
                                            </div>
                                            <div class="p-3 rounded-lg bg-gray-800/50">
                                                <div class="text-xs font-medium text-gray-400">WASM</div>
                                                <div class="mt-1 text-sm font-medium text-green-400">
                                                    {canisterStatuses[canister.id]?.moduleHash ? 
                                                        (canisterStatuses[canister.id]?.memorySize && canisterStatuses[canister.id]?.memorySize > 0n ? 
                                                            'Installed' : 
                                                            'Empty/Uninstalled') : 
                                                        'Not installed'}
                                                </div>
                                            </div>
                                        </div>
                                    {:else}
                                        <div class="flex items-center justify-center p-4">
                                            <div class="text-sm text-gray-400">Loading status...</div>
                                        </div>
                                    {/if}
                                </div>

                                <!-- Installation Section -->
                                <div class="mt-4 space-y-2">
                                    <button
                                        on:click={() => openInstallModal(canister.id)}
                                        class="w-full px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                                    >
                                        Install WASM
                                    </button>

                                    <div class="flex gap-2">
                                        <!-- IC Dashboard Link -->
                                        <a
                                            href={`${IC_DASHBOARD_URL}${canister.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="flex items-center justify-center flex-1 gap-2 px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                            </svg>
                                            View on IC Dashboard
                                        </a>

                                        <!-- Interact Button -->
                                        <button
                                            on:click={() => openInteractModal(canister)}
                                            class="flex items-center justify-center flex-1 gap-2 px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
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
</div>

<!-- Modal -->
{#if showInstallModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" on:click={closeInstallModal}></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-2xl p-6 mx-4 bg-gray-800 border border-gray-700/50 rounded-xl">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-semibold text-white">Install WASM</h3>
                <button 
                    on:click={closeInstallModal}
                    class="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-300 hover:bg-gray-700/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            <div class="space-y-6">
                <div>
                    <label class="block mb-2 text-sm font-medium text-gray-300">Select WASM</label>
                    <select
                        bind:value={selectedWasm}
                        class="w-full px-4 py-2.5 text-sm font-medium text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="">Select WASM to install...</option>
                        {#each Object.entries(AVAILABLE_WASMS) as [name, metadata]}
                            <option value={name}>{name} - {metadata.description}</option>
                        {/each}
                    </select>
                </div>

                {#if currentWasmMetadata?.initArgsType}
                    <div class="p-4 border rounded-lg border-gray-700/50 bg-gray-900/30">
                        <h4 class="mb-4 text-sm font-medium text-gray-300">Initialization Arguments</h4>
                        
                        {#if selectedWasm === 'token_backend'}
                            <div class="grid gap-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Token Name</label>
                                        <input
                                            type="text"
                                            value={initArgs.name}
                                            placeholder="My Token"
                                            on:input={(e) => updateTextValue(e.currentTarget.value, 'name')}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Ticker</label>
                                        <input
                                            type="text"
                                            value={initArgs.ticker}
                                            placeholder="TKN"
                                            on:input={(e) => updateTextValue(e.currentTarget.value, 'ticker')}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label class="block mb-2 text-xs font-medium text-gray-400">Total Supply</label>
                                    <input
                                        type="text"
                                        placeholder="1000000"
                                        value={initArgs.total_supply.toString()}
                                        on:input={(e) => {
                                            const value = validateBigInt(e.currentTarget.value);
                                            if (value) initArgs.total_supply = value;
                                        }}
                                        class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        {:else if selectedWasm === 'miner'}
                            <div class="grid gap-4">
                                <div>
                                    <label class="block mb-2 text-xs font-medium text-gray-400">Owner Principal</label>
                                    <input
                                        type="text"
                                        value={initArgs.owner?.toText() ?? ''}
                                        placeholder="aaaaa-aa"
                                        on:input={(e) => {
                                            const value = validatePrincipal(e.currentTarget.value);
                                            if (value) initArgs.owner = value;
                                        }}
                                        class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <div>
                                    <label class="block mb-2 text-xs font-medium text-gray-400">Token Backend Canister ID</label>
                                    <input
                                        type="text"
                                        value={initArgs.token_backend?.toText() ?? ''}
                                        placeholder="Enter token backend canister ID"
                                        on:input={(e) => {
                                            const value = validatePrincipal(e.currentTarget.value);
                                            if (value) initArgs.token_backend = value;
                                        }}
                                        class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <p class="mt-2 text-xs text-gray-400">
                                        This should be the canister ID of the token backend you want to mine.
                                    </p>
                                </div>
                            </div>
                        {:else if selectedWasm === 'ledger'}
                            <div class="grid gap-4">
                                <!-- Basic Token Info -->
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Token Name</label>
                                        <input
                                            type="text"
                                            value={initArgs.token_name}
                                            placeholder="My Token"
                                            on:input={(e) => updateTextValue(e.currentTarget.value, 'token_name')}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Symbol</label>
                                        <input
                                            type="text"
                                            value={initArgs.token_symbol}
                                            placeholder="TKN"
                                            on:input={(e) => updateTextValue(e.currentTarget.value, 'token_symbol')}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>

                                <!-- Decimals and Transfer Fee -->
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Decimals</label>
                                        <input
                                            type="number"
                                            value={initArgs.decimals}
                                            min="0"
                                            max="18"
                                            on:input={(e) => updateDecimalValue(e.currentTarget.value, 'decimals')}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Transfer Fee</label>
                                        <input
                                            type="text"
                                            placeholder="10000"
                                            value={initArgs.transfer_fee.toString()}
                                            on:input={(e) => updateBigIntValue(e.currentTarget.value, 'transfer_fee')}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>

                                <!-- Minting Account -->
                                <div>
                                    <label class="block mb-2 text-xs font-medium text-gray-400">Minting Account Principal</label>
                                    <input
                                        type="text"
                                        value={initArgs.minting_account.owner?.toText() ?? ''}
                                        placeholder="aaaaa-aa"
                                        on:input={(e) => {
                                            const value = validatePrincipal(e.currentTarget.value);
                                            if (value) initArgs.minting_account.owner = value;
                                        }}
                                        class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                <!-- Archive Options -->
                                <div class="p-4 border rounded-lg border-gray-700/50">
                                    <h5 class="mb-4 text-sm font-medium text-gray-300">Archive Options</h5>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block mb-2 text-xs font-medium text-gray-400">Blocks to Archive</label>
                                            <input
                                                type="text"
                                                placeholder="1000"
                                                value={initArgs.archive_options.num_blocks_to_archive.toString()}
                                                on:input={(e) => {
                                                    const value = validateBigInt(e.currentTarget.value);
                                                    if (value) initArgs.archive_options.num_blocks_to_archive = value;
                                                }}
                                                class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                        <div>
                                            <label class="block mb-2 text-xs font-medium text-gray-400">Trigger Threshold</label>
                                            <input
                                                type="text"
                                                placeholder="2000"
                                                value={initArgs.archive_options.trigger_threshold.toString()}
                                                on:input={(e) => {
                                                    const value = validateBigInt(e.currentTarget.value);
                                                    if (value) initArgs.archive_options.trigger_threshold = value;
                                                }}
                                                class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <!-- Feature Flags -->
                                <div class="p-4 border rounded-lg border-gray-700/50">
                                    <h5 class="mb-4 text-sm font-medium text-gray-300">Feature Flags</h5>
                                    <div class="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="icrc2-flag"
                                            checked={initArgs.feature_flags?.icrc2 ?? false}
                                            on:change={(e) => {
                                                if (!initArgs.feature_flags) initArgs.feature_flags = { icrc2: false };
                                                initArgs.feature_flags.icrc2 = e.currentTarget.checked;
                                            }}
                                            class="w-4 h-4 text-blue-600 border-gray-700 rounded bg-gray-900/50 focus:ring-blue-500"
                                        />
                                        <label for="icrc2-flag" class="ml-2 text-sm font-medium text-gray-300">
                                            Enable ICRC-2 Support
                                        </label>
                                    </div>
                                </div>

                                <!-- Advanced Options Toggle -->
                                <button
                                    type="button"
                                    class="px-4 py-2 text-sm font-medium text-blue-200 transition-all rounded-lg bg-blue-500/10 hover:bg-blue-500/20"
                                    on:click={() => showAdvancedOptions = !showAdvancedOptions}
                                >
                                    {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                                </button>

                                {#if showAdvancedOptions}
                                    <!-- Fee Collector Account -->
                                    <div class="p-4 border rounded-lg border-gray-700/50">
                                        <h5 class="mb-4 text-sm font-medium text-gray-300">Fee Collector Account</h5>
                                        <input
                                            type="text"
                                            placeholder="Principal ID"
                                            value={initArgs.fee_collector_account?.owner?.toText() ?? ''}
                                            on:input={(e) => {
                                                const value = validatePrincipal(e.currentTarget.value);
                                                if (value) {
                                                    if (!initArgs.fee_collector_account) {
                                                        initArgs.fee_collector_account = {
                                                            owner: value,
                                                            subaccount: []
                                                        };
                                                    } else {
                                                        initArgs.fee_collector_account.owner = value;
                                                    }
                                                }
                                            }}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>

                                    <!-- Account Limits -->
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block mb-2 text-xs font-medium text-gray-400">Max Accounts</label>
                                            <input
                                                type="text"
                                                placeholder="Optional"
                                                value={initArgs.maximum_number_of_accounts?.toString() ?? ''}
                                                on:input={(e) => {
                                                    const value = validateBigInt(e.currentTarget.value);
                                                    if (value) initArgs.maximum_number_of_accounts = value;
                                                }}
                                                class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                        <div>
                                            <label class="block mb-2 text-xs font-medium text-gray-400">Overflow Trim Quantity</label>
                                            <input
                                                type="text"
                                                placeholder="Optional"
                                                value={initArgs.accounts_overflow_trim_quantity?.toString() ?? ''}
                                                on:input={(e) => {
                                                    const value = validateBigInt(e.currentTarget.value);
                                                    if (value) initArgs.accounts_overflow_trim_quantity = value;
                                                }}
                                                class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                    </div>

                                    <!-- Max Memo Length -->
                                    <div>
                                        <label class="block mb-2 text-xs font-medium text-gray-400">Max Memo Length</label>
                                        <input
                                            type="number"
                                            placeholder="Optional"
                                            value={initArgs.max_memo_length?.toString() ?? ''}
                                            on:input={(e) => {
                                                const value = parseInt(e.currentTarget.value);
                                                if (!isNaN(value) && value >= 0) {
                                                    initArgs.max_memo_length = value;
                                                }
                                            }}
                                            class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if installError}
                    <div class="p-4 text-sm text-red-200 rounded-lg bg-red-500/10">
                        {installError}
                    </div>
                {/if}

                <div class="flex justify-end gap-3">
                    <button
                        on:click={closeInstallModal}
                        class="px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg bg-gray-700 hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        on:click={() => selectedCanisterId && installWasm(selectedCanisterId)}
                        disabled={installing || !selectedWasm}
                        class="px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-600 disabled:hover:to-green-500"
                    >
                        {#if installing}
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Installing...
                            </div>
                        {:else}
                            Install WASM
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Interact Modal -->
{#if showInteractModal && selectedCanisterForInteraction}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" on:click={closeInteractModal}></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-2xl p-6 mx-4 bg-gray-800 border border-gray-700/50 rounded-xl">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-semibold text-white">Interact with Canister</h3>
                <button 
                    on:click={closeInteractModal}
                    class="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-300 hover:bg-gray-700/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            <div class="space-y-6">
                <!-- Canister Info -->
                <div class="p-4 space-y-2 border rounded-lg border-gray-700/50 bg-gray-900/30">
                    <p class="text-sm text-gray-400">Canister ID: <span class="text-white">{selectedCanisterForInteraction.id}</span></p>
                    <p class="text-sm text-gray-400">Name: <span class="text-white">{selectedCanisterForInteraction.name || 'Unnamed Canister'}</span></p>
                </div>

                <!-- Function Selection -->
                <div>
                    <label class="block mb-2 text-sm font-medium text-gray-300">Select Function</label>
                    <select
                        bind:value={selectedFunction}
                        class="w-full px-4 py-2.5 text-sm font-medium text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="">Select a function...</option>
                        {#each getCanisterInterface(selectedCanisterForInteraction) as func}
                            <option value={func.name}>{func.name}</option>
                        {/each}
                    </select>
                </div>

                <!-- Function Arguments -->
                {#if selectedFunction}
                    {#each getCanisterInterface(selectedCanisterForInteraction).find(f => f.name === selectedFunction)?.args || [] as arg}
                        <div>
                            <label class="block mb-2 text-sm font-medium text-gray-300">{arg.name}</label>
                            <input
                                type="text"
                                bind:value={functionArgs[arg.name]}
                                placeholder={`Enter ${arg.type}`}
                                class="w-full px-4 py-2.5 text-sm text-white transition-all bg-gray-900/50 border border-gray-700/50 rounded-lg focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    {/each}
                {/if}

                <!-- Call Button -->
                <div class="flex justify-end gap-3">
                    <button
                        on:click={closeInteractModal}
                        class="px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg bg-gray-700 hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        on:click={callCanisterMethod}
                        disabled={!selectedFunction}
                        class="px-4 py-2.5 text-sm font-medium text-white transition-all rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Call Function
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
