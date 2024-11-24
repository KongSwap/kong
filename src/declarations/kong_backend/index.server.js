// Server-side version of the declarations file
export const canisterId = process.env.CANISTER_ID_KONG_BACKEND;

export const createActor = () => {
  throw new Error('createActor is not available during SSR');
};

export const idlFactory = {};
