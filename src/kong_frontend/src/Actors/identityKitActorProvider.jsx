import React, { createContext, useContext, useEffect, useState } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { useIdentityKit, useAgent } from '@nfid/identitykit/react';
import { IdentityKitDelegationType } from '@nfid/identitykit';

export const createActorProvider = (idlFactory, canisterId) => {
  const ActorContext = createContext();

  const ActorProvider = ({ children }) => {
    const { identity, delegationType } = useIdentityKit();
    const agent = useAgent({
      host: process.env.DFX_NETWORK === "local" ? 'http://localhost:4943' : "https://icp-api.io/"
    });
    const [actor, setActor] = useState(null);
    const [anonymousAgent, setAnonymousAgent] = useState(null);

    useEffect(() => {
      if (delegationType === IdentityKitDelegationType.ANONYMOUS) {
        const unauthenticatedAgent = HttpAgent.create({
          host: process.env.DFX_NETWORK === "local" ? 'http://localhost:4943' : "https://icp-api.io/",
        });
        setAnonymousAgent(unauthenticatedAgent);
        const anonymousActor = Actor.createActor(idlFactory, { agent: unauthenticatedAgent, canisterId });
        setActor(anonymousActor);
      } else if (agent && identity) {
        const authenticatedActor = Actor.createActor(idlFactory, { agent, canisterId });
        setActor(authenticatedActor);
      }
    }, [agent, identity, delegationType]);

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