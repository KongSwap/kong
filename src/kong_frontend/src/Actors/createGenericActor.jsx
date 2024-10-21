import {
  ActorProvider,
  createActorContext,
  isIdentityExpiredError,
} from "ic-use-actor";
import React, { useContext } from "react";
import { useInternetIdentity } from "ic-use-internet-identity";
import { usePlugWallet } from "../contexts/PlugWalletContext"; // Import Plug Wallet context
import { toast } from "react-toastify";

const HOST =
  process.env.DFX_NETWORK !== "ic"
    ? "http://localhost:4943"
    : "https://icp-api.io";

// The createUseActorHook function
export const createUseActorHook = (actorContext) => {
  return () => {
    const context = useContext(actorContext);
    if (!context) {
      throw new Error("useActor must be used within an ActorProvider");
    }
    return context;
  };
};

// The createGenericActor function
export function createGenericActor(canisterId, idlFactory, actorName, identitySource = "II") {
  const actorContext = createActorContext();
  const useActorBackend = createUseActorHook(actorContext);

  const GenericActor = ({ children }) => {
    const { identity: iiIdentity, clear } = useInternetIdentity();
    const { plugPrincipal, getPlugActor } = usePlugWallet(); // Get Plug Wallet data

    // Determine the identity and agent based on the identity source
    const identity = identitySource === "Plug" ? plugPrincipal : iiIdentity;

    if (!identity) {
      // Handle the case where identity is not available
      // You might want to show a loading state or redirect to login
      return null;
    }

    const handleRequest = (data) => data.args;
    const handleResponse = (data) => data.response;

    const handleRequestError = (data) => {
      console.log("onRequestError", data.args, data.methodName, data.error);
      toast.error("Request error", { position: "bottom-right" });
      return data.error;
    };

    const handleResponseError = (data) => {
      console.log("onResponseError", data.args, data.methodName, data.error);
      if (isIdentityExpiredError(data.error)) {
        console.log("Identity expired error");
        clear();
        window.location.reload();
        return;
      }
    };

    // For Plug Wallet, use the existing agent from Plug
    const agentOptions =
      identitySource === "Plug"
        ? { agent: window.ic.plug.agent } // Use Plug's agent
        : { host: HOST }; // Use default host

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
}
