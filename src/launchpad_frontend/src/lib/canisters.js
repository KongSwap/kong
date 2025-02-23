import { Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { initAgent } from './agent';

// We'll create a basic interface factory since we don't have .did files
const createTokenInterface = () => ({
  init: ({ name, ticker, total_supply }) => ({
    argTypes: ['record'],
    returnType: 'variant',
    args: [{ name, ticker, total_supply }]
  })
});

const createBackendInterface = () => ({
  create_token: ({ name, ticker, total_supply, subnet }) => ({
    argTypes: ['text', 'text', 'nat64', 'opt principal'],
    returnType: 'variant',
    args: [name, ticker, total_supply, subnet]
  }),
  get_canister_cycles: () => ({
    argTypes: [],
    returnType: 'nat',
    args: []
  }),
  list_miners: () => ({
    argTypes: [],
    returnType: 'vec record',
    args: []
  })
});

// Canister IDs - replace these with your actual canister IDs
const TOKEN_CANISTER_ID = process.env.CANISTER_ID_TOKEN_BACKEND || 'YOUR_TOKEN_CANISTER_ID';
const BACKEND_CANISTER_ID = process.env.CANISTER_ID_BACKEND || 'YOUR_BACKEND_CANISTER_ID';

export async function initializeTokenBackend(canisterId = TOKEN_CANISTER_ID) {
  const agent = await initAgent();
  return Actor.createActor(createTokenInterface(), {
    agent,
    canisterId,
  });
}

export async function initializeBackend(canisterId = BACKEND_CANISTER_ID) {
  const agent = await initAgent();
  return Actor.createActor(createBackendInterface(), {
    agent,
    canisterId,
  });
}
