<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import TopUp from './TopUp.svelte';
    import { ArrowLeft, HelpCircle } from 'lucide-svelte';
    import Panel from '$lib/components/common/Panel.svelte';

    let canisterId: string | null = null;

    // Use a reactive statement to update canisterId when the URL changes
    $: if (browser && $page && $page.url) {
        const newCanisterId = $page.url.searchParams.get('canisterId');
        if (newCanisterId !== canisterId) {
            console.log("URL canisterId changed from", canisterId, "to", newCanisterId);
            canisterId = newCanisterId;
        }
    }

    function goBack() {
        goto('/launch/my-canisters');
    }

    onMount(() => {
        if (browser) {
            console.log("Page component mounted, $page.url:", $page.url);
        }
    });
</script>

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
    <!-- Left sidebar with navigation -->
    <div class="lg:col-span-3">
        <div class="sticky flex flex-col gap-5 top-6">
            <!-- Back button -->
            <button 
                on:click={goBack}
                class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
            >
                <ArrowLeft size={18} />
                <span>Back to My Canisters</span>
            </button>
            
            <!-- Help card -->
            <div class="p-5 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
                <div class="flex items-start gap-3">
                    <div class="p-2 rounded-lg bg-kong-bg-light/10 text-kong-primary">
                        <HelpCircle size={18} />
                    </div>
                    <div>
                        <h3 class="mb-1 text-sm font-medium">Need Help?</h3>
                        <p class="text-xs text-kong-text-secondary">
                            Top up your canister with KONG to add cycles. These cycles are used to pay for computation and storage on the Internet Computer.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main content area -->
    <div class="pr-2 overflow-auto lg:col-span-9">
        <Panel variant="solid" type="main" className="p-4 backdrop-blur-xl">
            <TopUp {canisterId} />
        </Panel>
    </div>
</div>
