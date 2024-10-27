<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { spring } from 'svelte/motion';
    import { walletStore } from "$lib/stores/walletStore";
    
    import WalletProvider from './sidebar/WalletProvider.svelte';
    import SidebarHeader from './sidebar/SidebarHeader.svelte';

    import './sidebar/colors.css';
    
    export let sidebarOpen: boolean;
    export let onClose: () => void;

    let isLoggedIn = false;
    let isDragging = false;
    let startX: number;
    let startWidth: number;
    let isResizeHovered = false;
    let activeTab: 'tokens' | 'pools' | 'transactions' = 'tokens';
    
    let sidebarWidth = spring(500, {
        stiffness: 0.2,
        damping: 0.7
    });

    function startDragging(event: MouseEvent) {
        isDragging = true;
        startX = event.clientX;
        startWidth = $sidebarWidth;
        document.addEventListener('mousemove', handleDragging);
        document.addEventListener('mouseup', stopDragging);
        document.body.style.cursor = 'ew-resize';
        event.stopPropagation();
    }

    function handleDragging(event: MouseEvent) {
        if (!isDragging) return;
        const delta = event.clientX - startX;
        const newWidth = Math.max(400, Math.min(800, startWidth - delta));
        sidebarWidth.set(newWidth);
        event.stopPropagation();
    }

    function stopDragging() {
        isDragging = false;
        document.removeEventListener('mousemove', handleDragging);
        document.removeEventListener('mouseup', stopDragging);
        document.body.style.cursor = 'default';
    }

    $: isLoggedIn = !!$walletStore.account;

    onDestroy(() => {
        if (browser) {
            document.removeEventListener('mousemove', handleDragging);
            document.removeEventListener('mouseup', stopDragging);
            document.body.style.cursor = 'default';
        }
    });
</script>

{#if sidebarOpen}
    <div 
        class="sidebar-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar Menu"
        transition:fade={{ duration: 200 }}
    >
        <button 
            class="overlay-button"
            on:click={onClose}
            aria-label="Close sidebar"
        />
        
        <div 
            class="sidebar pixel-corners"
            class:is-dragging={isDragging}
            class:resize-hovered={isResizeHovered}
            style="width: {$sidebarWidth}px"
            in:fly={{ x: 400, duration: 300, easing: cubicOut }}
            out:fly={{ x: 400, duration: 200, easing: cubicOut }}
        >
            <div 
                class="resize-handle" 
                on:mousedown={startDragging}
                on:mouseenter={() => isResizeHovered = true}
                on:mouseleave={() => isResizeHovered = false}
            >
                <div class="resize-indicator"></div>
            </div>
            <div class="sidebar-content">
                <SidebarHeader 
                    {isLoggedIn}
                    {onClose}
                    bind:activeTab
                />
                
                <div class="main-content">
                    <div class="wallet-list">
                        {#if !isLoggedIn}
                            <WalletProvider 
                                on:login={() => {}}
                            />
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        background-color: var(--overlay-bg);
        backdrop-filter: blur(4px);
        z-index: 100;
        display: flex;
        justify-content: flex-end;
        padding-right: 32px;
        align-items: center;
        pointer-events: all;
    }

    .overlay-button {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        cursor: pointer;
    }

    .sidebar {
        height: 90vh;
        background: var(--sidebar-bg);
        box-shadow: 
            -8px 0 32px var(--shadow-color),
            inset -2px -2px 0px rgba(0,0,0,0.2),
            inset 2px 2px 0px rgba(255,255,255,0.1),
            inset 16px 0 32px -16px var(--depth-shadow);
        overflow: hidden;
        position: relative;
        min-width: 420px;
        max-width: 690px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: right center;
        pointer-events: auto;
    }

    .sidebar:hover {
        box-shadow: 
            -12px 0 48px var(--shadow-color),
            inset -2px -2px 0px rgba(0,0,0,0.3),
            inset 2px 2px 0px rgba(255,255,255,0.15),
            inset 16px 0 32px -16px var(--depth-shadow);
    }

    .pixel-corners {
        clip-path: polygon(
            0px calc(100% - 28px),
            4px calc(100% - 28px),
            4px calc(100% - 20px),
            8px calc(100% - 20px),
            8px calc(100% - 12px),
            12px calc(100% - 12px),
            12px calc(100% - 8px),
            20px calc(100% - 8px),
            20px calc(100% - 4px),
            28px calc(100% - 4px),
            28px 100%,
            calc(100% - 28px) 100%,
            calc(100% - 28px) calc(100% - 4px),
            calc(100% - 20px) calc(100% - 4px),
            calc(100% - 20px) calc(100% - 8px),
            calc(100% - 12px) calc(100% - 8px),
            calc(100% - 12px) calc(100% - 12px),
            calc(100% - 8px) calc(100% - 12px),
            calc(100% - 8px) calc(100% - 20px),
            calc(100% - 4px) calc(100% - 20px),
            calc(100% - 4px) calc(100% - 28px),
            100% calc(100% - 28px),
            100% 28px,
            calc(100% - 4px) 28px,
            calc(100% - 4px) 20px,
            calc(100% - 8px) 20px,
            calc(100% - 8px) 12px,
            calc(100% - 12px) 12px,
            calc(100% - 12px) 8px,
            calc(100% - 20px) 8px,
            calc(100% - 20px) 4px,
            calc(100% - 28px) 4px,
            calc(100% - 28px) 0px,
            28px 0px,
            28px 4px,
            20px 4px,
            20px 8px,
            12px 8px,
            12px 12px,
            8px 12px,
            8px 20px,
            4px 20px,
            4px 28px,
            0px 28px
        );
        border: 4px solid transparent;
    }

    .pixel-corners::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        margin: -4px;
        background: linear-gradient(135deg, var(--active-tab-color) 0%, rgba(97, 201, 255, 0.8) 100%);
        z-index: -1;
        clip-path: polygon(
            0px calc(100% - 28px),
            4px calc(100% - 28px),
            4px 28px,
            0px 28px
        );
    }

    .sidebar-content {
        position: relative;
        height: 100%;
        padding: var(--content-padding);
        z-index: 2;
        background: linear-gradient(180deg, 
            rgba(0,0,0,0.1) 0%,
            rgba(0,0,0,0.05) 50%,
            rgba(0,0,0,0.1) 100%
        );
    }

    .resize-handle {
        position: absolute;
        left: -12px;
        top: 0;
        width: 36px;
        height: 100%;
        cursor: ew-resize;
        background: linear-gradient(to right, 
            transparent 0%,
            var(--sidebar-border) 50%,
            transparent 100%);
        opacity: 0;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        z-index: 101;
    }

    .resize-indicator {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 60px;
        background: var(--sidebar-border);
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: 0 0 8px rgba(97, 201, 255, 0.4);
    }

    .resize-handle:hover {
        opacity: 0.8;
        width: 32px;
        left: -16px;
    }

    .resize-handle:hover .resize-indicator {
        opacity: 1;
    }

    .main-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        margin: 0;
        scrollbar-width: thin;
        scrollbar-color: var(--sidebar-border) transparent;
    }

    .main-content::-webkit-scrollbar {
        width: 6px;
    }

    .main-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .main-content::-webkit-scrollbar-thumb {
        background-color: var(--sidebar-border);
        border-radius: 3px;
        box-shadow: inset 0 0 6px rgba(0,0,0,0.2);
    }

    .wallet-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
    }

    @media (max-width: 768px) {
        .sidebar {
            min-width: 100%;
            height: 100vh;
            border-radius: 0;
        }

        .pixel-corners,
        .pixel-corners::after {
            clip-path: none;
        }

        .main-content {
            padding: 12px;
        }

        .sidebar-overlay {
            padding-right: 0;
        }
    }
</style>
