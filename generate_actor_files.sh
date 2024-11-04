#!/bin/bash

# Define the token information as an array of strings
# Format: "token_name canister_id"
tokens=("GLDT 6c7su-kiaaa-aaaar-qaira-cai"
        "GHOST 4c4fd-caaaa-aaaaq-aaa3a-cai"
        "CTZ uf2wh-taaaa-aaaaq-aabna-cai"
        "ELNA gemj7-oyaaa-aaaaq-aacnq-cai"
        "DOGMI np5km-uyaaa-aaaaq-aadrq-cai"
        "EST bliq2-niaaa-aaaaq-aac4q-cai"
        "PANDA druyg-tyaaa-aaaaq-aactq-cai"
        "KINIC 73mez-iiaaa-aaaaq-aaasq-cai"
        "DOLR 6rdgd-kyaaa-aaaaq-aaavq-cai"
        "TRAX emww2-4yaaa-aaaaq-aacbq-cai"
        "MOTOKO k45jy-aiaaa-aaaaq-aadcq-cai"
        "ckPEPE etik7-oiaaa-aaaar-qagia-cai"
        "ckSHIB fxffn-xiaaa-aaaar-qagoa-cai"
        "DOD cp4zx-yiaaa-aaaah-aqzea-cai"
        "KONG o7oak-iyaaa-aaaaq-aadzq-cai")

# Define paths to templates and destination
DESTINATION_DIR="./src/kong_frontend/src/Actors"  # Change this if your folder structure is different
TEMPLATE_FILE="./actor_template.jsx"   # Template file to be created below

# Create the template file if it doesn't exist
if [ ! -f "$TEMPLATE_FILE" ]; then
    cat << 'EOL' > $TEMPLATE_FILE
import {
    ActorProvider,
    createActorContext,
    createUseActorHook,
    isIdentityExpiredError,
} from "ic-use-actor";
import {
    canisterId,
    idlFactory,
} from "../../../declarations/__TOKEN_NAME_LOWERCASE___ledger/index.js";
import React from "react";
import { useInternetIdentity } from "ic-use-internet-identity";
import { toast } from "react-toastify";

const HOST = (process.env.DFX_NETWORK !== "ic") ? "http://localhost:4943" : "https://icp-api.io";

const actor__TOKEN_NAME__ = createActorContext();
export const use__TOKEN_NAME__Backend = createUseActorHook(actor__TOKEN_NAME__);

const __TOKEN_NAME__Actor = ({ children }) => {
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
            context={actor__TOKEN_NAME__}
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

export default __TOKEN_NAME__Actor;
EOL
fi

# Iterate over each token and create the respective JSX file
for token in "${tokens[@]}"; do
    # Split the token name
    IFS=' ' read -r token_name canister_id <<< "$token"

    # Convert the token name to lowercase for imports and folder name
    lowercase_token_name=$(echo "$token_name" | tr '[:upper:]' '[:lower:]')

    # Generate the new file name based on the token name
    output_file="$DESTINATION_DIR/${token_name}Actor.jsx"

    # Replace placeholders in the template and save the new file
    sed -e "s/__TOKEN_NAME__/$token_name/g" \
        -e "s/__TOKEN_NAME_LOWERCASE__/$lowercase_token_name/g" \
        "$TEMPLATE_FILE" > "$output_file"

    echo "Created file: $output_file"
done

echo "All actor files have been created successfully!"