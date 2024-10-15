import { HttpAgent } from '@dfinity/agent';
import { getAuthClient, login } from './internet_identity';
import { createActor, canisterId } from 'declarations/kong_backend';

let AnonActor = null;
let AuthActor = null;

// anonymous (unauthenticated user) actor
export function getActor() {
  if (AnonActor) {
    return AnonActor;
  }

  AnonActor = createActor(canisterId);
  return AnonActor;
}

// authenticated user actor
export async function getAuthActor() {
  if (AuthActor) {
    return AuthActor;
  }

  const authClient = await getAuthClient();
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) {
    await login();
  }
  const identity = authClient.getIdentity();
  const agent = new HttpAgent({ identity });
  AuthActor = createActor(canisterId, { agent: agent}); 
  return AuthActor;
}