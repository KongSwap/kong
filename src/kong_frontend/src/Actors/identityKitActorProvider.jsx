// identityKitActorProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { useIdentityKit, useAgent } from '@nfid/identitykit/react';

export const createActorProvider = (idlFactory, canisterId) => {
  const ActorContext = createContext();

  const ActorProvider = ({ children }) => {
    const { identity } = useIdentityKit();
    const agent = useAgent();
    const [actors, setActors] = useState({ authenticated: null, anonymous: null });

    useEffect(() => {
      const createActors = async () => {
        try {
          // Create the authenticated actor if identity and agent are available
          if (identity && agent) {
            const authenticatedActor = Actor.createActor(idlFactory, { agent, canisterId });
            setActors((prevActors) => ({ ...prevActors, authenticated: authenticatedActor }));
          }

          // Create the anonymous actor with a synchronous agent
          const unauthenticatedAgent = HttpAgent.createSync({
            host: process.env.DFX_NETWORK === 'local' ? 'http://localhost:4943' : 'https://icp-api.io/',
          });

          // Fetch root key for the unauthenticated agent in a local or development environment
          if (process.env.DFX_NETWORK === 'local') {
            await unauthenticatedAgent.fetchRootKey();
          }

          const anonymousActor = Actor.createActor(idlFactory, { agent: unauthenticatedAgent, canisterId });
          setActors((prevActors) => ({ ...prevActors, anonymous: anonymousActor }));
        } catch (error) {
          console.error('Error creating actors:', error);
        }
      };

      createActors();
    }, [agent, identity]);

    return (
      <ActorContext.Provider value={actors}>
        {children}
      </ActorContext.Provider>
    );
  };

  const useActors = () => {
    const context = useContext(ActorContext);
    if (!context) {
      throw new Error('useActors must be used within an ActorProvider');
    }
    return context;
  };

  return { ActorProvider, useActors };
};