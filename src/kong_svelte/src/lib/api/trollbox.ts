import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
import { auth, trollboxActor } from "$lib/stores/auth";
import { Principal } from "@dfinity/principal";
import { get } from "svelte/store";
import * as tokensApi from "$lib/api/tokens";

export interface Message {
  id: bigint;
  message: string;
  principal: Principal;
  created_at: bigint;
}

export interface PaginationParams {
  cursor?: bigint;
  limit?: bigint;
}

export interface MessagesPage {
  messages: Message[];
  next_cursor: bigint | null;
}

export interface MessagePayload {
  message: string;
}

// Cache for token data
let tokenCache: Record<
  string,
  {
    symbol: string;
    price: string;
    price_change_24h: string;
    timestamp: number;
  }
> = {};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache for admin status check
let isAdminCache: boolean | null = null;
let isAdminCacheExpiry = 0;
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function processMessageTokens(message: Message): Promise<Message> {
  const tokenPattern = /#([a-z0-9-]+)/g;
  const matches = [...message.message.matchAll(tokenPattern)];

  if (!matches.length) return message;

  let processedMessage = message.message;
  const canisterIds = matches.map((match) => match[1]);

  // Filter out canisterIds that are already in cache and still valid
  const now = Date.now();
  const canisterIdsToFetch = canisterIds.filter((id) => {
    const cached = tokenCache[id];
    return !cached || now - cached.timestamp > CACHE_TTL;
  });

  try {
    // Only fetch tokens that aren't in cache or are expired
    if (canisterIdsToFetch.length > 0) {
      const tokens =
        await tokensApi.fetchTokensByCanisterId(canisterIdsToFetch);
      tokens.forEach((token) => {
        // Update cache
        tokenCache[token.address] = {
          symbol: token.symbol,
          price: formatToNonZeroDecimal(token.metrics.price),
          price_change_24h: formatToNonZeroDecimal(
            token.metrics.price_change_24h || 0,
          ),
          timestamp: now,
        };
      });
    }

    // Replace all tokens in message using cache
    canisterIds.forEach((canisterId) => {
      const token = tokenCache[canisterId];
      if (token) {
        const pattern = new RegExp(`#${canisterId}`, "g");
        processedMessage = processedMessage.replace(
          pattern,
          `<a href="/stats/${canisterId}" class="token-link" data-canister-id="${canisterId}" onclick="event.stopPropagation();"><span class="bg-kong-primary/20 rounded-md px-1.5 py-0.5 text-kong-text-primary">${token.symbol} - <span class="${Number(token.price_change_24h) > 0 ? "text-kong-success" : "text-kong-error"}">${token.price} (${token.price_change_24h}%)</span></span></a>`,
        );
      }
    });
  } catch (error) {
    console.error("Error processing tokens in message:", error);
  }

  return { ...message, message: processedMessage };
}

export async function getMessages(
  params?: PaginationParams,
): Promise<MessagesPage> {
  const actor = trollboxActor({ anon: true });

  // Construct candid params according to the interface definition
  // PaginationParams = IDL.Record({ cursor: IDL.Opt(IDL.Nat64), limit: IDL.Opt(IDL.Nat64) })
  const candid_params = {
    cursor: params?.cursor ? ([params.cursor] as [bigint]) : ([] as []),
    limit: params?.limit ? ([params.limit] as [bigint]) : ([] as []),
  };

  const result = await actor.get_messages([candid_params]); // Wrap in array for IDL.Opt

  // Process tokens in all messages
  const processedMessages = await Promise.all(
    result.messages.map(processMessageTokens),
  );

  return {
    messages: processedMessages,
    next_cursor: result.next_cursor[0] ?? null, // Unwrap IDL.Opt result
  };
}

export async function getMessage(id: bigint): Promise<Message | null> {
  const actor = trollboxActor({ anon: true });
  const result = await actor.get_message(id);
  if (result.length === 0) return null;

  // Process tokens in the message
  return processMessageTokens(result[0]);
}

export async function createMessage(payload: MessagePayload): Promise<Message> {
  const actor = trollboxActor({ anon: false, requiresSigning: true });

  try {
    const result = await actor.create_message(payload.message);
    if ("Err" in result) {
      throw new Error(result.Err);
    }
    // Process tokens in the new message
    return processMessageTokens(result.Ok);
  } catch (error) {
    console.error("Create message error:", error);

    // Handle different error types and extract the meaningful error message
    if (error instanceof Error) {
      // Could be our own thrown error or a network/system error
      throw error;
    } else if (typeof error === "object" && error !== null) {
      // Handle IC rejection errors which might be deeply nested
      const message = extractErrorMessage(error);
      throw new Error(message || "Failed to send message");
    }
    throw new Error("Failed to send message");
  }
}

// Helper function to extract meaningful error messages from IC rejection objects
function extractErrorMessage(error: any): string | null {
  // Check for common error patterns in IC responses
  if (error.message) return error.message;
  if (typeof error.toString === "function") {
    const errorStr = error.toString();
    if (errorStr !== "[object Object]") return errorStr;
  }

  // Check for rejection message in various formats
  if (error.reject_message) return error.reject_message;
  if (error.error_message) return error.error_message;

  // Look for nested error objects
  for (const key of ["error", "cause", "detail", "details"]) {
    if (error[key]) {
      if (typeof error[key] === "string") return error[key];
      if (typeof error[key] === "object") {
        const nested = extractErrorMessage(error[key]);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/**
 * Check if the current authenticated user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const now = Date.now();

  // Return cached result if available and not expired
  if (isAdminCache !== null && now < isAdminCacheExpiry) {
    return isAdminCache;
  }

  // Need authentication to check admin status
  const authState = get(auth);
  if (!authState.isConnected) {
    return false;
  }

  try {
    const actor = trollboxActor({ anon: true });

    // Call is_admin with principal as a string instead of a Principal object
    const result = await actor.is_admin(authState.account.owner);

    // Cache the result
    isAdminCache = result;
    isAdminCacheExpiry = now + ADMIN_CACHE_TTL;

    return result;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Delete a message (admin only)
 */
export async function deleteMessage(messageId: bigint): Promise<boolean> {
  const authState = get(auth);
  if (!authState.isConnected) {
    throw new Error("Authentication required");
  }

  try {
    const actor = trollboxActor({ anon: false, requiresSigning: true });
    const result = await actor.delete_message(messageId);

    if ("Err" in result) {
      throw new Error(result.Err);
    }

    return true;
  } catch (error) {
    console.error("Error deleting message:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to delete message");
  }
}

/**
 * Ban a user for a specified number of days (admin only)
 */
export async function banUser(
  principal: Principal,
  days: bigint,
): Promise<boolean> {
  const authState = get(auth);
  if (!authState.isConnected) {
    throw new Error("Authentication required");
  }

  try {
    const actor = trollboxActor({ anon: false, requiresSigning: true });

    const result = await actor.ban_user(principal, days);

    if ("Err" in result) {
      throw new Error(result.Err);
    }

    return true;
  } catch (error) {
    console.error("Error banning user:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to ban user");
  }
}

/**
 * Unban a user (admin only)
 */
export async function unbanUser(principal: Principal): Promise<boolean> {
  const authState = get(auth);
  if (!authState.isConnected) {
    throw new Error("Authentication required");
  }

  try {
    const actor = trollboxActor({ anon: false, requiresSigning: true });
    const result = await actor.unban_user(principal);

    if ("Err" in result) {
      throw new Error(result.Err);
    }

    return true;
  } catch (error) {
    console.error("Error unbanning user:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to unban user");
  }
}

/**
 * Check if a user is banned and get the remaining time
 */
export async function checkBanStatus(
  principal: Principal,
): Promise<bigint | null> {
  try {
    const actor = trollboxActor({ anon: true });
    const result = await actor.check_ban_status(principal);

    // Return null if not banned, or the remaining ban time in seconds
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error checking ban status:", error);
    return null;
  }
}
