#!/usr/bin/env bash

LOCAL_REPLICA_PORT=$(dfx info replica-port)
CANDID_UI=$(dfx canister id __Candid_UI)
INTERNET_IDENTITY=$(dfx canister id internet_identity)
KONG_FRONTEND_ID=$(dfx canister id kong_frontend)
WEBSERVER_PORT=$(dfx info webserver-port)
KONG_BACKEND_ID=$(dfx canister id kong_backend)
WEBSERVER_PORT=$(dfx info webserver-port)
ICP_LEDGER=$(dfx canister id icp_ledger)
CKUSDT_LEDGER=$(dfx canister id ckusdt_ledger)
CKUSDC_LEDGER=$(dfx canister id ckusdc_ledger)
CKBTC_LEDGER=$(dfx canister id ckbtc_ledger)
CKETH_LEDGER=$(dfx canister id cketh_ledger)

OUTPUT=$(echo "{"\
    \"replica\": \"http://localhost:${LOCAL_REPLICA_PORT}/_/dashboard\",\
    \"internet_identity\": \"http://${INTERNET_IDENTITY}.localhost:${WEBSERVER_PORT}\",\
    \"kong_frontend\": \"http://${KONG_FRONTEND_ID}.localhost:${WEBSERVER_PORT}\",\
    \"kong_backend\": \"http://${CANDID_UI}.localhost:${WEBSERVER_PORT}/?id=${KONG_BACKEND_ID}\",\
    \"icp_ledger\": \"http://${CANDID_UI}.localhost:${WEBSERVER_PORT}/?id=${ICP_LEDGER}\",\
    \"ckusdt_ledger\": \"http://${CANDID_UI}.localhost:${WEBSERVER_PORT}/?id=${CKUSDT_LEDGER}\",\
    \"ckusdc_ledger\": \"http://${CANDID_UI}.localhost:${WEBSERVER_PORT}/?id=${CKUSDC_LEDGER}\",\
    \"ckbtc_ledger\": \"http://${CANDID_UI}.localhost:${WEBSERVER_PORT}/?id=${CKBTC_LEDGER}\",\
    \"cketh_ledger\": \"http://${CANDID_UI}.localhost:${WEBSERVER_PORT}/?id=${CKETH_LEDGER}\"\
"}")

echo $OUTPUT | jq
