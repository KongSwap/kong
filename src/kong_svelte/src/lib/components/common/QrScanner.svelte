<script lang="ts">
    import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
    import { onDestroy, onMount } from 'svelte';
    import Modal from './Modal.svelte';
    import { toastStore } from "$lib/stores/toastStore";
    import { Principal } from "@dfinity/principal";

    // Props type definition
    type QrScannerProps = {
        isOpen: boolean;
        onClose: () => void;
        onScan: (text: string) => void;
    };

    // Destructure props
    let { 
        isOpen = false, 
        onClose = () => {}, 
        onScan = () => {}
    }: QrScannerProps = $props();

    // State variables using Svelte 5 syntax
    let scanner = $state<Html5Qrcode | null>(null);
    let scannedData = $state<string | null>(null);
    let showConfirmation = $state(false);
    let modalMounted = $state(false);
    let fileInput: HTMLInputElement;

    async function checkCameraSupport() {
        try {
            const devices = await Html5Qrcode.getCameras();
            return devices.length > 0;
        } catch (err) {
            console.error('Error checking cameras:', err);
            return false;
        }
    }

    async function startScanner() {
        if (!scanner) return;
        
        try {
            if (scanner.isScanning) {
                await scanner.stop();
            }

            const devices = await Html5Qrcode.getCameras();
            if (!devices?.length) throw new Error('No cameras found');

            // Prefer back camera
            const selectedCamera = devices.find(device => 
                device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('rear')
            ) || devices[0];

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                videoConstraints: {
                    deviceId: selectedCamera.id,
                    width: { min: 640, ideal: 1080, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 }
                }
            };

            await scanner.start(
                selectedCamera.id,
                config,
                async (decodedText: string) => {
                    if (scanner) await scanner.stop();
                    scannedData = decodedText.trim();
                    showConfirmation = true;
                },
                () => {} // Suppress error messages during scanning
            );
        } catch (err) {
            console.error('Error starting scanner:', err);
            toastStore.error('Failed to start camera. Please check permissions and ensure you\'re using HTTPS.');
            onClose();
        }
    }

    async function initializeScanner() {
        try {
            if (scanner?.isScanning) {
                await scanner.stop();
                scanner.clear();
            }
            scanner = null;

            scanner = new Html5Qrcode("qr-reader", { 
                verbose: false,
                formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
            });
            
            const hasCamera = await checkCameraSupport();
            if (hasCamera) {
                await startScanner();
            } else {
                toastStore.info('No camera available. You can still upload QR code images.');
            }
        } catch (err) {
            console.error('Error initializing scanner:', err);
            toastStore.error('Camera not available. You can still upload QR code images.');
        }
    }

    async function closeScanner() {
        if (scanner?.isScanning) {
            try {
                await scanner.stop();
                scanner.clear();
            } catch (err) {
                console.error('Error closing scanner:', err);
            }
        }
        scanner = null;
        scannedData = null;
        showConfirmation = false;
        onClose();
    }

    async function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        try {
            if (!scanner) {
                scanner = new Html5Qrcode("qr-reader");
            }
            const result = await scanner.scanFile(input.files[0], true) as string;
            scannedData = result.trim();
            showConfirmation = true;
        } catch (err) {
            console.error('Error scanning file:', err);
            toastStore.error('Failed to scan QR code from image');
        }
    }

    function handleConfirmScan() {
        if (scannedData) {
            onScan(scannedData);
            closeScanner();
        }
    }

    function handleRejectScan() {
        scannedData = null;
        showConfirmation = false;
        startScanner();
    }

    function getAddressType(address: string): 'principal' | 'account' | 'unknown' {
        // Check for Account ID (64 character hex string)
        if (address.length === 64 && /^[0-9a-fA-F]+$/.test(address)) {
            return 'account';
        }

        // Check for Principal ID
        try {
            Principal.fromText(address);
            return 'principal';
        } catch {
            return 'unknown';
        }
    }

    function formatAddress(address: string): string {
        if (!address) return '';
        const type = getAddressType(address);
        
        if (type === 'principal') {
            // For Principal IDs, show more context: xxxx-xxxx...xxxx-xxxx
            const segments = address.split('-');
            if (segments.length > 4) {
                return `${segments.slice(0, 2).join('-')}...${segments.slice(-2).join('-')}`;
            }
        } else if (type === 'account') {
            // For Account IDs, show first and last 10 chars
            const start = address.slice(0, 10);
            const end = address.slice(-10);
            return `${start}...${end}`;
        }
        
        return address;
    }

    onMount(() => {
        if (isOpen) {
            setTimeout(() => modalMounted = true, 100);
        }
    });

    onDestroy(() => {
        closeScanner();
    });

    // Use $effect instead of reactivity statements
    $effect(() => {
        if (isOpen) {
            setTimeout(() => modalMounted = true, 100);
        } else {
            modalMounted = false;
        }
    });

    $effect(() => {
        if (isOpen && modalMounted) {
            initializeScanner();
        }
    });
</script>

{#if isOpen}
<Modal
    {isOpen}
    onClose={closeScanner}
    title="Scan QR Code"
    width="min(450px, 95vw)"
    height="auto"
>
    <div class="scanner-container">
        {#if showConfirmation}
            <div class="confirmation-dialog">
                <h3>Confirm Scanned Address</h3>
                <div class="scanned-data">
                    <div class="address-type">
                        {#if getAddressType(scannedData || '') === 'principal'}
                            <span class="badge principal">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                Principal ID
                            </span>
                        {:else if getAddressType(scannedData || '') === 'account'}
                            <span class="badge account">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="M12 12h.01" />
                                </svg>
                                Account ID
                            </span>
                        {:else}
                            <span class="badge unknown">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" />
                                </svg>
                                Unknown Format
                            </span>
                        {/if}
                    </div>
                    <div class="address-display">
                        <div class="formatted-address">
                            {formatAddress(scannedData || '')}
                        </div>
                        <div class="divider" />
                        <div class="full-address-container">
                            <span class="label">Full Address</span>
                            <span class="full-address">{scannedData}</span>
                        </div>
                    </div>
                </div>
                <div class="confirmation-buttons">
                    <button 
                        class="confirm-btn"
                        onclick={handleConfirmScan}
                        disabled={getAddressType(scannedData || '') === 'unknown'}
                    >
                        Confirm
                    </button>
                    <button 
                        class="reject-btn"
                        onclick={handleRejectScan}
                    >
                        Scan Again
                    </button>
                </div>
            </div>
        {:else}
            <div id="qr-reader" style="width: 100%; max-width: 300px;"></div>
            <div class="scanner-controls">
                <div class="primary-controls">
                    <button 
                        class="cancel-scan-btn"
                        onclick={closeScanner}
                    >
                        Cancel Scan
                    </button>
                </div>
                <div class="file-upload">
                    <label class="file-upload-btn" for="qr-input">
                        Upload QR Image
                    </label>
                    <input
                        bind:this={fileInput}
                        id="qr-input"
                        type="file"
                        accept="image/*"
                        onchange={handleFileUpload}
                        class="hidden"
                    />
                </div>
            </div>
        {/if}
    </div>
</Modal>
{/if}

<style scoped lang="postcss">
    .scanner-container {
        @apply p-4 flex flex-col items-center gap-4;
        min-height: 400px;
    }

    .hidden {
        display: none;
    }

    :global(#qr-reader) {
        @apply w-full max-w-[300px] mx-auto bg-black/20 rounded-lg overflow-hidden;
        min-height: 300px;
        position: relative;
        
        :global(video) {
            @apply rounded-lg w-full h-full object-cover;
            position: absolute;
            top: 0;
            left: 0;
        }

        :global(#qr-reader__header_message),
        :global(#qr-reader__filescan_input),
        :global(#qr-reader__dashboard_section_csr),
        :global(#qr-reader__status_span),
        :global(button.html5-qrcode-element) {
            @apply hidden;
        }

        :global(#qr-reader__scan_region) {
            @apply bg-transparent rounded-lg relative;
            border: 2px solid theme('colors.indigo.500') !important;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1;
        }
    }

    .scanner-controls {
        @apply flex flex-col gap-3 mt-4 w-full max-w-[300px];
    }

    .primary-controls {
        @apply flex gap-3 justify-center;
    }

    .file-upload {
        @apply flex justify-center mt-2;
    }

    .file-upload-btn {
        @apply px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 
               text-white rounded-lg cursor-pointer transition-colors;
    }

    .cancel-scan-btn {
        @apply px-4 py-2 bg-white/10 hover:bg-white/15 text-white/90 rounded-lg;
    }

    .confirmation-dialog {
        @apply w-full max-w-[300px] flex flex-col gap-6;
    }

    .confirmation-dialog h3 {
        @apply text-xl font-medium text-white/90 text-center;
    }

    .scanned-data {
        @apply bg-black/20 rounded-xl p-6 flex flex-col gap-4;
    }

    .address-type {
        @apply flex justify-center;
    }

    .badge {
        @apply px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2;
    }

    .icon {
        @apply w-4 h-4;
    }

    .badge.principal {
        @apply bg-indigo-500/20 text-indigo-300 border border-indigo-500/30;
    }

    .badge.account {
        @apply bg-green-500/20 text-green-300 border border-green-500/30;
    }

    .badge.unknown {
        @apply bg-red-500/20 text-red-300 border border-red-500/30;
    }

    .address-display {
        @apply flex flex-col gap-4;
    }

    .formatted-address {
        @apply font-mono text-xl text-white/90 text-center tracking-wide;
    }

    .divider {
        @apply h-px bg-white/10 w-full;
    }

    .full-address-container {
        @apply flex flex-col gap-1;
    }

    .label {
        @apply text-xs text-white/50 uppercase tracking-wider text-center;
    }

    .full-address {
        @apply font-mono text-xs text-white/70 break-all text-center bg-black/20 
               rounded-lg p-3 border border-white/5;
    }

    .confirmation-buttons {
        @apply flex gap-3 justify-center;
    }

    .confirmation-buttons button {
        @apply px-6 py-2.5 rounded-lg transition-colors font-medium;
    }

    .confirm-btn {
        @apply bg-indigo-600 hover:bg-indigo-500 text-white 
               disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .reject-btn {
        @apply bg-white/10 hover:bg-white/15 text-white/90;
    }
</style> 