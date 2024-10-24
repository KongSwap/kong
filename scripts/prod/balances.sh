NETWORK="--network ic"

USER_PRINCIPAL_ID="nq7hu-pzjkt-6i56k-6k6cn-ufyde-gakln-44bq5-yvcbs-l6rcm-hltgk-cae"

declare -A TOKENS=(
	["ICP"]="ryjl3-tyaaa-aaaaa-aaaba-cai"
	["CKUSDT"]="cngnf-vqaaa-aaaar-qag4q-cai"
	["CKUSDC"]="xevnm-gaaaa-aaaar-qafnq-cai"
	["CKBTC"]="mxzaz-hqaaa-aaaar-qaada-cai"
	["CKETH"]="ss2fx-dyaaa-aaaar-qacoq-cai"
	["EXE"]="rh2pm-ryaaa-aaaan-qeniq-cai"
	["SNEED"]="hvgxa-wqaaa-aaaaq-aacia-cai"
	["BOB"]="7pail-xaaaa-aaaas-aabmq-cai"
	["WUMBO"]="wkv3f-iiaaa-aaaap-ag73a-cai"
	["DAMONIC"]="zzsnb-aaaaa-aaaap-ag66q-cai"
	["ALPACALB"]="jncxy-2qaaa-aaaak-aflhq-cai"
	["CHAT"]="2ouva-viaaa-aaaaq-aaamq-cai"
	["ND64"]="esbhr-giaaa-aaaam-ac4jq-cai"
	["DKP"]="zfcdd-tqaaa-aaaaq-aaaga-cai"
	["YUGE"]="nc4uk-iiaaa-aaaai-qpf5q-cai"
	["WTN"]="jcmow-hyaaa-aaaaq-aadlq-cai"
	["BITS"]="j5lhj-xyaaa-aaaai-qpfeq-cai"
	["NICP"]="buwm7-7yaaa-aaaar-qagva-cai"
	["MCS"]="67mu5-maaaa-aaaar-qadca-cai"
	["PARTY"]="7xkvf-zyaaa-aaaal-ajvra-cai"
	["CLOWN"]="iwv6l-6iaaa-aaaal-ajjjq-cai"
	["NANAS"]="mwen2-oqaaa-aaaam-adaca-cai"
)

for symbol in "${!TOKENS[@]}"; do
	properties=(${TOKENS[$symbol]})
	ledger=${properties[0]}
	balance=$(dfx canister call ${NETWORK} ${ledger} icrc1_balance_of --output json "(record {
				owner=principal \"${USER_PRINCIPAL_ID}\"; subaccount=null;
			})")
	echo ${symbol} - ${balance}
done
