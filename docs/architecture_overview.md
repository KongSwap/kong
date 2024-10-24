Kong Swap Architecture Overview
------------------------------------

General Overview:
-----------------

Kong Swap is an AMM DEX similar to Uniswap v1, ICPSwap and SonicDEX. The DEX manages pools, where a pool consists of two tokens (token_0 and token_1) and has balances (balance_0 and balance_1) in these tokens. These balances are then used as inventory for users to execute swaps, the exchange of token_0 for token_1 or token_1 for token_0. The price that this exchange is executed is according to the Constant Product Formula (CPF): balance_0 * balance_1 = K, where K is constant and set at the start of the pool. Therefore, as users execute swaps against the pool, the balances of the token changes, and the price will adjust according to the balances and therefore reflects supply and demand.

Users are able to add liquidity to the pool, by adding inventory at the current ratio of token_0 and token_1 to keep K constant. For this, the users gets LP tokens which represents their share in the pool and therefore is entitled to fees that the pool generates. Users may also remove liquidity at any time, where they return the LP tokens and redeem back the current ratio of token_0 and token_1 plus their share of the trading fees.

Users are then able to execute swaps against these pools where they send an amount of token_0 and in return receive back an amount of token_1, or vice versa sending token_1 and receiving token_0, according to the Constant Product formula. Each swap will affect the liquidiy pool's balance_0 and balance_1, where one balance will increase and the other decrease. Since K remains constant, the price of the pool is affected with each swap. For each swap, the user also pays a liquidity fee similar to brokerage which is distributed among the LP token holders.

kong_backend is responsible for maintaining the states of the pool: token_0, token_1, balance_0, balance_1, K, lp_fee, ... There can be an unlimited amount of pools representing all combinations of token pairs ie. ICP vs ckUSDC, ICP vs ckBTC, ckBTC vs ckETH, ... The canister is also responsible for providing operations on the pools such as add_liquidity, remove_liquidity and swap and updating the pool states with each operation.

Kong Swap consists of two main canisters:

kong_frontend - the asset canister which holds the frontend React/Javascript code. The deployed canister is used to host the website. It uses AgentJS to then interact with the kong_backend canister.

kong_backend - the backend canister, written in Rust which contains the stable memory and logic to run the pools

Other canisters:

icp_ledger,         - template ICRC1/ICRC2 ledger for test tokens
ckusdc_ledger,
ckusdt_ledger,
ckbtc_ledger,
cketh_ledger,
kong_ledger

icp_ckusdc_ledger,  - template ICRC2 ledger for LP tokens
ckusdt_ckusdc_ledger,
ckbtc_ckusdc_ledger,
cketh_ckusdc_ledger,
kong_ckusdc_ledger

kong_faucet     - faucet for distributing test tokens. Uses stable memory to keep track of token distribution by principal id

dfx.json stores the configuration. in scripts/deploy_xxx.sh are the dfx deploy commands for creating the token ledgers

kong_backend canister
-------------------------

kongkong_backend is main canister that holds all the stable memory and logic to run the pools. The main stable memory modules are:

User
Token
Request
Pool
Claim

where each has it's own directory for the stable memory definition, BTreeMap (dictionary) and associated logic.

StableUser (user/stable_user.rs) - used to store user profile
----------

pub struct StableUser {
    pub user_id: u32,
    pub principal_id: String,
    pub user_name: [u16; 3],
    pub last_login_ts: u64,
    pub last_swap_ts: u64,
    pub my_referral_code: String,
    // referral code for the user who referred this user
    pub referred_by: Option<String>,
    pub referred_by_expires_at: Option<u64>,
    // fee level for the user. user's pays lp_fee = 100 - fee_level / 100
    // so 0 = no discount, 100 = pays no lp_fee on swaps
    pub fee_level: u8,
    pub fee_level_expires_at: Option<u64>,
    // campaign1 flags
    // 0: first login
    // 1: first trade
    pub campaign1_flags: Vec<bool>,
}

each user has it's own StableUser, with user_id, principal_id and user_name being the unique identifiers
USER_MAP (user_map.rs) - defined in lib.rs is a BTreeMap using the memory manager stores the collection of StableUser

StableToken (token/stable_token.rs) - use to store info about supported tokens - ie. ledger principal, decimals and gas fee
-----------

pub struct StableToken {
    pub token_id: u32,
    pub symbol: String,
    pub chain: Chain,
    pub ledger: Principal,
    pub decimals: u8,
    pub fee: Nat,
}

each token has it's own StableToken, with token_id, symbol being the unique identifers
TOKEN_MAP (token_map.rs) - defined in lib.rs is a BTreeMap using the memory manager stores the collection of StableToken
TOKEN_MAP is static and token_map.rs/init() initializes all the supported tokens

StableRequest (request/stable_request.rs) - use to store each request (reply and response) the canister receives. This stores every 
-------------   request to the canister so is the "audit log" where the original request, reply and statuses are logged

pub struct StableRequest {
    pub request_id: u128,
    pub user_id: u32,
    pub request: Request,
    pub statuses: Vec<RequestStatus>,
    pub reply: Reply,
    pub ts: u64,
}

each request has it's own StableRequest, with request_id being the unique identifer
REQUEST_MAP (request_map.rs) - defined in lib.rs is a BTreeMap using the memory manager stores the collection of StableRequest

StablePool (pool/stable_pool.rs) - use to store a pool (token_0, token_1, balance_0, balance_1, lp_fee_0, lp_fee_1, K).
----------                    In txs, are all the transactions associated with pool, add, remove liquidity, swaps, claims

pub struct StablePool {
    pub pool_id: u32,
    pub token_0_id: u32,
    pub balance_0: Nat,
    pub lp_fee_0: Nat,
    pub kong_fee_0: Nat,
    pub token_1_id: u32,
    pub balance_1: Nat,
    pub lp_fee_1: Nat,
    pub kong_fee_1: Nat,
    pub lp_total_supply: Nat,
    pub lp_fee_bps: u8,
    pub kong_fee_bps: u8,
    pub total_volume: Nat,
    pub total_lp_fee: Nat,
    pub txs: BTreeMap<u128, PoolTx>,
    pub ts: u64,
}

each pool has it's own StableLiquidity, with pool_id being the unique identifer
LIQUIDITY_POOL_MAP (pool_map.rs) - defined in lib.rs is a BTreeMap using the memory manager stores the collection of StablePool
Within each StablePool is another BTreeMap of all the transactions (add_liquidity, remove_liquidity, swap) PoolTx that occurs

StableClaim (claim/stable_claim.rs) - use to store IOU's to users. This can be because of failed transfers to the user or 
-----------   airdrops/rewards that users can claim

pub struct StableClaim {
    pub claim_id: u32,
    pub user_id: u32,
    pub status: ClaimStatus,
    pub token_id: u32,
    pub amount: Nat,
    pub request_id: Option<u128>,
    pub to_address: Option<Address>,
    pub attempt_request_id: Vec<u128>,
    pub tx_ids: Vec<BlockIndex>,
    pub ts: u64,
}

each claim has it's own StableClaim, which has an associated user_id allow the user to claim token for amount
CLAIM_MAP (claim_map.rs) - defined in lib.rs is a BTreeMap using the memory manager stores the collection of StableClaim

Kong Swap Canister
------------------

Along with the stable memory structures, the canister holds business logic for managing the pools. The main api functionalitoies are:

1) User management: api to retreive user info from StableUser
    get_user : () -> (UserResult) query;
    whoami : () -> (text) query;

2) General liquidity operations: api to retreive token info from StableToken, pool info from StablePool and request info from StableRequest
    tokens : (opt text) -> (TokensResult) query;
    pools : (opt text) -> (LiquidityPoolsResult) query;
    liquidity_pool_tx : (opt text, opt nat) -> (LiquidityPoolTxResult) query;
    requests : (opt nat) -> (RequestsResult) query;

2) Add Liquidity: api to add liquidity and update pool info for StablePool
    add_liquidity_amounts : (text, nat, text) -> (AddLiquiditAmountsResult) composite_query;
    add_liquidity : (AddLiquidityArgs) -> (AddLiquidityResult);
    add_liquidity_async : (AddLiquidityArgs) -> (AddLiquidityAsyncResult);

3) Remove Liquidity: api to remove liquidity and update pool info for StablePool
    remove_liquidity_amounts : (text, text, opt nat) -> (RemoveLiquidityAmountsResult) composite_query;
    remove_liquidity : (RemoveLiquidityArgs) -> (RemoveLiquidityResult);
    remove_liquidity_async : (RemoveLiquidityArgs) -> (RemoveLiquidityAsyncResult);

4) Swap: api to swap tokens and update pool info for StablePool
    swap_amounts : (text, nat, text) -> (SwapAmountsResult) query;
    swap : (SwapArgs) -> (SwapResult);
    swap_async : (SwapArgs) -> (SwapAsyncResult);

5) Claims: api to retrieve/update claim info from StableClaim
    claims : (opt nat) -> (ClaimsResult) query;
    claim : (nat32) -> (ClaimResult);

Api convention:
The main functionalities are: add_liquidity, remove_liquidity and swap

_amount() api functions
-----------------------

For each, there's an _amounts() api, for example add_liquidity_amounts(). The idea is that you call the _amounts() function first to get the correct arguments to pass into add_liquidity(). For add_liquidity_amounts(), you pass in one of the token, say token_0 and it'll return back the amount of of token_1 required to maintain the correct ratio of the pool. For remove_liquidity_amounts() you call it passing the amount of LP token you want to redeem, and it'll return back the amount of token_0, token_1 and trading fees. For swap_amounts(), you pass in the amount of token_0 you wish to send and it'll give you an estimate of the token_1 it will send back.

_async() api functions
----------------------

There's also an _async() api. This is the corresponding async version of the function. You call it the same as the synchroned version, but it'll return back a request_id immediately and then you need to keep calling requests(request_id) to poll the operation until it is complete with success or error. Using the _async() function gives a better user experience and allows for states of these operations.

general pattern for add_liquidty, remove_liquidity, swap and claim
------------------------------------------------------------------

We follow the general pattern for all the functionality:

1) do all the error checks we can
2) calculate parameters (1st time)
3) transfer token from user -> backend
4) re-calculate parameters (2nd time) - this is a duplicate of 2. see notes below
5) rollback if any errors, returning token from backend -> user if necessary
5.1) no more reverting transaction,
6) process and update stable memory using calculation results from 4). stable memory update so should not fail.
7) transfer token from backend -> user
7.1) if 7) fails, then place a Claim which the user can claim later
8) check actual balance in the canister vs. expected balance in stable memory

this pattern is used to avoid race conditions with the canister and prevent any complicated rollbacks in the event of errors.
As the canister stable memory is shared, we have to be careful about the states and any possible race conditions that can occur with simultaneous calls to the canister. ie. if 2 users call swap() at the same time. Canisters execute single-threaded, but any inter-canister calls may interrupt execution and switch to other processes.

Therefore, we try and do all inter-canister calls at the beginning. In the pattern this occurs in steps 1) and 2).
3) is an inter-canister call to make a transfer so any calculations from 1) and 2) can not be used afterwards. Therefore, we have step 4) which when after the transfer control is returned we re-calculate with the new state. Steps 4, 5 and 6) have no inter-canister calls so will execute atomically with the latest state from 4). 6) will update the stable memory and is executed atomically. 7) is an inter-canister call where all the states are updated and saved and the only remaining operation is to send the token to the user. At this point, as the stable memory was updated to the latest state, other canisters can start using this new state, so we can not revert if the transfer to the user fails. Therefore, we introduce the concept of Claims, where if the transfer fails, then the user can try can re-claim at a later time. This ensures, the integrity of stable memory, allowing the pool to continue operating (even if the transfer of the token fails) and prevents any complicated rollback where other processes have used the new state.

user token transfers: user -> backend
--------------------

kong_backend uses the icrc2_approve() and icrc2_transfer_from() pattern for all user transfer where they are transferring tokens to the backend. This applies in add and remove liquidity when the user needs to send tokens first. Also for swap, where the user sends the pay token first this pattern is used. After a successful icrc2_transfer() we also double check the tx_id to verify the type, sender, receiver and amount are correct.

backend token transfers: backend -> user
-----------------------

kong_backend uses icrc1_transfer (ICRC1) and transfer (ICP) to send tokens back to the user. We use the pattern that we always receive the user tokens first, before sending tokens to the users. If any transfers from backend to user should fail, a Claim is created and the user is able to re-claim the token at a later time.


For each of the functions, add, remove liquidity and swap, please see the corresponding documents for further details

Canister Controller API
-----------------------

There are a number of canister controller APIs in src/controllers that are used to interact with the canister and perform various operations. These are used to test the canister and perform various maintenance operations.
Their scripts are in ./api/controllers as well.

Scripts + Testing
-----------------

In the ./api directory are scripts to call all the kong_backend apis. You can create bash scripts for more extensive testing.

In the ./tests/sdk directory is the Rust SDK using agent-rs to call the kong_backend canister. This program will be extended to perform more automated load testing of the canister.
