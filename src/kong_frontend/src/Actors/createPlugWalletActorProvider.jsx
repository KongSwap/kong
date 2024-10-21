import React, { useEffect, useState, createContext, useContext } from 'react';
import { Actor } from '@dfinity/agent';
import { usePlugWallet } from '../contexts/PlugWalletContext';
import { FRONTEND_URL } from '../constants/config';
import { useInternetIdentity } from 'ic-use-internet-identity';

const host = process.env.DFX_NETWORK === "local" ? 'http://localhost:4943' : `https://${FRONTEND_URL}.icp0.io/`;

export const createPlugWalletActorProvider = (idlFactory, canisterId) => {
  const PlugWalletActorContext = createContext();
  const PlugWalletActorProvider = ({ children }) => {
    const [plugActor, setPlugActor] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const { principal: plugPrincipal } = usePlugWallet();
    const { identity: iiIdentity, isInitializing } = useInternetIdentity();
    const [isInitialized, setIsInitialized] = useState(false);
    const [currentCanisterId, setCurrentCanisterId] = useState(null);

    useEffect(() => {
      const setupPlugActor = async () => {
        if (window.ic && window.ic.plug && !!plugPrincipal && !isInitializing && !iiIdentity && canisterId) {
          const connected = await window.ic.plug.isConnected();
          setIsConnected(connected);

          if (connected) {
            // Create agent
            await window.ic.plug.createAgent({
              whitelist: [canisterId],
              host, // Update to your actual host
            });

            
            const agent = window.ic.plug.agent;

            // Create actor
            const actor = Actor.createActor(idlFactory, {
              agent,
              canisterId,
            });
            setPlugActor(actor);
            setIsInitialized(true); // Set initialization status to true
            setCurrentCanisterId(canisterId); // Store the canister ID
          }
        } else {
          setIsConnected(false);
          setIsInitialized(false);
          setCurrentCanisterId(null);
        }
      };

      setupPlugActor();
    }, [plugPrincipal, isInitializing, iiIdentity, canisterId]);
    
    return (
      <PlugWalletActorContext.Provider value={{ plugActor, isConnected, isInitialized, currentCanisterId }}>
        {children}
      </PlugWalletActorContext.Provider>
    );
  };

  const usePlugWalletActor = () => {
    const context = useContext(PlugWalletActorContext);
    if (!context) {
      throw new Error('usePlugWalletActor must be used within a PlugWalletActorProvider');
    }
    return context;
  };

  return { PlugWalletActorProvider, usePlugWalletActor };
};
