import React, { useState, useCallback, useEffect, useMemo } from "react";
import BigNumber from "bignumber.js";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { Principal } from "@dfinity/principal";
import useIdentity from "./useIdentity";
import confirmationImageRemoveLq from "../../../assets/kong-approves-remove-lq.png";
import { Link, useLocation } from "react-router-dom";
import TransactionProgressComponent from "./TransactionProgressComponent";
import removeLiquiditySound from "../../../assets/Remove-Liquidity-succesfull.mp3";
import failedImageSwap from "../../../assets/kong-failed.png";
import { priceRoundedAmount } from "../utils/priceDecimalConvertor";

export const KONG_FRONTEND =
  "http://" + process.env.CANISTER_ID_KONG_FRONTEND + ".localhost:4943";
export const KONG_BACKEND_PRINCIPAL = Principal.fromText(
  process.env.CANISTER_ID_KONG_BACKEND
);

const RemoveLiquidityComponent = ({
  poolName,
  getUserBalances,
  getLiquidityPoolBalances,
  userPoolBalances,
  changeDrawerContent,
  tokenDetails,
  tokenPrices,
  tokenImages
}) => {
  const {
    actors: { backendKingKong },
  } = useIdentity();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialPool = queryParams.get("pool")
    ? queryParams.get("pool").split("_")
    : poolName.split("_");
  const [youPayToken, setYouPayToken] = useState(initialPool[0]);
  const [youReceiveToken, setYouReceiveToken] = useState(initialPool[1]);

  const [amount, setAmount] = useState(0);
  const [rangeValue, setRangeValue] = useState(0);
  const [, setUserPoolBalance] = useState(0);
  const [amount_0, setAmount0] = useState(0);
  const [amount_1, setAmount1] = useState(0);
  const [lpFee0, setLpFee0] = useState(0);
  const [lpFee1, setLpFee1] = useState(0);
  const [lpFeeBonus, setLpFeeBonus] = useState(0);
  const [total0, setTotal0] = useState(0);
  const [total1, setTotal1] = useState(0);
  const [
    isRemoveLiquidityConfirmationModalOpen,
    setIsRemoveLiquidityConfirmationModalOpen,
  ] = useState(false);
  const [
    isRemoveLiquiditySuccessfulModalOpen,
    setIsRemoveLiquiditySuccessfulModalOpen,
  ] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lpTokensRemoved, setLpTokensRemoved] = useState(0);
  const [requestId, setRequestId] = useState(null);
  const [transactionStateObject, setTransactionStateObject] = useState(null);
  const [isTokenApproved, setIsTokenApproved] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [removeLiquiditySoundPlayed] = useState(
    new Audio(removeLiquiditySound)
  );
  const [isFailedModalOpen, setIsFailedModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState({
    amount_0: 0,
    amount_1: 0,
    lpTokensRemoved: 0,
  });

  const playRemoveLiqClickSound = () => {
    removeLiquiditySoundPlayed.play();
  };

  const userPoolBalance = useMemo(() => {
    if (!userPoolBalances) return null;

    // Convert poolName from using `_` to `/`
    const formattedPoolName = poolName.replace("_", "/");

    const pool = userPoolBalances.find((pool) => {
      return pool.name === formattedPoolName;
    });

    return pool ? pool.balance : 0;
  }, [userPoolBalances, poolName]);

  const getTokenDecimals = (tokenSymbol) => {
    if (!tokenDetails) return null;

    // Remove the chain part (like 'IC.') from the token symbol you're passing
    const cleanedSymbol = tokenSymbol.includes(".")
      ? tokenSymbol.split(".")[1]
      : tokenSymbol;

    // Loop through each token object in the tokenDetails array
    for (const tokenObj of tokenDetails) {
      // Get the first key of the object to access the token details
      const tokenKey = Object.keys(tokenObj)[0];
      const token = tokenObj[tokenKey];

      // Remove the chain part from token.symbol
      const cleanedTokenSymbol = token.symbol.includes(".")
        ? token.symbol.split(".")[1]
        : token.symbol;

      // Check if the cleaned symbols match
      if (cleanedTokenSymbol === cleanedSymbol) {
        return token.decimals;
      }
    }

    return 8; // Default to 8 if the token is not found, adjust if necessary
  };

  const processPoolData = useCallback((data) => {
    const { amount_0, amount_1, lp_fee_0, lp_fee_1, lp_fee_kong, remove_lp_token_amount, symbol, symbol_0, symbol_1 } = data;
    const youPayDecimals = getTokenDecimals(symbol_0);
    const youReceiveDecimals = getTokenDecimals(symbol_1);

    

    const amount0 = new BigNumber(amount_0)
    .dividedBy(new BigNumber(10).pow(youPayDecimals))
    const amount1 = new BigNumber(amount_1)
    .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
    const lpFee0 = new BigNumber(lp_fee_0)
        .dividedBy(new BigNumber(10).pow(youPayDecimals))
    const lpFee1 = 
      new BigNumber(lp_fee_1)
        .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
    const lpFeeBonus = new BigNumber(lp_fee_kong).toNumber();
    const removeUserLpTokens = remove_lp_token_amount;

    const total0 = priceRoundedAmount(
      tokenPrices[symbol],
      amount0.plus(lpFee0).toNumber()
    );
    const total1 = priceRoundedAmount(
      tokenPrices[symbol],
      amount1.plus(lpFee1).toNumber()
    );

    const amount0Parsed = priceRoundedAmount(
      tokenPrices[symbol],
      amount0.toNumber()
    );
    const amount1Parsed = priceRoundedAmount(
      tokenPrices[symbol],
      amount1.toNumber()
    );

    setAmount0(amount0Parsed);
    setAmount1(amount1Parsed);
    setLpFee0(lpFee0.toNumber());
    setLpFee1(lpFee1.toNumber());
    setTotal0(total0);
    setTotal1(total1);
    setLpFeeBonus(lpFeeBonus);
    setLpTokensRemoved(removeUserLpTokens);
  }, [youPayToken, youReceiveToken, getTokenDecimals, tokenPrices]);

  const fetchLiquidityAmounts = useCallback(
    async (adjustedAmount) => {
      if (!backendKingKong) return;
      const response = await backendKingKong.remove_liquidity_amounts(
        youPayToken,
        youReceiveToken,
        parseInt(
          new BigNumber(adjustedAmount)
            .multipliedBy(new BigNumber(10).pow(8))
            .toNumber()
        )
      );
      if (response.Ok) {
        processPoolData(response.Ok);
      } else if (response.Err) {
        console.log("Error fetching liquidity amounts:", response.Err);
        toast(response.Err);
      }
    },
    [youPayToken, youReceiveToken, userPoolBalance, backendKingKong]
  );

  const handleRangeChange = (event) => {
    const percentage = event.target.value;
    setRangeValue(percentage);
    calculateAmount(percentage);
  };

  const handlePercentageClick = (percentage) => {
    setRangeValue(percentage);
    calculateAmount(percentage);
  };

  const calculateAmount = useCallback((percentage) => {
    const userBalanceSanitized = userPoolBalance.replace(/,/g, "");
    const userBalance = new BigNumber(userBalanceSanitized);
    const numberAfterPercentage = new BigNumber(userBalance)
      .multipliedBy(percentage)
      .dividedBy(100);
    setAmount(numberAfterPercentage.toNumber());
    fetchLiquidityAmounts(numberAfterPercentage);
  }, [userPoolBalance, fetchLiquidityAmounts, backendKingKong]);

  useEffect(() => {
    
    // Only trigger fetching if backendKingKong is available
    if (!backendKingKong || !userPoolBalance) return;
  
    // Call the function that calculates the initial percentage and fetches liquidity
    handlePercentageClick(50); // Fetching liquidity with 50% initially
  }, [backendKingKong, userPoolBalance]); // Add backendKingKong to dependencies

  const removeLiquidity = useCallback(async () => {
    setIsProcessing(true);
    setIsTokenApproved(true);
    const removeLiqObj = {
      token_0: youPayToken,
      token_1: youReceiveToken,
      remove_lp_token_amount: lpTokensRemoved,
      // lp_tokens_approve_block_id: [approve],
    };
    backendKingKong
      .remove_liquidity_async(removeLiqObj)
      .then((response) => {
        if (response.Ok) {
          setRequestId(response.Ok);
        } else if (response.Err) {
          console.error("Remove liquidity error:", response.Err);
          toast(response.Err);
        }
      })
      .catch((error) => {
        console.error("Remove liquidity error:", error);
        toast("An error occurred while removing liquidity.");
        setIsRemoveLiquidityConfirmationModalOpen(false);
        setIsProcessing(false);
      });
    // }
  }, [lpTokensRemoved, youPayToken, youReceiveToken]);

  useEffect(() => {
    if (requestId) {
      const intervalId = setInterval(async () => {
        try {
          const requestObj = await backendKingKong.requests([requestId]);
          const requestReply =
            requestObj && requestObj.Ok[0] && requestObj.Ok[0].reply;
          setTransactionStateObject(requestObj);
          if (requestReply && requestReply.Pending === null) {
            return;
          } else if (
            requestReply &&
            requestReply.RemoveLiquidity &&
            requestReply.RemoveLiquidity.status === "Success"
          ) {
            const claimIds = requestReply.RemoveLiquidity.claim_ids;
            setHasClaimed(claimIds.length > 0);

            // Store the successful amounts in the success modal state
            const { amount_0, amount_1, remove_lp_token_amount, symbol } =
              requestReply.RemoveLiquidity;
            setSuccessModalData({
              amount_0: new BigNumber(amount_0)
                .dividedBy(new BigNumber(10).pow(getTokenDecimals(youPayToken)))
                .toNumber(),
              amount_1: new BigNumber(amount_1)
                .dividedBy(
                  new BigNumber(10).pow(getTokenDecimals(youReceiveToken))
                )
                .toNumber(),
              lpTokensRemoved: new BigNumber(remove_lp_token_amount)
                .dividedBy(new BigNumber(10).pow(getTokenDecimals(symbol)))
                .toNumber(),
            });

            processPoolData(requestReply.RemoveLiquidity);
            setIsRemoveLiquidityConfirmationModalOpen(false);
            setIsProcessing(false);
            setIsRemoveLiquiditySuccessfulModalOpen(true);
            setRequestId(null);
            getUserBalances();
            playRemoveLiqClickSound();
            getLiquidityPoolBalances();
            clearInterval(intervalId);
          } else if (
            requestReply &&
            requestReply.RemoveLiquidity &&
            requestReply.RemoveLiquidity.status === "Failed"
          ) {
            const claimIds = requestReply.RemoveLiquidity.claim_ids;
            setHasClaimed(claimIds.length > 0);
            setIsRemoveLiquidityConfirmationModalOpen(false);
            setIsProcessing(false);
            setIsFailedModalOpen(true);
            setRequestId(null);
            clearInterval(intervalId);
            toast("Remove liquidity failed");
          }
        } catch (error) {
          console.error("Error polling transaction status:", error);
          clearInterval(intervalId);
          setRequestId(null);
          setTransactionStateObject(null);
        }
      }, 500);

      return () => clearInterval(intervalId);
    }
  }, [requestId, backendKingKong]);

  const clearFields = () => {
    setAmount0(0);
    setAmount1(0);
    setLpFee0(0);
    setLpFee1(0);
    setLpFeeBonus(0);
    setTotal0(0);
    setTotal1(0);
    setLpTokensRemoved(0);
  };

  const closeFailedModal = () => {
    setIsFailedModalOpen(false);
    setTransactionStateObject(null);
    clearInputs();
  };

  const isButtonDisabled = useMemo(() => {
    return rangeValue === 0 || amount_0 === 0 || amount_1 === 0 || isProcessing;
  }, [rangeValue, amount_0, amount_1, isProcessing]);

  return (
    <>
      <div className="panel-green-main panel-green-main--sending-address-container">
        <div className="panel-green-main__tl"></div>
        <div className="panel-green-main__tm"></div>
        <div className="panel-green-main__tr"></div>

        <div className="panel-green-main__ml"></div>
        <div className="panel-green-main__mr"></div>

        <div className="panel-green-main__bl"></div>
        <div className="panel-green-main__bm"></div>
        <div className="panel-green-main__br"></div>

        <div className="panel-green-main__content">
          <div className="poolrem-container">
            <div className="pool-container-head-tabs">
              <Link
                to={`/?viewtab=pools&pool=${youPayToken}_${youReceiveToken}`}
                className="pool-container-head-tab"
              >
                Add Liquidity
              </Link>
              <Link className="pool-container-head-tab active">
                Remove Liquidity
              </Link>
            </div>
            {/* <h3 className="poolrem-container-title">Remove liquidity</h3> */}
            <div className="poolrem-liq-tokens">
              <span className="poolrem-liq-tokens-logos">
                <img
                  src={tokenImages[youPayToken]}
                  className="poolrem-liq-tokens-logo poolrem-liq-tokens-logo-first"
                />
                <img
                  src={tokenImages[youReceiveToken]}
                  className="poolrem-liq-tokens-logo poolrem-liq-tokens-logo-second"
                />
              </span>
              <span className="poolrem-liq-token-names">{poolName} LP</span>
            </div>
            <div className="poolrem-liq-selectamount">
              <span className="poolrem-liq-selectamount-label">
                Select Amount
              </span>
              <div className="percentages">
                <span className={`percentages-value`}>
                  {rangeValue}
                  <span className="percentage-symbol">%</span>
                </span>
                <span
                  onClick={() => handlePercentageClick(25)}
                  className={`${
                    rangeValue === 25
                      ? "button-yellow button-yellow--percentage"
                      : "button-green button-green--percentage"
                  }`}
                >
                  {rangeValue === 25 ? (
                    <>
                      <span className="button-yellow__pressed">
                        <span className="button-yellow__pressed__l"></span>
                        <span className="button-yellow__pressed__mid"></span>
                        <span className="button-yellow__pressed__r"></span>
                      </span>
                      <span className="button-yellow__selected">
                        <span className="button-yellow__selected__l"></span>
                        <span className="button-yellow__selected__mid"></span>
                        <span className="button-yellow__selected__r"></span>
                      </span>
                      <span className="button-yellow__default">
                        <span className="button-yellow__default__l"></span>
                        <span className="button-yellow__default__mid"></span>
                        <span className="button-yellow__default__r"></span>
                      </span>
                      <span className="button-yellow__text">
                        25
                        <span className="percentage-symbol">%</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="button-green__pressed">
                        <span className="button-green__pressed__l"></span>
                        <span className="button-green__pressed__mid"></span>
                        <span className="button-green__pressed__r"></span>
                      </span>
                      <span className="button-green__selected">
                        <span className="button-green__selected__l"></span>
                        <span className="button-green__selected__mid"></span>
                        <span className="button-green__selected__r"></span>
                      </span>
                      <span className="button-green__default">
                        <span className="button-green__default__l"></span>
                        <span className="button-green__default__mid"></span>
                        <span className="button-green__default__r"></span>
                      </span>
                      <span className="button-green__text">
                        25
                        <span className="percentage-symbol">%</span>
                      </span>
                    </>
                  )}
                </span>
                <span
                  onClick={() => handlePercentageClick(50)}
                  className={`${
                    rangeValue === 50
                      ? "button-yellow button-yellow--percentage"
                      : "button-green button-green--percentage"
                  }`}
                >
                  {rangeValue === 50 ? (
                    <>
                      <span className="button-yellow__pressed">
                        <span className="button-yellow__pressed__l"></span>
                        <span className="button-yellow__pressed__mid"></span>
                        <span className="button-yellow__pressed__r"></span>
                      </span>
                      <span className="button-yellow__selected">
                        <span className="button-yellow__selected__l"></span>
                        <span className="button-yellow__selected__mid"></span>
                        <span className="button-yellow__selected__r"></span>
                      </span>
                      <span className="button-yellow__default">
                        <span className="button-yellow__default__l"></span>
                        <span className="button-yellow__default__mid"></span>
                        <span className="button-yellow__default__r"></span>
                      </span>
                      <span className="button-yellow__text">
                        50
                        <span className="percentage-symbol">%</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="button-green__pressed">
                        <span className="button-green__pressed__l"></span>
                        <span className="button-green__pressed__mid"></span>
                        <span className="button-green__pressed__r"></span>
                      </span>
                      <span className="button-green__selected">
                        <span className="button-green__selected__l"></span>
                        <span className="button-green__selected__mid"></span>
                        <span className="button-green__selected__r"></span>
                      </span>
                      <span className="button-green__default">
                        <span className="button-green__default__l"></span>
                        <span className="button-green__default__mid"></span>
                        <span className="button-green__default__r"></span>
                      </span>
                      <span className="button-green__text">
                        50
                        <span className="percentage-symbol">%</span>
                      </span>
                    </>
                  )}
                </span>
                <span
                  onClick={() => handlePercentageClick(75)}
                  className={`${
                    rangeValue === 75
                      ? "button-yellow button-yellow--percentage"
                      : "button-green button-green--percentage"
                  }`}
                >
                  {rangeValue === 75 ? (
                    <>
                      <span className="button-yellow__pressed">
                        <span className="button-yellow__pressed__l"></span>
                        <span className="button-yellow__pressed__mid"></span>
                        <span className="button-yellow__pressed__r"></span>
                      </span>
                      <span className="button-yellow__selected">
                        <span className="button-yellow__selected__l"></span>
                        <span className="button-yellow__selected__mid"></span>
                        <span className="button-yellow__selected__r"></span>
                      </span>
                      <span className="button-yellow__default">
                        <span className="button-yellow__default__l"></span>
                        <span className="button-yellow__default__mid"></span>
                        <span className="button-yellow__default__r"></span>
                      </span>
                      <span className="button-yellow__text">
                        75
                        <span className="percentage-symbol">%</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="button-green__pressed">
                        <span className="button-green__pressed__l"></span>
                        <span className="button-green__pressed__mid"></span>
                        <span className="button-green__pressed__r"></span>
                      </span>
                      <span className="button-green__selected">
                        <span className="button-green__selected__l"></span>
                        <span className="button-green__selected__mid"></span>
                        <span className="button-green__selected__r"></span>
                      </span>
                      <span className="button-green__default">
                        <span className="button-green__default__l"></span>
                        <span className="button-green__default__mid"></span>
                        <span className="button-green__default__r"></span>
                      </span>
                      <span className="button-green__text">
                        75
                        <span className="percentage-symbol">%</span>
                      </span>
                    </>
                  )}
                </span>
                <span
                  onClick={() => handlePercentageClick(100)}
                  className={`${
                    rangeValue === 100
                      ? "button-yellow button-yellow--percentage"
                      : "button-green button-green--percentage"
                  }`}
                >
                  {rangeValue === 100 ? (
                    <>
                      <span className="button-yellow__pressed">
                        <span className="button-yellow__pressed__l"></span>
                        <span className="button-yellow__pressed__mid"></span>
                        <span className="button-yellow__pressed__r"></span>
                      </span>
                      <span className="button-yellow__selected">
                        <span className="button-yellow__selected__l"></span>
                        <span className="button-yellow__selected__mid"></span>
                        <span className="button-yellow__selected__r"></span>
                      </span>
                      <span className="button-yellow__default">
                        <span className="button-yellow__default__l"></span>
                        <span className="button-yellow__default__mid"></span>
                        <span className="button-yellow__default__r"></span>
                      </span>
                      <span className="button-yellow__text">MAX</span>
                    </>
                  ) : (
                    <>
                      <span className="button-green__pressed">
                        <span className="button-green__pressed__l"></span>
                        <span className="button-green__pressed__mid"></span>
                        <span className="button-green__pressed__r"></span>
                      </span>
                      <span className="button-green__selected">
                        <span className="button-green__selected__l"></span>
                        <span className="button-green__selected__mid"></span>
                        <span className="button-green__selected__r"></span>
                      </span>
                      <span className="button-green__default">
                        <span className="button-green__default__l"></span>
                        <span className="button-green__default__mid"></span>
                        <span className="button-green__default__r"></span>
                      </span>
                      <span className="button-green__text">MAX</span>
                    </>
                  )}
                </span>
              </div>
              <div className="custom-range">
                <input
                  className="custom-range-input"
                  type="range"
                  min="0"
                  max="100"
                  value={rangeValue}
                  step="1"
                  onChange={handleRangeChange}
                />
              </div>
            </div>
            <div className="poolrem-liq-summary">
              <div className="poolrem-liq-summary-itemgroup">
                <div className="poolrem-liq-summary-item">
                  <span className="poolrem-liq-summary-label">
                    Pooled {youPayToken}
                  </span>
                  <span className="poolrem-liq-summary-value">{amount_0}</span>
                  <img
                    src={tokenImages[youPayToken]}
                    className="poolrem-liq-summary-tokens-logo"
                  />
                </div>
                <div className="poolrem-liq-summary-item">
                  <span className="poolrem-liq-summary-label">
                    Pooled {youReceiveToken}
                  </span>
                  <span className="poolrem-liq-summary-value">{amount_1}</span>
                  <img
                    src={tokenImages[youReceiveToken]}
                    className="poolrem-liq-summary-tokens-logo"
                  />
                </div>
              </div>
              <div className="poolrem-liq-summary-itemgroup">
                <div className="poolrem-liq-summary-item">
                  <span className="poolrem-liq-summary-label">
                    {youPayToken} Fees Collected
                  </span>
                  <span className="poolrem-liq-summary-value">{lpFee0}</span>
                  <img
                    src={tokenImages[youPayToken]}
                    className="poolrem-liq-summary-tokens-logo"
                  />
                </div>
                <div className="poolrem-liq-summary-item">
                  <span className="poolrem-liq-summary-label">
                    {youReceiveToken} Fees Collected
                  </span>
                  <span className="poolrem-liq-summary-value">{lpFee1}</span>
                  <img
                    src={tokenImages[youReceiveToken]}
                    className="poolrem-liq-summary-tokens-logo"
                  />
                </div>
              </div>
              <div className="poolrem-liq-summary-itemgroup">
                <div className="poolrem-liq-summary-item">
                  <span className="poolrem-liq-summary-label">
                    Total {youPayToken}
                  </span>
                  <span className="poolrem-liq-summary-value">{total0}</span>
                  <img
                    src={tokenImages[youPayToken]}
                    className="poolrem-liq-summary-tokens-logo"
                  />
                </div>
                <div className="poolrem-liq-summary-item">
                  <span className="poolrem-liq-summary-label">
                    Total {youReceiveToken}
                  </span>
                  <span className="poolrem-liq-summary-value">{total1}</span>
                  <img
                    src={tokenImages[youReceiveToken]}
                    className="poolrem-liq-summary-tokens-logo"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pool-add-button-container">
        <button
          onClick={() => setIsRemoveLiquidityConfirmationModalOpen(true)}
          disabled={isButtonDisabled}
          type="button"
          className="buttonbig-yellow buttonbig-yellow--asbutton buttonbig-yellow--pool-remove"
        >
          <span className="buttonbig-yellow__pressed">
            <span className="buttonbig-yellow__pressed__l"></span>
            <span className="buttonbig-yellow__pressed__mid"></span>
            <span className="buttonbig-yellow__pressed__r"></span>
          </span>
          <span className="buttonbig-yellow__selected">
            <span className="buttonbig-yellow__selected__l"></span>
            <span className="buttonbig-yellow__selected__mid"></span>
            <span className="buttonbig-yellow__selected__r"></span>
          </span>
          <span className="buttonbig-yellow__default">
            <span className="buttonbig-yellow__default__l"></span>
            <span className="buttonbig-yellow__default__mid"></span>
            <span className="buttonbig-yellow__default__r"></span>
          </span>
          <span className="buttonbig-yellow__text">Remove Liquidity</span>
        </button>
      </div>

      {isProcessing ? (
        <Modal
          isOpen={isProcessing}
          onClose={() => setIsProcessing(false)}
          headTitle={"Remove Liquidity Submitted"}
        >
          <TransactionProgressComponent
            transaction={
              transactionStateObject &&
              transactionStateObject.Ok &&
              transactionStateObject
            }
            typeOfTransaction={"removeLiquidity"}
            removeTokenApproved={isTokenApproved}
            initialState={"Approve"}
          />
        </Modal>
      ) : isRemoveLiquidityConfirmationModalOpen ? (
        <Modal
          isOpen={isRemoveLiquidityConfirmationModalOpen}
          onClose={() => setIsRemoveLiquidityConfirmationModalOpen(false)}
          headTitle={"Confirm Remove Liquidity"}
        >
          <div className="modal-content">
            <div className="review-lq-item">
              <img
                src={tokenImages[youPayToken]}
                className="review-lq-token review-lq-token--behind"
              />
              <img src={tokenImages[youReceiveToken]} className="review-lq-token" />
              <span className="review-lq-tokens-name">
                {youPayToken}/{youReceiveToken} LP
              </span>
            </div>
            <h4 className="modal-confirmation-panneltitle">
              LP tokens to be removed
            </h4>
            <span className="summary-simple-number">{amount}</span>
            <button
              className="buttonbig-yellow buttonbig-yellow--confirmation"
              onClick={removeLiquidity}
              disabled={isProcessing}
            >
              <span className="buttonbig-yellow__pressed">
                <span className="buttonbig-yellow__pressed__l"></span>
                <span className="buttonbig-yellow__pressed__mid"></span>
                <span className="buttonbig-yellow__pressed__r"></span>
              </span>
              <span className="buttonbig-yellow__selected">
                <span className="buttonbig-yellow__selected__l"></span>
                <span className="buttonbig-yellow__selected__mid"></span>
                <span className="buttonbig-yellow__selected__r"></span>
              </span>
              <span className="buttonbig-yellow__default">
                <span className="buttonbig-yellow__default__l"></span>
                <span className="buttonbig-yellow__default__mid"></span>
                <span className="buttonbig-yellow__default__r"></span>
              </span>
              <span className="buttonbig-yellow__text">Confirm</span>
            </button>
          </div>
        </Modal>
      ) : isRemoveLiquiditySuccessfulModalOpen ? (
        <Modal
          isOpen={isRemoveLiquiditySuccessfulModalOpen}
          onClose={() => {
            clearFields();
            setSuccessModalData({ amount_0: 0, amount_1: 0, lpTokensRemoved: 0 }); // Reset the success modal data
            setIsRemoveLiquiditySuccessfulModalOpen(false);
          }}
          headTitle={"Remove Liquidity Successful"}
        >
          <div className="modal-content">
            <div className="modal-image-status">
              <img src={confirmationImageRemoveLq} className="modal-top-pic" />
            </div>
            <div className="modal-title-status">
              Remove Liquidity Successful
            </div>
            <div className="modal-view-on-explorer">
              <div className="view-on-explorer-button">
                {hasClaimed ? (
                  <span
                    onClick={() => {
                      clearFields();
                      setSuccessModalData({
                        amount_0: 0,
                        amount_1: 0,
                        lpTokensRemoved: 0,
                      }); // Reset the success modal data
                      setIsRemoveLiquiditySuccessfulModalOpen(false);
                      changeDrawerContent("claims");
                    }}
                    className="view-on-explorer-text"
                  >
                    Remove liquidity successful, but an issue occurred on the
                    final step. Please claim your tokens here.
                  </span>
                ) : (
                  <span className="view-on-explorer-text">
                    View on Explorer{" "}
                  </span>
                )}
                <span className="view-on-explorer-icon">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.66667 4.33333L9 1M9 1H6.77778M9 1V3.22222M9 5.88889V8.11111C9 8.34686 8.90635 8.57295 8.73965 8.73965C8.57295 8.90635 8.34686 9 8.11111 9H1.88889C1.65314 9 1.42705 8.90635 1.26035 8.73965C1.09365 8.57295 1 8.34686 1 8.11111V1.88889C1 1.65314 1.09365 1.42705 1.26035 1.26035C1.42705 1.09365 1.65314 1 1.88889 1H4.11111"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
            {/* Display Amount 0, Amount 1, and Total */}
            <div className="modal-confirmation-summary">
              <div className="summary-row">
                <div className="summary-label">You removed</div>
                <div className="summary-value">
                  <span className="summary-value-number">
                    {successModalData.lpTokensRemoved}
                  </span>
                  <span className="summary-value-small">
                    {youPayToken}/{youReceiveToken} LP
                  </span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-label">You get</div>
                <div className="summary-values">
                  <div className="summary-value-row">
                    <span className="summary-value-number">
                      {successModalData.amount_0}
                    </span>
                    <span className="summary-value-small">{youPayToken}</span>
                  </div>
                  <div className="summary-value-row">
                    <span className="summary-value-number">
                      {successModalData.amount_1}
                    </span>
                    <span className="summary-value-small">
                      {youReceiveToken}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      ) : isFailedModalOpen ? (
        <Modal
          isOpen={isFailedModalOpen}
          onClose={closeFailedModal}
          headTitle={"Failed Remove"}
          customHead={
            <div class="modal-head">
              <div onClick={closeFailedModal} class="modal-close">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                >
                  <path d="M1.4 14L0 12.6L5.6 7L0 1.4L1.4 0L7 5.6L12.6 0L14 1.4L8.4 7L14 12.6L12.6 14L7 8.4L1.4 14Z" />
                </svg>
              </div>
            </div>
          }
        >
          <div class="modal-image-status">
            <img src={failedImageSwap} class="modal-top-pic" />
          </div>
          <div class="modal-title-status">Oops, something went wrong</div>
          <div className="modal-view-on-explorer">
            <div className="view-on-explorer-button">
              {hasClaimed ? (
                <span
                  onClick={() => {
                    closeFailedModal();
                    changeDrawerContent("claims");
                  }}
                  className="view-on-explorer-text"
                >
                  Remove liquidity successful, but an issue occured on the final
                  step. Please claim your tokens here{" "}
                </span>
              ) : null}
            </div>
          </div>
          <div class="modal-confirmation-summary">
            <div class="summary-row">
              <div class="summary-value">
                <span class="summary-value-number">
                  Failed to remove liquidity {youPayToken}/{youReceiveToken} LP
                </span>
              </div>
            </div>
            <div class="summary-row">
              <div class="summary-value">
                {/* <span class="summary-value-number">{youPay}</span>
              <span class="summary-value-small">{youPayToken}</span> */}
                {transactionStateObject && transactionStateObject.Ok ? (
                  <span class="summary-value-number">
                    {
                      transactionStateObject.Ok[0].statuses[
                        transactionStateObject.Ok[0].statuses.length - 2
                      ]
                    }
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
};

export default RemoveLiquidityComponent;
