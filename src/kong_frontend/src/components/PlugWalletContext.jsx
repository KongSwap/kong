import React, { createContext, useContext, useEffect, useState } from 'react';
import { FRONTEND_URL } from '../constants/config';
import ledgerData from '../../../../canister_ids.json';
import { useInternetIdentity } from 'ic-use-internet-identity';

const PlugWalletContext = createContext();
const whitelist = ledgerData ? Object.values(ledgerData).map(item => item.ic) : [];
const host = process.env.DFX_NETWORK === "local" ? 'http://localhost:4943' : `https://${FRONTEND_URL}.icp0.io/`;

export const PlugWalletProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [enablePlug, setEnablePlug] = useState(false);
  const { identity: iiIdentity, isInitializing } = useInternetIdentity();
  const verifyConnection = async () => {
    if (window.ic && window.ic.plug) {
    const connected = await window.ic.plug.isConnected();
    if(!connected) {
      localStorage.removeItem('last_wallet_connected');
      connectPlugWallet();
    }
    if (connected) {
      setIsConnected(true);
      setEnablePlug(true);
      const userPrincipal = await window.ic.plug.agent.getPrincipal();
      setPrincipal(userPrincipal.toString());
    }
    } else {
      localStorage.removeItem('last_wallet_connected');
      console.log('Plug Wallet is not installed.');
    }
  };
  
  useEffect(() => {
    if (!iiIdentity && !isInitializing && localStorage.getItem('last_wallet_connected') === 'plug') {
      verifyConnection();
    }
  }, [iiIdentity, isInitializing]);

  const connectPlugWallet = async () => {
    if (window.ic && window.ic.plug) {
      try {
        const result = await window.ic.plug.requestConnect({
          whitelist,
          timeout: 1000 * 60 * 60 * 1, // 1 hours
          host,
        });
        if (result && window.ic.plug.agent) {
          setIsConnected(true);
          setEnablePlug(true);
          const userPrincipal = await window.ic.plug.agent.getPrincipal();
          setPrincipal(userPrincipal.toString());
          localStorage.setItem('last_wallet_connected', 'plug');

        }
      } catch (error) {
        localStorage.removeItem('last_wallet_connected');
        console.error('Failed to connect to Plug Wallet:', error);
      }
    } else {
      localStorage.removeItem('last_wallet_connected');
      console.error('Plug Wallet is not installed.');
    }
  };

  const disconnectPlugWallet = async () => {
    if (window.ic && window.ic.plug) {
      try {
        setIsConnected(false);
        setPrincipal(null);
        setEnablePlug(false);
        const result = await window.ic.plug.disconnect()
        localStorage.removeItem('last_wallet_connected');
      } catch (error) {
        console.error('Failed to disconnect from Plug Wallet:', error);
        localStorage.setItem('last_wallet_connected', 'plug');
      }
    }
  };

  return (
    <PlugWalletContext.Provider value={{ isConnected, principal, connectPlugWallet, disconnectPlugWallet, setEnablePlug, enablePlug }}>
      {children}
    </PlugWalletContext.Provider>
  );
};

export const usePlugWallet = () => {
  return useContext(PlugWalletContext);
};
