import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { TROLLBOX_CANISTER_ID } from "$lib/constants/canisterConstants";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { auth } from "$lib/services/auth";
import { Principal } from "@dfinity/principal";
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

async function processMessageTokens(message: Message): Promise<Message> {
    const tokenPattern = /#([a-z0-9-]+)/g;
    const matches = [...message.message.matchAll(tokenPattern)];
    
    if (!matches.length) return message;

    let processedMessage = message.message;
    const canisterIds = matches.map(match => match[1]);
    
    try {
        const tokens = await tokensApi.fetchTokensByCanisterId(canisterIds);
        tokens.forEach(token => {
            const pattern = new RegExp(`#${token.canister_id}`, 'g');
            processedMessage = processedMessage.replace(
                pattern, 
                `<a href="/stats/${token.canister_id}"><span class="bg-kong-primary/20 rounded-md px-1.5 py-0.5 text-kong-text-primary text-xs">${token.symbol} - <span class="text-kong-text-accent-green">${token.metrics.price} (${token.metrics.price_change_24h || 0}%)</span></span></a>`
            );
        });
    } catch (error) {
        console.error('Error processing tokens in message:', error);
    }

    return { ...message, message: processedMessage };
}

export async function getMessages(params?: PaginationParams): Promise<MessagesPage> {
    const actor = createAnonymousActorHelper(TROLLBOX_CANISTER_ID, canisterIDLs.trollbox);
    
    const candid_params = {
        cursor: params?.cursor !== undefined ? [params.cursor] : [],
        limit: params?.limit !== undefined ? [params.limit] : []
    };
    
    const result = await actor.get_messages([candid_params]);
    
    // Process tokens in all messages
    const processedMessages = await Promise.all(result.messages.map(processMessageTokens));
    
    return {
        messages: processedMessages,
        next_cursor: result.next_cursor
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
