<script lang="ts">
    import { fade } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { quintOut } from 'svelte/easing';
    import SwapPanel from './SwapPanel.svelte';
    import Button from '$lib/components/common/Button.svelte';
    import { t } from '$lib/locales/translations';
    import type { SwapStore } from '$lib/stores/swapStore';
    
    export let swapStore: SwapStore;
    
    $: panels = [
        { id: 'pay', type: 'pay', title: $t('swap.pay') },
        { id: 'receive', type: 'receive', title: $t('swap.receive') }
    ];
    
    $: panelData = {
        pay: {
            token: $swapStore.payToken,
            amount: $swapStore.payAmount,
            balance: $swapStore.payBalance,
            onTokenSelect: swapStore.showPayTokenSelector,
            onAmountChange: swapStore.handleInputChange,
            disabled: $swapStore.isProcessing,
            showPrice: false
        },
        receive: {
            token: $swapStore.receiveToken,
            amount: $swapStore.tweenedReceiveAmount,
            balance: $swapStore.receiveBalance,
            onTokenSelect: swapStore.showReceiveTokenSelector,
            onAmountChange: () => {},
            disabled: $swapStore.isProcessing,
            showPrice: true,
            usdValue: $swapStore.usdValue,
            slippage: $swapStore.swapSlippage,
            maxSlippage: $swapStore.maxSlippage
        }
    };
</script>

<div class="swap-container" in:fade={{ duration: 420 }}>
    <div class="panels-container">
        {#each panels as panel (panel.id)}
            <div 
                animate:flip={{
                    duration: 169,
                    easing: quintOut
                }}
                class="panel-wrapper"
            >
                <div class="panel-content">
                    <SwapPanel
                        title={panel.title}
                        {...panelData[panel.type]}
                    />
                </div>
            </div>
        {/each}

        <button 
            class="switch-button {$swapStore.isAnimating ? 'rotating' : ''}"
            on:click={swapStore.handleTokenSwitch}
            disabled={$swapStore.isProcessing || $swapStore.isAnimating} 
        >
            <img 
                src="/pxcomponents/arrow.svg"
                alt="swap"
                class="swap-arrow"
            />
        </button>
    </div>

    <div class="swap-footer mt-3">
        <Button 
            variant="yellow"
            disabled={!$swapStore.isValidInput || $swapStore.isProcessing || $swapStore.isAnimating}
            on:click={swapStore.showConfirmation}
            width="100%"
        >
            {$swapStore.buttonText}
        </Button>
    </div>
</div>

<style>
    .swap-container {
        display: flex;
        flex-direction: column;
    }

    .panels-container {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .panel-wrapper {
        position: relative;
        transition: all 0.15s ease;
        transform-style: preserve-3d;
    }

    .panel-content {
        transform-origin: center center;
        backface-visibility: hidden;
    }

    .switch-button {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 50px;
        height: 50px;
        background: #FFCD1F;
        border: 2px solid #368D00;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1;
        padding: 6px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .switch-button:hover:not(:disabled) {
        background: #FFE077;
        transform: translate(-50%, -50%) scale(1.05);
    }

    .switch-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .swap-arrow {
        width: 100%;
        height: 100%;
    }

    @media (max-width: 480px) {
        .swap-container {
            padding: 0.5rem;
        }

        .switch-button {
            width: 32px;
            height: 32px;
            padding: 6px;
        }
    }
</style>
