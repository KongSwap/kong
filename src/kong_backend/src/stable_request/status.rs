use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct Status {
    pub status_code: StatusCode,
    pub message: Option<String>,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StatusCode {
    Start,
    // add pool
    AddToken0,
    AddToken0Success,
    AddToken0Failed,
    AddLPToken,
    AddLPTokenSuccess,
    AddLPTokenFailed,
    AddPool,
    AddPoolSuccess,
    AddPoolFailed,
    // add liquidity
    SendToken0,
    SendToken0Success,
    SendToken0Failed,
    VerifyToken0,
    VerifyToken0Success,
    VerifyToken0Failed,
    Token0NotFound,
    ReturnUnusedToken0,
    ReturnUnusedToken0Success,
    ReturnUnusedToken0Failed,
    ReturnToken0,
    ReturnToken0Success,
    ReturnToken0Failed,
    SendToken1,
    SendToken1Success,
    SendToken1Failed,
    VerifyToken1,
    VerifyToken1Success,
    VerifyToken1Failed,
    Token1NotFound,
    PoolNotFound,
    ReturnUnusedToken1,
    ReturnUnusedToken1Success,
    ReturnUnusedToken1Failed,
    ReturnToken1,
    ReturnToken1Success,
    ReturnToken1Failed,
    // remove liquidity
    ReturnUserLPTokenAmount,
    ReturnUserLPTokenAmountSuccess,
    ReturnUserLPTokenAmountFailed,
    ReceiveToken0,
    ReceiveToken0Success,
    ReceiveToken0Failed,
    ReceiveToken1,
    ReceiveToken1Success,
    ReceiveToken1Failed,
    // swap
    PayTokenNotFound,
    PayTxIdNotSupported,
    PayTxIdNotFound,
    PayTokenAmountIsZero,
    ReceiveTokenNotFound,
    ReceiveAddressNotFound,
    SendPayToken,
    SendPayTokenSuccess,
    SendPayTokenFailed,
    VerifyPayToken,
    VerifyPayTokenSuccess,
    VerifyPayTokenFailed,
    SendReceiveToken,
    SendReceiveTokenSuccess,
    SendReceiveTokenFailed,
    ReturnPayToken,
    ReturnPayTokenSuccess,
    ReturnPayTokenFailed,
    // claim
    ClaimToken,
    ClaimTokenSuccess,
    ClaimTokenFailed,
    // pool amounts
    CalculatePoolAmounts,
    CalculatePoolAmountsSuccess,
    CalculatePoolAmountsFailed,
    UpdatePoolAmounts,
    UpdatePoolAmountsSuccess,
    UpdatePoolAmountsFailed,
    // user LP token amount
    UpdateUserLPTokenAmount,
    UpdateUserLPTokenAmountSuccess,
    UpdateUserLPTokenAmountFailed,
    // send LP token
    SendLPTokenToUser,
    SendLPTokenToUserSuccess,
    SendLPTokenToUserFailed,
    // general
    Success,
    Failed,
}
