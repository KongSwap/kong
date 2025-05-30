import { CrossChainSwapService } from "./CrossChainSwapService";
import { toastStore } from "$lib/stores/toastStore";
import { writable, get } from "svelte/store";
import type { SwapJob } from "./CrossChainSwapService";

interface CrossChainSwapStatus {
  jobId: bigint;
  status: string;
  payToken: string;
  receiveToken: string;
  payAmount: string;
  receiveAmount: string;
  startTime: number;
  lastUpdate: number;
  toastId?: string;
  error?: string;
  payTxSignature?: string;
  receiveTxSignature?: string;
}

// Store for active cross-chain swaps
export const crossChainSwapStore = writable<Record<string, CrossChainSwapStatus>>({});

export class CrossChainSwapMonitor {
  private static pollingIntervals: Map<string, number> = new Map();
  
  /**
   * Start monitoring a cross-chain swap job
   */
  public static async startMonitoring(
    jobId: bigint,
    payToken: string,
    receiveToken: string,
    payAmount: string,
    receiveAmount: string
  ): Promise<void> {
    const jobIdStr = jobId.toString();
    
    // Stop any existing monitoring for this job
    this.stopMonitoring(jobIdStr);
    
    // Initialize swap status
    const initialStatus: CrossChainSwapStatus = {
      jobId,
      status: 'Pending',
      payToken,
      receiveToken,
      payAmount,
      receiveAmount,
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    
    // Create initial toast notification
    const toastId = toastStore.info(
      `🔄 Processing ${payToken} → ${receiveToken} swap...`,
      { duration: undefined } // Keep toast until we dismiss it
    );
    
    initialStatus.toastId = toastId;
    
    // Update store
    crossChainSwapStore.update(swaps => ({
      ...swaps,
      [jobIdStr]: initialStatus
    }));
    
    // Start polling every 200ms
    const intervalId = window.setInterval(async () => {
      await this.pollJobStatus(jobIdStr);
    }, 200);
    
    this.pollingIntervals.set(jobIdStr, intervalId);
    
    // Also do an immediate poll
    await this.pollJobStatus(jobIdStr);
  }
  
  /**
   * Poll job status once
   */
  private static async pollJobStatus(jobIdStr: string): Promise<void> {
    try {
      const currentStatus = get(crossChainSwapStore)[jobIdStr];
      if (!currentStatus) {
        this.stopMonitoring(jobIdStr);
        return;
      }
      
      const job = await CrossChainSwapService.getSwapJob(currentStatus.jobId);
      
      if (!job) {
        // Job not found yet, keep polling
        return;
      }
      
      const statusKey = Object.keys(job.status)[0];
      const statusChanged = statusKey !== currentStatus.status;
      
      // Update status
      crossChainSwapStore.update(swaps => ({
        ...swaps,
        [jobIdStr]: {
          ...currentStatus,
          status: statusKey,
          lastUpdate: Date.now(),
          payTxSignature: job.pay_tx_signature?.[0],
          receiveTxSignature: job.solana_tx_signature_of_payout?.[0]
        }
      }));
      
      // Update toast if status changed
      if (statusChanged) {
        this.updateToastForStatus(currentStatus, statusKey, job);
      }
      
      // Stop polling if terminal state reached
      if (statusKey === 'Confirmed' || statusKey === 'Failed') {
        this.stopMonitoring(jobIdStr);
        
        // Remove from store after 30 seconds
        setTimeout(() => {
          crossChainSwapStore.update(swaps => {
            const { [jobIdStr]: removed, ...rest } = swaps;
            return rest;
          });
        }, 30000);
      }
      
    } catch (error) {
      console.error('Error polling job status:', error);
      
      // Update error state
      const currentStatus = get(crossChainSwapStore)[jobIdStr];
      if (currentStatus) {
        crossChainSwapStore.update(swaps => ({
          ...swaps,
          [jobIdStr]: {
            ...currentStatus,
            error: error.message || 'Unknown error',
            lastUpdate: Date.now()
          }
        }));
      }
    }
  }
  
  /**
   * Update toast notification based on status
   */
  private static updateToastForStatus(
    swapStatus: CrossChainSwapStatus,
    status: string,
    job: SwapJob
  ): void {
    // Dismiss old toast if exists
    if (swapStatus.toastId) {
      toastStore.dismiss(swapStatus.toastId);
    }
    
    let message = '';
    let toastType: 'info' | 'success' | 'error' = 'info';
    let duration: number | undefined = undefined;
    
    switch (status) {
      case 'Pending':
        message = `⏳ Waiting for confirmation: ${swapStatus.payToken} → ${swapStatus.receiveToken}`;
        break;
        
      case 'Processing':
        message = `⚙️ Processing swap: ${swapStatus.payToken} → ${swapStatus.receiveToken}`;
        break;
        
      case 'WaitingForSignature':
        message = `✍️ Waiting for signature: ${swapStatus.payToken} → ${swapStatus.receiveToken}`;
        break;
        
      case 'SendingToSolana':
        message = `📤 Sending to Solana: ${swapStatus.receiveAmount} ${swapStatus.receiveToken}`;
        break;
        
      case 'Confirmed':
        message = `✅ Swap completed! ${swapStatus.payAmount} ${swapStatus.payToken} → ${swapStatus.receiveAmount} ${swapStatus.receiveToken}`;
        toastType = 'success';
        duration = 10000; // Show success for 10 seconds
        
        // Add transaction links if available
        if (job.solana_tx_signature_of_payout?.[0]) {
          message += `\n<a href="https://solscan.io/tx/${job.solana_tx_signature_of_payout[0]}" target="_blank" class="underline">View on Solscan</a>`;
        }
        break;
        
      case 'Failed':
        message = `❌ Swap failed: ${swapStatus.payToken} → ${swapStatus.receiveToken}`;
        toastType = 'error';
        duration = 10000;
        
        // Add error details if available
        const errorDetails = job.status['Failed'];
        if (errorDetails && typeof errorDetails === 'string') {
          message += `\nReason: ${errorDetails}`;
        }
        break;
        
      default:
        message = `🔄 ${status}: ${swapStatus.payToken} → ${swapStatus.receiveToken}`;
    }
    
    // Create new toast
    let newToastId: string;
    if (toastType === 'success') {
      newToastId = toastStore.success(message, { duration, html: true });
    } else if (toastType === 'error') {
      newToastId = toastStore.error(message, { duration });
    } else {
      newToastId = toastStore.info(message, { duration });
    }
    
    // Update toast ID in store
    crossChainSwapStore.update(swaps => ({
      ...swaps,
      [job.id.toString()]: {
        ...swaps[job.id.toString()],
        toastId: newToastId
      }
    }));
  }
  
  /**
   * Stop monitoring a specific job
   */
  public static stopMonitoring(jobIdStr: string): void {
    const intervalId = this.pollingIntervals.get(jobIdStr);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(jobIdStr);
    }
    
    // Dismiss any active toast
    const currentStatus = get(crossChainSwapStore)[jobIdStr];
    if (currentStatus?.toastId) {
      toastStore.dismiss(currentStatus.toastId);
    }
  }
  
  /**
   * Stop all monitoring
   */
  public static stopAllMonitoring(): void {
    for (const jobIdStr of this.pollingIntervals.keys()) {
      this.stopMonitoring(jobIdStr);
    }
  }
  
  /**
   * Get elapsed time for a swap
   */
  public static getElapsedTime(jobIdStr: string): string {
    const swap = get(crossChainSwapStore)[jobIdStr];
    if (!swap) return '';
    
    const elapsed = Date.now() - swap.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}