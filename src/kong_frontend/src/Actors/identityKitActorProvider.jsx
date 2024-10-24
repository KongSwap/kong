import React, { createContext, useContext, useEffect, useState } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { useIdentityKit } from '@nfid/identitykit/react';
import { IdentityKitDelegationType } from '@nfid/identitykit';

export const createActorProvider = (idlFactory, canisterId) => {
  const ActorContext = createContext();

  const ActorProvider = ({ children }) => {
    const { identity, delegationType } = useIdentityKit();
    const [actor, setActor] = useState(null);
    const [anonymousAgent, setAnonymousAgent] = useState();

    useEffect(() => {
      // Create an unauthenticated agent
      const unauthenticatedAgent = HttpAgent.createSync();

      // Create an anonymous agent if necessary
      setAnonymousAgent(
        identity && delegationType === IdentityKitDelegationType.ANONYMOUS
          ? HttpAgent.createSync({ identity })
          : undefined
      );
      if (identity) {
        // Create the actor with the authenticated identity
        const agent = HttpAgent.create({ identity, localhost: process.env.DFX_NETWORK === "local" ? 'http://localhost:4943' : "https://icp-api.io/" });
        const createdActor = Actor.createActor(idlFactory, { agent, canisterId });
        setActor(createdActor);
      }
    }, [identity, delegationType]);

    return (
      <ActorContext.Provider value={actor}>
        {children}
      </ActorContext.Provider>
    );
  };

  const useActor = () => {
    return useContext(ActorContext);
  };

  return { ActorProvider, useActor };
};