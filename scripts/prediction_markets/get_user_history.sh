#!/bin/bash

# If no principal is provided, use the current identity's principal
if [ "$#" -eq 0 ]; then
    PRINCIPAL="principal \"$(dfx identity get-principal)\""
else
    PRINCIPAL="principal \"$1\""
fi

dfx canister call prediction_markets_backend get_user_history "($PRINCIPAL)"


# ./get_user_history.sh "aaaaa-aa"