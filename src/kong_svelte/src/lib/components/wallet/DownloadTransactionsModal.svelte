<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { onMount } from "svelte";
  import { fetchUserTransactions } from "$lib/api/users";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import { FileDown, Calendar, ArrowRightLeft, Droplet, SendHorizonal } from "lucide-svelte";
  import { formatDate } from "$lib/utils/dateFormatters";
  import { processTransaction, formatAmount } from "$lib/utils/transactionUtils";

  // Props
  let {
    isOpen = false,
    onClose = () => {}
  } = $props<{
    isOpen?: boolean;
    onClose?: () => void;
  }>();

  // Form state
  let startDate: string = $state("");
  let endDate: string = $state("");
  let fileFormat = $state("csv");
  let isLoading = $state(false);
  let selectedFilters = $state({
    swap: true,
    pool: true,
    send: true
  });
  
  // Helper to format date as YYYY-MM-DD for date input
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Set default start date to January 1st of current year
  onMount(() => {
    const today = new Date();
    // Set start date to January 1st of the current year
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    startDate = formatDateForInput(firstDayOfYear);
    // Set end date to today
    endDate = formatDateForInput(today);
  });

  // Download transaction data
  async function downloadTransactions() {
    if (!$auth.isConnected || !$auth.account?.owner) {
      toastStore.add({
        type: "error",
        title: "Not Connected",
        message: "Please connect your wallet to download transactions.",
        duration: 3000
      });
      return;
    }

    isLoading = true;
    const principal = $auth.account.owner;
    let allTransactions = [];

    try {
      // Get date objects from string inputs
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Validate date range
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        toastStore.add({
          type: "error",
          title: "Invalid Date Range",
          message: "Please select valid start and end dates.",
          duration: 3000
        });
        isLoading = false;
        return;
      }
      
      if (startDateObj > endDateObj) {
        toastStore.add({
          type: "error",
          title: "Invalid Date Range",
          message: "Start date must be before end date.",
          duration: 3000
        });
        isLoading = false;
        return;
      }

      // Determine which transaction types to fetch
      const typesToFetch = [];
      if (selectedFilters.swap) typesToFetch.push("swap");
      if (selectedFilters.pool) typesToFetch.push("pool");
      if (selectedFilters.send) typesToFetch.push("send");

      if (typesToFetch.length === 0) {
        toastStore.add({
          type: "warning",
          title: "No Filters Selected",
          message: "Please select at least one transaction type.",
          duration: 3000
        });
        isLoading = false;
        return;
      }

      // Fetch transactions for each selected type
      for (const txType of typesToFetch) {
        let hasMore = true;
        let cursor: number | undefined = undefined;
        const PAGE_SIZE = 100; // Larger page size for bulk download

        while (hasMore) {
          // @ts-ignore - txType is a string but the API expects a specific type
          const response = await fetchUserTransactions(principal, cursor, PAGE_SIZE, txType);
          
          if (response.transactions && response.transactions.length > 0) {
            // Process and filter transactions by date
            const processedTransactions = response.transactions
              .map(tx => processTransaction(tx, formatAmount))
              .filter(Boolean)
              .filter(tx => {
                if (!tx) return false;
                
                // Parse transaction date
                let txDate;
                try {
                  // Handle ISO date format
                  if (tx.formattedDate) {
                    const parts = tx.formattedDate.split('/');
                    if (parts.length === 3) {
                      // Assuming format is MM/DD/YYYY
                      txDate = new Date(
                        parseInt(parts[2]), // Year
                        parseInt(parts[0]) - 1, // Month (0-indexed)
                        parseInt(parts[1]) // Day
                      );
                    } else {
                      // Try parsing as-is
                      txDate = new Date(tx.formattedDate);
                    }
                  }
                } catch (e) {
                  // If date parsing fails, include the transaction
                  console.warn("Error parsing date:", tx.formattedDate);
                  return true;
                }

                // Filter by date range
                if (txDate && !isNaN(txDate.getTime())) {
                  // Set time to beginning/end of day for accurate comparison
                  startDateObj.setHours(0, 0, 0, 0);
                  
                  const endDateWithTime = new Date(endDateObj);
                  endDateWithTime.setHours(23, 59, 59, 999);
                  
                  return txDate >= startDateObj && txDate <= endDateWithTime;
                }
                
                // Include if date parsing failed
                return true;
              });

            allTransactions = [...allTransactions, ...processedTransactions];
          }

          hasMore = response.has_more;
          cursor = response.next_cursor;

          // Break if no more pages or if we've exceeded reasonable limits
          if (!hasMore || !cursor || allTransactions.length > 1000) break;
        }
      }

      if (allTransactions.length === 0) {
        toastStore.add({
          type: "info",
          title: "No Transactions Found",
          message: "No transactions were found for the selected date range.",
          duration: 3000
        });
        isLoading = false;
        return;
      }

      // Sort all transactions by date (newest first)
      allTransactions = sortTransactionsByDate(allTransactions);

      // Format the data for download
      let content;
      let filename;
      const datePrefix = `${startDate}_to_${endDate}`;
      
      if (fileFormat === "csv") {
        content = generateCSV(allTransactions);
        filename = `kong_transactions_${datePrefix}.csv`;
      } else {
        content = JSON.stringify(allTransactions, null, 2);
        filename = `kong_transactions_${datePrefix}.json`;
      }

      // Create download link
      const blob = new Blob([content], { type: fileFormat === "csv" ? "text/csv;charset=utf-8;" : "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Success message
      toastStore.add({
        type: "success",
        title: "Download Complete",
        message: `${allTransactions.length} transactions have been downloaded.`,
        duration: 3000
      });
    } catch (err) {
      console.error("Error downloading transactions:", err);
      toastStore.add({
        type: "error",
        title: "Download Failed",
        message: err.message || "Failed to download transaction data.",
        duration: 5000
      });
    } finally {
      isLoading = false;
    }
  }

  // Sort transactions by date (newest first)
  function sortTransactionsByDate(transactions) {
    return [...transactions].sort((a, b) => {
      // Parse dates from the formattedDate field
      const dateA = parseTransactionDate(a.formattedDate);
      const dateB = parseTransactionDate(b.formattedDate);
      
      // If both can be parsed to dates, compare them
      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime(); // Descending (newest first)
      }
      
      // Fall back to direct string comparison if dates can't be parsed
      return (b.formattedDate || '').localeCompare(a.formattedDate || '');
    });
  }
  
  // Parse transaction dates from different formats
  function parseTransactionDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Try to parse MM/DD/YYYY format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(
          parseInt(parts[2]), // Year
          parseInt(parts[0]) - 1, // Month (0-indexed)
          parseInt(parts[1]) // Day
        );
      }
      
      // Try to parse formatted date like "Mar 19, 2025, 9:05 AM"
      const match = dateStr.match(/([A-Za-z]+)\s+(\d+),\s+(\d+),\s+(\d+):(\d+)\s+([AP]M)/);
      if (match) {
        const [_, month, day, year, hour, minute, ampm] = match;
        const months = {
          Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
          Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
        };
        
        let hours = parseInt(hour);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        return new Date(
          parseInt(year),
          months[month],
          parseInt(day),
          hours,
          parseInt(minute)
        );
      }
      
      // Try to parse as ISO format
      return new Date(dateStr);
    } catch (e) {
      console.warn("Error parsing date:", dateStr, e);
      return null;
    }
  }

  // Generate CSV content
  function generateCSV(transactions) {
    const headers = ["Date", "Type", "Status", "Details", "Transaction ID"];
    
    const rows = transactions.map(tx => {
      let details = "";
      
      // Format date consistently for CSV export
      let formattedDate = tx.formattedDate;
      
      // If we need to reformat the date for consistency with the UI display
      try {
        if (tx.timestamp) {
          formattedDate = formatDate(new Date(tx.timestamp));
        } else if (tx.formattedDate) {
          // Try to convert from MM/DD/YYYY format to a standardized format
          const parts = tx.formattedDate.split('/');
          if (parts.length === 3) {
            const date = new Date(
              parseInt(parts[2]), // Year
              parseInt(parts[0]) - 1, // Month (0-indexed)
              parseInt(parts[1]) // Day
            );
            formattedDate = formatDate(date);
          }
        }
      } catch (e) {
        // Keep the original format if parsing fails
        console.warn("Error reformatting date for CSV:", tx.formattedDate);
      }

      if (tx.type === "Swap") {
        details = `${tx.details.pay_amount} ${tx.details.pay_token_symbol} → ${tx.details.receive_amount} ${tx.details.receive_token_symbol}`;
      } else if (tx.type === "Send") {
        details = `${tx.details.amount} ${tx.details.token_symbol}`;
      } else {
        details = `${tx.details.amount_0} ${tx.details.token_0_symbol} + ${tx.details.amount_1} ${tx.details.token_1_symbol}`;
      }

      return [formattedDate, tx.type, tx.status, details, tx.tx_id].map(escapeCSV);
    });

    return [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
  }
  
  // Properly escape CSV values to handle commas, quotes, etc.
  function escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Convert to string
    const stringValue = String(value);
    
    // Check if we need to quote this value (contains comma, quote, or newline)
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      // Escape quotes by doubling them
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }
</script>

<Modal
  {isOpen}
  variant="solid"
  {onClose}
  title="Download Transaction History"
  width="480px"
  height="auto"
>
  <div class="space-y-5">
    <p class="text-sm text-kong-text-secondary mb-4">
      Download your transaction history for the selected date range and transaction types.
    </p>

    <!-- Date Range Selection -->
    <div class="space-y-3">
      <div class="text-sm font-medium text-kong-text-primary">Date Range</div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label for="start-date" class="text-xs text-kong-text-secondary">Start Date</label>
          <div class="relative">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-kong-text-secondary">
              <Calendar size={14} />
            </div>
            <input
              id="start-date"
              type="date"
              bind:value={startDate}
              class="w-full pl-8 pr-3 py-2 rounded-lg bg-kong-bg-primary border border-kong-border text-sm text-kong-text-primary focus:outline-none focus:ring-1 focus:ring-kong-primary focus:border-kong-primary"
            />
          </div>
        </div>
        
        <div class="space-y-1">
          <label for="end-date" class="text-xs text-kong-text-secondary">End Date</label>
          <div class="relative">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-kong-text-secondary">
              <Calendar size={14} />
            </div>
            <input
              id="end-date"
              type="date"
              bind:value={endDate}
              class="w-full pl-8 pr-3 py-2 rounded-lg bg-kong-bg-primary border border-kong-border text-sm text-kong-text-primary focus:outline-none focus:ring-1 focus:ring-kong-primary focus:border-kong-primary"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction Type Selection -->
    <div class="space-y-3">
      <div class="text-sm font-medium text-kong-text-primary">Transaction Types</div>
      
      <div class="flex flex-wrap gap-3">
        <label 
          class="flex items-center gap-2 px-3 py-2 rounded-lg border {selectedFilters.swap ? 'border-kong-primary bg-kong-primary/10' : 'border-kong-border'} cursor-pointer transition-colors"
        >
          <input 
            type="checkbox" 
            bind:checked={selectedFilters.swap} 
            class="hidden"
          />
          <ArrowRightLeft size={16} class="{selectedFilters.swap ? 'text-kong-primary' : 'text-kong-text-secondary'}" />
          <span class="text-sm {selectedFilters.swap ? 'text-kong-primary' : 'text-kong-text-secondary'}">Swaps</span>
        </label>
        
        <label 
          class="flex items-center gap-2 px-3 py-2 rounded-lg border {selectedFilters.pool ? 'border-kong-primary bg-kong-primary/10' : 'border-kong-border'} cursor-pointer transition-colors"
        >
          <input 
            type="checkbox" 
            bind:checked={selectedFilters.pool} 
            class="hidden"
          />
          <Droplet size={16} class="{selectedFilters.pool ? 'text-kong-primary' : 'text-kong-text-secondary'}" />
          <span class="text-sm {selectedFilters.pool ? 'text-kong-primary' : 'text-kong-text-secondary'}">Pools</span>
        </label>
        
        <label 
          class="flex items-center gap-2 px-3 py-2 rounded-lg border {selectedFilters.send ? 'border-kong-primary bg-kong-primary/10' : 'border-kong-border'} cursor-pointer transition-colors"
        >
          <input 
            type="checkbox" 
            bind:checked={selectedFilters.send} 
            class="hidden"
          />
          <SendHorizonal size={16} class="{selectedFilters.send ? 'text-kong-primary' : 'text-kong-text-secondary'}" />
          <span class="text-sm {selectedFilters.send ? 'text-kong-primary' : 'text-kong-text-secondary'}">Transfers</span>
        </label>
      </div>
    </div>

    <!-- File Format Selection -->
    <div class="space-y-3">
      <div class="text-sm font-medium text-kong-text-primary">File Format</div>
      
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="fileFormat"
            value="csv"
            bind:group={fileFormat}
            class="form-radio text-kong-primary focus:ring-kong-primary h-4 w-4"
          />
          <span class="text-sm text-kong-text-primary">CSV</span>
        </label>
        
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="fileFormat"
            value="json"
            bind:group={fileFormat}
            class="form-radio text-kong-primary focus:ring-kong-primary h-4 w-4"
          />
          <span class="text-sm text-kong-text-primary">JSON</span>
        </label>
      </div>
    </div>

    <!-- Download Progress Indicator -->
    {#if isLoading}
      <div class="bg-kong-bg-primary/80 border border-kong-border rounded-lg p-3 mt-2">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-kong-text-primary">Downloading transactions...</span>
          <div class="flex items-center">
            <div class="h-2 w-2 bg-kong-primary rounded-full animate-pulse mr-1"></div>
            <div class="h-2 w-2 bg-kong-primary rounded-full animate-pulse delay-150 mr-1"></div>
            <div class="h-2 w-2 bg-kong-primary rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
        <div class="w-full bg-kong-border rounded-full h-1.5">
          <div class="bg-kong-primary h-1.5 rounded-full animate-pulse w-full"></div>
        </div>
      </div>
    {/if}

    <!-- Download Button -->
    <button
      onclick={downloadTransactions}
      disabled={isLoading}
      class="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-lg bg-kong-primary hover:bg-kong-primary-hover text-white font-medium transition-colors {isLoading ? 'opacity-80 cursor-not-allowed' : ''}"
    >
      {#if isLoading}
        <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
        <span>Downloading...</span>
      {:else}
        <FileDown size={18} />
        <span>Download Transaction History</span>
      {/if}
    </button>
  </div>
</Modal>
