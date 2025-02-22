import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { TROLLBOX_CANISTER_ID } from "$lib/constants/canisterConstants";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { auth } from "$lib/services/auth";
import { Principal } from "@dfinity/principal";
import * as tokensApi from "$lib/api/tokens";
import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

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
let tokenCache: Record<string, {
    symbol: string;
    price: string;
    price_change_24h: string;
    timestamp: number;
}> = {};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function processMessageTokens(message: Message): Promise<Message> {
    const tokenPattern = /#([a-z0-9-]+)/g;
    const matches = [...message.message.matchAll(tokenPattern)];
    
    if (!matches.length) return message;

    let processedMessage = message.message;
    const canisterIds = matches.map(match => match[1]);
    
    // Filter out canisterIds that are already in cache and still valid
    const now = Date.now();
    const canisterIdsToFetch = canisterIds.filter(id => {
        const cached = tokenCache[id];
        return !cached || (now - cached.timestamp) > CACHE_TTL;
    });
    
    try {
        // Only fetch tokens that aren't in cache or are expired
        if (canisterIdsToFetch.length > 0) {
            const tokens = await tokensApi.fetchTokensByCanisterId(canisterIdsToFetch);
            tokens.forEach(token => {
                // Update cache
                tokenCache[token.canister_id] = {
                    symbol: token.symbol,
                    price: formatToNonZeroDecimal(token.metrics.price),
                    price_change_24h: formatToNonZeroDecimal(token.metrics.price_change_24h || 0),
                    timestamp: now
                };
            });
        }

        // Replace all tokens in message using cache
        canisterIds.forEach(canisterId => {
            const token = tokenCache[canisterId];
            if (token) {
                const pattern = new RegExp(`#${canisterId}`, 'g');
                processedMessage = processedMessage.replace(
                    pattern, 
                    `<a href="/stats/${canisterId}"><span class="bg-kong-primary/20 rounded-md px-1.5 py-0.5 text-kong-text-primary text-xs">${token.symbol} - <span class="${Number(token.price_change_24h) > 0 ? 'text-kong-text-accent-green' : 'text-kong-text-accent-red'}">${token.price} (${token.price_change_24h}%)</span></span></a>`
                );
            }
        });
    } catch (error) {
        console.error('Error processing tokens in message:', error);
    }

    return { ...message, message: processedMessage };
}

export async function getMessages(params?: PaginationParams): Promise<MessagesPage> {
    const actor = createAnonymousActorHelper(TROLLBOX_CANISTER_ID, canisterIDLs.trollbox);
    
    // Construct candid params according to the interface definition
    // PaginationParams = IDL.Record({ cursor: IDL.Opt(IDL.Nat64), limit: IDL.Opt(IDL.Nat64) })
    const candid_params = {
        cursor: params?.cursor ? [params.cursor] : [], // IDL.Opt wraps value in array or empty array
        limit: params?.limit ? [params.limit] : []     // IDL.Opt wraps value in array or empty array
    };
    
    const result = await actor.get_messages([candid_params]); // Wrap in array for IDL.Opt
    
    // Process tokens in all messages
    const processedMessages = await Promise.all(result.messages.map(processMessageTokens));
    
    return {
        messages: processedMessages,
        next_cursor: result.next_cursor[0] ?? null // Unwrap IDL.Opt result
    };
}

export async function getMessage(id: bigint): Promise<Message | null> {
    const actor = createAnonymousActorHelper(TROLLBOX_CANISTER_ID, canisterIDLs.trollbox);
    const result = await actor.get_message(id);
    if (result.length === 0) return null;
    
    // Process tokens in the message
    return processMessageTokens(result[0]);
}

export async function createMessage(payload: MessagePayload): Promise<Message> {
    const actor = auth.pnp.getActor(TROLLBOX_CANISTER_ID, canisterIDLs.trollbox, {
        anon: false,
        requiresSigning: true,
    });
    
    try {
        const result = await actor.create_message(payload.message);
        if ('Err' in result) {
            throw new Error(result.Err);
        }
        // Process tokens in the new message
        return processMessageTokens(result.Ok);
    } catch (error) {
        console.error('Create message error:', error);
        throw error;
    }
}
