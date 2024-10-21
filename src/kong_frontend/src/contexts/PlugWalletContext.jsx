import React, { createContext, useContext, useEffect, useState } from 'react';
import { FRONTEND_URL } from '../constants/config';
import ledgerData from '../../../../canister_ids.json';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Actor } from '@dfinity/agent';
const PlugWalletContext = createContext();
const whitelist = ledgerData ? Object.values(ledgerData).map(item => item.ic) : [];
const host =
  process.env.DFX_NETWORK === "local"
    ? 'http://localhost:4943'
    : `https://${FRONTEND_URL}.icp0.io/`;

export const PlugWalletProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [enablePlug, setEnablePlug] = useState(false);
  const { identity: iiIdentity, isInitializing } = useInternetIdentity();

  const verifyConnection = async () => {
    if (window.ic && window.ic.plug) {
      const connected = await window.ic.plug.isConnected();
      if (connected) {
        setIsConnected(true);
        setEnablePlug(true);
        const userPrincipal = await window.ic.plug.agent.getPrincipal();
        setPrincipal(userPrincipal.toString());
      }
    } else {
      console.log('Plug Wallet is not installed.');
    }
  };

  useEffect(() => {
    if (!iiIdentity && !isInitializing) {
      verifyConnection();
    }
  }, [iiIdentity, isInitializing]);

  const connectPlugWallet = async () => {
    console.log('connecting...');
    if (window.ic && window.ic.plug) {
      try {
        const result = await window.ic.plug.requestConnect({
          whitelist,
          host,
        });
        if (result && window.ic.plug.agent) {
          setIsConnected(true);
          setEnablePlug(true);
          const userPrincipal = await window.ic.plug.agent.getPrincipal();
          setPrincipal(userPrincipal.toString());
        }
      } catch (error) {
        console.error('Failed to connect to Plug Wallet:', error);
      }
    } else {
      console.error('Plug Wallet is not installed.');
    }
  };

  const disconnectPlugWallet = async () => {
    if (window.ic && window.ic.plug) {
      try {
        await window.ic.plug.disconnect();
        setIsConnected(false);
        setPrincipal(null);
        setEnablePlug(false);
      } catch (error) {
        console.error('Failed to disconnect from Plug Wallet:', error);
      }
    }
  };

  // Provide a method to get the Plug actor for a specific canister
  const getPlugActor = async (canisterId, idlFactory) => {
    if (!window.ic || !window.ic.plug) {
      throw new Error('Plug Wallet is not available');
    }
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
        const actor = await Actor.createActor(idlFactory, {
          agent,
          canisterId,
        });
        return actor;
      }

    return actor;
  };

  return (
    <PlugWalletContext.Provider
      value={{
        isConnected,
        principal,
        connectPlugWallet,
        disconnectPlugWallet,
        setEnablePlug,
        enablePlug,
        getPlugActor, // Provide getPlugActor method
        plugPrincipal: principal, // Provide plugPrincipal
      }}
    >
      {children}
    </PlugWalletContext.Provider>
  );
};

export const usePlugWallet = () => {
  return useContext(PlugWalletContext);
};
