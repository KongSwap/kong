import { formatDate } from "./dateFormatters";
import { formatUsdValue } from "./tokenFormatters";

/**
 * Formats a numeric amount to a human-readable string
 */
export function formatAmount(amount: number | string): string {
  try {
    if (amount === undefined || amount === null) return "0";

    if (typeof amount === "string") {
      amount = parseFloat(amount);
    }

    if (isNaN(amount)) return "0";

    // Convert to string without scientific notation
    const str = amount.toLocaleString("fullwide", {
      useGrouping: false,
      maximumFractionDigits: 20,
    });

    // Remove trailing zeros after decimal point
    if (str.includes(".")) {
      return str.replace(/\.?0+$/, "");
    }
    return str;
  } catch (err) {
    console.warn("Error formatting amount:", amount, err);
    return "0";
  }
}

/**
 * Process transaction data from API to display format
 */
export function processTransaction(tx: any, formatter: typeof formatAmount) {
  if (!tx?.tx_type) {
    return null;
  }

  const { tx_type, status, timestamp, details } = tx;

  // Handle timestamp
  let formattedDate;
  try {
    if (timestamp) {
      if (typeof timestamp === "string" && timestamp.includes("T")) {
        // Handle ISO date string
        const date = new Date(timestamp);
        formattedDate = !isNaN(date.getTime()) 
          ? formatDate(date) 
          : formatDate(new Date());
      } else {
        // Handle numeric timestamp
        let dateInMs = Number(timestamp);
        // Handle nanoseconds
        if (dateInMs > 1e15) {
          dateInMs = Math.floor(dateInMs / 1_000_000);
        }
        formattedDate = !isNaN(dateInMs) 
          ? formatDate(new Date(dateInMs)) 
          : formatDate(new Date());
      }
    } else {
      formattedDate = formatDate(new Date());
    }
  } catch (err) {
    formattedDate = formatDate(new Date());
  }

  // Generate transaction ID if missing
  const txId = tx.tx_id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    if (tx_type === "swap") {
      return {
        type: "Swap",
        status,
        formattedDate,
        details: {
          ...details,
          pay_amount: formatter(details?.pay_amount || 0),
          receive_amount: formatter(details?.receive_amount || 0),
          price: formatter(details?.price || 0),
        },
        tx_id: txId,
      };
    } else if (
      tx_type === "add_liquidity" ||
      tx_type === "remove_liquidity" ||
      tx_type === "pool"
    ) {
      const type =
        tx_type === "add_liquidity"
          ? "Add Liquidity"
          : tx_type === "remove_liquidity"
            ? "Remove Liquidity"
            : details?.type === "add"
              ? "Add Liquidity"
              : "Remove Liquidity";
      return {
        type,
        status,
        formattedDate,
        details: {
          ...details,
          amount_0: formatter(details?.amount_0 || 0),
          amount_1: formatter(details?.amount_1 || 0),
          lp_token_amount: formatter(details?.lp_token_amount || 0),
        },
        tx_id: txId,
      };
    } else if (tx_type === "send") {
      return {
        type: "Send",
        status,
        formattedDate,
        details: {
          ...details,
          amount: formatter(details?.amount || 0),
        },
        tx_id: txId,
      };
    }
  } catch (err) {
    console.error("Error processing transaction:", err);
  }

  return null;
}

/**
 * Get icon for transaction type
 */
export function getTransactionIcon(type: string) {
  switch (type) {
    case "Swap":
      return "ArrowRightLeft";
    case "Add Liquidity":
      return "Plus";
    case "Remove Liquidity":
      return "Minus";
    case "Send":
      return "ArrowUpRight";
    case "Receive":
      return "ArrowDownRight";
    default:
      return "Repeat";
  }
}

// Utility function to format principal IDs
export function formatPrincipalId(principalId: string): string {
  if (principalId && principalId.endsWith("-2")) {
    return principalId.slice(0, -2);
  }
  return principalId;
}

// Utility function to properly handle UTC timestamps
export function formatTimestamp(timestamp: string | number): Date {
  if (typeof timestamp === 'string' && !timestamp.endsWith('Z') && !timestamp.includes('+')) {
    return new Date(timestamp + 'Z');
  }
  return new Date(timestamp);
}

// Calculate total USD value for a transaction
export function calculateTotalUsdValue(
  tx: FE.Transaction, 
  tokens: Kong.Token[]
): string {
  const payToken = tokens.find((t) => t.id === tx.pay_token_id);
  const receiveToken = tokens.find((t) => t.id === tx.receive_token_id);
  
  if (!payToken || !receiveToken) return "0.00";

  const payUsdValue = payToken.symbol === "ckUSDT"
    ? tx.pay_amount
    : tx.pay_amount * (Number(payToken.metrics.price) || 0);

  const receiveUsdValue = receiveToken.symbol === "ckUSDT"
    ? tx.receive_amount
    : tx.receive_amount * (Number(receiveToken.metrics.price) || 0);

  return formatUsdValue(Math.max(payUsdValue, receiveUsdValue));
}

// Simple loading state manager
export class LoadingStateManager {
  private states = new Set<string>();

  isLoading(key: string): boolean {
    return this.states.has(key);
  }

  setLoading(key: string, loading: boolean): void {
    if (loading) {
      this.states.add(key);
    } else {
      this.states.delete(key);
    }
  }

  isAnyLoading(): boolean {
    return this.states.size > 0;
  }

  clear(): void {
    this.states.clear();
  }
} 