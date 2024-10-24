#!/usr/bin/env bash

NETWORK="--network ic"

TO_PRINCIPAL_ID="snb3j-s62qn-qownd-imqtp-fmqwk-paao6-w67uo-zzhwr-ntrwu-2ngtu-xae"
AMOUNT=1_000_000_000
# uncomment out the token you want to transfer
# TOKEN_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"  # ICP
# TOKEN_LEDGER="cngnf-vqaaa-aaaar-qag4q-cai"  # ckUSDT
# TOKEN_LEDGER="xevnm-gaaaa-aaaar-qafnq-cai"  # ckUSDC
# TOKEN_LEDGER="mxzaz-hqaaa-aaaar-qaada-cai"  # ckBTC
# TOKEN_LEDGER="ss2fx-dyaaa-aaaar-qacoq-cai"  # ckETH
# TOKEN_LEDGER="rh2pm-ryaaa-aaaan-qeniq-cai"  # EXE
# TOKEN_LEDGER="rh2pm-ryaaa-aaaan-qeniq-cai"  # SNEED
# TOKEN_LEDGER="7pail-xaaaa-aaaas-aabmq-cai"  # BOB
# TOKEN_LEDGER="wkv3f-iiaaa-aaaap-ag73a-cai"  # WUMBO
# TOKEN_LEDGER="zzsnb-aaaaa-aaaap-ag66q-cai"  # DAMONIC
# TOKEN_LEDGER="jncxy-2qaaa-aaaak-aflhq-cai"  # ALPACALB
# TOKEN_LEDGER="2ouva-viaaa-aaaaq-aaamq-cai"  # CHAT
# TOKEN_LEDGER="esbhr-giaaa-aaaam-ac4jq-cai"  # ND64
# TOKEN_LEDGER="zfcdd-tqaaa-aaaaq-aaaga-cai"  # DKP
# TOKEN_LEDGER="nc4uk-iiaaa-aaaai-qpf5q-cai"  # YUGE
# TOKEN_LEDGER="jcmow-hyaaa-aaaaq-aadlq-cai"  # WTN
# TOKEN_LEDGER="j5lhj-xyaaa-aaaai-qpfeq-cai"  # BITS
# TOKEN_LEDGER="buwm7-7yaaa-aaaar-qagva-cai"  # NICP
# TOKEN_LEDGER="67mu5-maaaa-aaaar-qadca-cai"  # MCS
# TOKEN_LEDGER="7xkvf-zyaaa-aaaal-ajvra-cai"  # PARTY
# TOKEN_LEDGER="iwv6l-6iaaa-aaaal-ajjjq-cai"  # CLOWN
# TOKEN_LEDGER="mwen2-oqaaa-aaaam-adaca-cai"  # NANAS

dfx canister call ${NETWORK} ${TOKEN_LEDGER} icrc1_transfer "(record {
    to=record {owner=principal \"${TO_PRINCIPAL_ID}\"; subaccount=null};
    amount=${AMOUNT};
},)"
