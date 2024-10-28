<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { walletStore } from '$lib/stores/walletStore';
    import { backendService } from '$lib/services/backendService';
    import { ArrowDown } from 'lucide-svelte';
    import Panel from '$lib/components/common/Panel.svelte';
    import Button from '$lib/components/common/Button.svelte';

    let payToken: string = 'ICP';
    let receiveToken: string = 'CKUSDT';
    let payAmount: string = '0';
    let receiveAmount: string = '0';
    let slippage: number = 2;
    let isLoading: boolean = false;
    let error: string | null = null;
    let quote: any = null;

    $: isValid = payToken && receiveToken && payAmount && !isLoading;
    $: tokens = $tokenStore.tokens || [];
    $: payTokenInfo = tokens.find(t => t.symbol === payToken);
    $: receiveTokenInfo = tokens.find(t => t.symbol === receiveToken);
    $: buttonText = payAmount && Number(payAmount) > 0 ? 'SWAP' : 'ENTER AMOUNT';

    onMount(async () => {
        if (!$tokenStore.tokens.length) {
            await tokenStore.loadTokens();
        }
    });

    async function handleGetQuote() {
        if (!payToken || !receiveToken || !payAmount) return;
        
        isLoading = true;
        error = null;
        
        try {
            const payAmountBigInt = BigInt(parseFloat(payAmount) * Math.pow(10, payTokenInfo?.decimals || 8));
            quote = await backendService.getSwapQuote({
                payToken,
                payAmount: payAmountBigInt,
                receiveToken
            });
            receiveAmount = (Number(quote.receiveAmount) / Math.pow(10, receiveTokenInfo?.decimals || 8)).toString();
        } catch (err) {
            error = err.message;
            quote = null;
        } finally {
            isLoading = false;
        }
    }

    async function handleSwap() {
        if (!payToken || !receiveToken || !payAmount) return;
        handleGetQuote();
    }

    function switchTokens() {
        [payToken, receiveToken] = [receiveToken, payToken];
        [payAmount, receiveAmount] = [receiveAmount, payAmount];
    }
</script>

<div class="swap-container">
    <Panel variant="green" type="s" height="auto" width="600px" className="pay-panel">
        <div class="panel-header">
            <h2>You Pay</h2>
        </div>
        <div class="panel-content">
            <div class="amount-input">
                <input
                    type="number"
                    bind:value={payAmount}
                    placeholder="0"
                    min="0"
                />
            </div>
            <Button 
                variant="yellow" 
                size="small" 
                text={payToken}
            >
                <div class="token-button-content">
                    <div class="token-icon">∞</div>
                    <span>{payToken}</span>
                    <div class="dropdown-arrow">▼</div>
                </div>
            </Button>
            <div class="available">
                Avail: 0.0000
            </div>
            <Button 
                variant="yellow" 
                size="small" 
                text="MAX"
            />
        </div>
    </Panel>

    <Button 
        variant="green" 
        size="small" 
        onClick={switchTokens}
    >
        <ArrowDown size={36} />
    </Button>

    <Panel variant="green" type="s" height="auto" width="600px" className="receive-panel">
        <div class="panel-header">
            <h2>You Receive</h2>
        </div>
        <div class="panel-content">
            <div class="amount-input">
                <input
                    type="number"
                    bind:value={receiveAmount}
                    placeholder="0"
                    readonly
                />
            </div>
            <Button 
                variant="yellow" 
                size="small" 
                text={receiveToken}
            >
                <div class="token-button-content">
                    <div class="token-icon">T</div>
                    <span>{receiveToken}</span>
                    <div class="dropdown-arrow">▼</div>
                </div>
            </Button>
            <div class="available">
                Avail: 0.000
            </div>
        </div>
    </Panel>

    <Button 
        variant="yellow"
        size="big"
        text={buttonText}
        onClick={handleSwap}
        disabled={!isValid}
    />
</div>

<style>
    .swap-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: center;
        max-width: 600px;
        margin: 0 auto;
    }

    .panel-header h2 {
        font-size: 1.25rem;
        margin: 0;
        padding-bottom: 0.5rem;
    }

    .panel-content {
        position: relative;
        padding: 0.5rem;
    }

    .amount-input input {
        width: 100%;
        background: transparent;
        border: none;
        font-size: 2rem;
        color: white;
        padding: 0.5rem 0;
    }

    .amount-input input::placeholder {
        color: rgba(255, 255, 255, 0.5);
    }

    .token-selector {
        position: absolute !important;
        top: 0.5rem;
        right: 0.5rem;
    }

    .token-button-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .token-icon {
        width: 24px;
        height: 24px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }

    .available {
        text-align: right;
        font-size: 0.75rem;
        opacity: 0.8;
        padding-top: 0.5rem;
    }

    .max-button {
        position: absolute !important;
        top: 0.5rem;
        right: 8rem;
    }

    .switch-button {
        margin: -0.5rem 0;
        z-index: 1;
    }

    .swap-button {
        width: 100%;
        margin-top: 1rem;
    }

    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    input[type=number] {
        -moz-appearance: textfield;
    }
</style>
