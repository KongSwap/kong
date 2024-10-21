// src/Actors/createActorProvider.jsx

import React, { useContext } from 'react';
import {
  ActorProvider,
  createActorContext,
  isIdentityExpiredError,
} from 'ic-use-actor';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { usePlugWallet } from '../contexts/PlugWalletContext';
import { toast } from 'react-toastify';

const HOST =
  process.env.DFX_NETWORK !== 'ic'
    ? 'http://127.0.0.1:4943'
    : 'https://icp-api.io';

export const createActorProvider = (
  canisterId,
  idlFactory,
  actorName,
  identitySource = 'II' // Default to Internet Identity
) => {
  const actorContext = createActorContext();

  const useActorBackend = () => {
    const context = useContext(actorContext);
    if (!context) {
      throw new Error(`${actorName}Actor must be used within an ActorProvider`);
    }
    return context;
  };

  const GenericActor = ({ children }) => {
    const { identity: iiIdentity, clear } = useInternetIdentity();
    const { principal: plugPrincipal } = usePlugWallet();

    // Determine the identity based on the identity source
    const identity = identitySource === 'Plug' ? plugPrincipal : iiIdentity;

    if (!identity) {
      // Handle the case where identity is not available
      // You might want to show a loading state or redirect to login
      return null;
    }

    const handleRequest = (data) => data.args;
    const handleResponse = (data) => data.response;

    const handleRequestError = (data) => {
      console.error('onRequestError', data.args, data.methodName, data.error);
      toast.error('Request error', { position: 'bottom-right' });
      return data.error;
    };

    const handleResponseError = (data) => {
      console.error('onResponseError', data.args, data.methodName, data.error);
      if (isIdentityExpiredError(data.error)) {
        console.log('Identity expired error');
        clear();
        window.location.reload();
      }
    };

    const agentOptions =
      identitySource === 'Plug'
        ? { agent: window.ic.plug.agent } // Use Plug's agent
        : { host: HOST };

    return (
      <ActorProvider
        {...agentOptions}
        canisterId={canisterId}
        context={actorContext}
        identity={identity}
        idlFactory={idlFactory}
        onRequest={handleRequest}
        onResponse={handleResponse}
        onRequestError={handleRequestError}
        onResponseError={handleResponseError}
      >
        {children}
      </ActorProvider>
    );
  };

  return {
    [`use${actorName}Backend`]: useActorBackend,
    [`${actorName}Actor`]: GenericActor,
  };
};

