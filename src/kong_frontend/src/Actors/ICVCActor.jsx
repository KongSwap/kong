import {
    ActorProvider,
    createActorContext,
    createUseActorHook,
    isIdentityExpiredError,
} from "ic-use-actor";
import {
    canisterId,
    idlFactory,
} from "../../../declarations/icvc_ledger/index.js";
import React from "react";
import { useInternetIdentity } from "ic-use-internet-identity";
import { toast } from "react-toastify";

const HOST = (process.env.DFX_NETWORK !== "ic") ? "http://localhost:4943" : "https://icp-api.io";

const actorICVC = createActorContext();
export const useICVCBackend = createUseActorHook(actorICVC);

const ICVCActor = ({ children }) => {
    const { identity: iiIdentity, clear } = useInternetIdentity();

    const handleRequest = (data) => {
        return data.args;
    };

    const handleResponse = (data) => {
        return data.response;
    };

    const handleRequestError = (data) => {
        console.log("onRequestError", data.args, data.methodName, data.error);
        toast.error("Request error", {
            position: "bottom-right",
        });
        return data.error;
    };

    const handleResponseError = (data) => {
        console.log("onResponseError", data.args, data.methodName, data.error);
        if (isIdentityExpiredError(data.error)) {
            console.log('Identity expired error');
clear();
window.location.reload()
            return;
        }
    };

    return (
        <ActorProvider
            httpAgentOptions={{ host: HOST }}
            canisterId={canisterId}
            context={actorICVC}
            identity={iiIdentity}
            idlFactory={idlFactory}
            onRequest={handleRequest}
            onResponse={handleResponse}
            onRequestError={handleRequestError}
            onResponseError={handleResponseError}
        >
            {children}
        </ActorProvider>
    );
}

export default ICVCActor;
