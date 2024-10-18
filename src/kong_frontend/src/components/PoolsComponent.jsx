import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import confirmationImageAddLq from "../../../assets/kong-approves-add-lq.png";
import BigNumber from "bignumber.js";
import Modal from "./Modal";
import { toast } from "react-toastify";
import { Principal } from "@dfinity/principal";
import useIdentity from "./useIdentity";
import { useLocation, useNavigate, Link } from "react-router-dom";
import TransactionProgressComponent from "./TransactionProgressComponent";
import DOMPurify from "dompurify";
import addLiquiditySound from "../../../assets/Add-Liquidity-succesful.mp3";
import failedImageSwap from "../../../assets/kong-failed.png";
import { priceRoundedAmount } from "../utils/numberUtils";
import debounce from "lodash/debounce";
import { formatNumber } from "../utils/formatBalances";
import { tokenBalancesSelector } from "../constants/tokensConstants";
import { icrc1Tokens } from "../utils/getIcrc1Tokens";
import { Skeleton } from "@mui/material";

export const KONG_FRONTEND =
  "http://" + process.env.CANISTER_ID_KONG_FRONTEND + ".localhost:4943";
export const KONG_BACKEND_PRINCIPAL = Principal.fromText(
  process.env.CANISTER_ID_KONG_BACKEND
);

let addLiquiditySoundPlayed = new Audio(addLiquiditySound);

const PoolsComponent = ({
  userDetails,
  changeDrawerContent,
  tokenDetails,
  getUserBalances,
  getLiquidityPoolBalances,
  tokenPrices,
  principal,
  tokenImages,
  initialPool
}) => {
  const {
    actors: {
      backendKingKong,
      icp_ledger_backend,
      ckbtc_ledger_backend,
      cketh_ledger_backend,
      // kong_ledger_backend,
      ckusdc_ledger_backend,
      ckusdt_ledger_backend,
      dkp_ledger_backend,
      bits_ledger_backend,
      chat_ledger_backend,
      nanas_ledger_backend,
      nd64_ledger_backend,
      wtn_ledger_backend,
      yuge_ledger_backend,
      NICP_ledger_backend,
      alpacalb_backend,
      party_backend,
      sneed_backend,
      clown_backend,
      damonic_backend,
      exe_backend,
      wumbo_backend,
      mcs_backend,
      bob_backend,
      burn_backend,
      ntn_backend,
      dcd_backend,
      gldgov_backend,
      owl_backend,
      ogy_backend,
      fpl_backend,
      ditto_backend,
      icvc_backend,
    },
  } = useIdentity();

  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  // const initialPool = queryParams.get("pool")
  //   ? queryParams.get("pool").split("_")
  //   : ["ICP", "ckUSDT"];
  const initialYouPayToken = initialPool ? initialPool.split("_")[0] : null;
  const initialYouReceiveToken = initialPool ? initialPool.split("_")[1] : null;
  const [youPayToken, setYouPayToken] = useState(initialYouPayToken);
  const [youReceiveToken] = useState("ckUSDT");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectingPayToken, setIsSelectingPayToken] = useState(true);
  const [youPay, setYouPay] = useState("0");
  // const [youPayToken, setYouPayToken] = useState("ckBTC");
  const [youReceive, setYouReceive] = useState("0");
  const [isProcessing, setIsProcessing] = useState(false);
  const [
    isAddLiquidityConfirmationModalOpen,
    setIsAddLiquidityConfirmationModalOpen,
  ] = useState(false);
  const [
    isAddLiquiditySuccessfulModalOpen,
    setIsAddLiquiditySuccessfulModalOpen,
  ] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [transactionStateObject, setTransactionStateObject] = useState(null);
  const [payToken1Finished, setPayToken1Finished] = useState(false);
  const [receiveToken1Finished, setReceiveToken1Finished] = useState(false);
  const [availableBalanceMax, setAvailableBalanceMax] = useState(undefined);
  const [availableBalanceMaxReceive, setAvailableBalanceMaxReceive] =
    useState(undefined);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [youPayInternal, setYouPayInternal] = useState("0");
  const [isFailedModalOpen, setIsFailedModalOpen] = useState(false);
  const [displayYouReceive, setDisplayYouReceive] = useState("0");
  const [inputError, setInputError] = useState(false); // For styling the input in error state

  const [buttonText, setButtonText] = useState("Add Liquidity"); // Default button text
  const [insufficientPayTokenBalance, setInsufficientPayTokenBalance] =
    useState(false); // Insufficient balance for pay token
  const [insufficientReceiveTokenBalance, setInsufficientReceiveTokenBalance] =
    useState(false); // Insufficient balance for receive token
  const [isProcessingOutput, setIsProcessingOutput] = useState(false);
  const inputProcess = useRef(null);

  useEffect(() => {
    addLiquiditySoundPlayed = new Audio(addLiquiditySound);
  }, []);  

  const playAddLiqClickSound = () => {
    addLiquiditySoundPlayed.play();
  };

  useEffect(() => {
    if (initialPool) {
      const payToken = initialPool.split("_")[0];
      setYouPayToken(payToken);
    }
  }, [initialPool]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const pool = `${youPayToken}_ckUSDT`;
    queryParams.set("pool", pool);
    if (youPayToken === "ckUSDT") {
      queryParams.set("pool", `${initialYouReceiveToken}_ckUSDT`);
    }
    navigate({ search: queryParams.toString() });
  }, [youPayToken, youReceiveToken, navigate]);

  const getTokenDecimals = useCallback(
    (tokenSymbol) => {
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
          return {
            decimals: token.decimals,
            gasFee: token.fee,
          };
        }
      }

      return {
        decimals: 8,
        gasFee: 0,
      }; // Default to 8 if the token is not found, adjust if necessary
    },
    [tokenDetails]
  );

  const getSwapAmountLiqudity = useCallback(
    async (amount, noOutcome) => {
      const { decimals: youPayDecimals } = getTokenDecimals(youPayToken);
      const { decimals: youReceiveDecimals } =
        getTokenDecimals(youReceiveToken);

      let youPayAmount;
      if (youPayToken && youPayDecimals !== undefined) {
        youPayAmount = new BigNumber(amount).multipliedBy(
          new BigNumber(10).pow(youPayDecimals)
        );
      }
      const liqudityAmounts = await backendKingKong.add_liquidity_amounts(
        youPayToken,
        youPayAmount.toNumber(),
        youReceiveToken
      );

      if (amount !== inputProcess.current) {
        return;
      }
      if (noOutcome) {
        return { payAmount: liqudityAmounts.Ok.amount_0, youPayDecimals };
      }

      if (liqudityAmounts.Ok) {
        const payAmount = new BigNumber(liqudityAmounts.Ok.amount_0)
          .dividedBy(new BigNumber(10).pow(youPayDecimals))
          .toString();
        const receiveAmount = new BigNumber(liqudityAmounts.Ok.amount_1)
          .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
          .toString();
        setYouPayInternal(payAmount);
        setYouReceive(receiveAmount);
        setDisplayYouReceive(formatNumber(receiveAmount, 6));
        // setIsProcessingOutput(false);
        return receiveAmount;
      } else if (liqudityAmounts.Err) {
        toast(liqudityAmounts.Err);
        // setIsProcessingOutput(false);
        return null;
      }
      // setIsProcessingOutput(false);
      return null;
    },
    [
      youPay,
      youReceive,
      youPayToken,
      youReceiveToken,
      backendKingKong,
      getTokenDecimals,
      tokenPrices,
    ]
  );

  const debouncedAddLiquidityPrice = useCallback(
    debounce(async (payAmount) => {
      await getSwapAmountLiqudity(payAmount);
    }, 500), // 100ms delay
    [getSwapAmountLiqudity]
  );

  const approvePayToken = useCallback(
    async (pay_amount, gas_amount, ledger_auth) => {
      try {
        let expires_at = Date.now() * 1000000 + 60000000000; // 30 seconds from now in nanoseconds

        let approve_args = {
          fee: [],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          amount: Number(pay_amount) + Number(gas_amount),
          expected_allowance: [],
          expires_at: [expires_at],
          spender: { owner: KONG_BACKEND_PRINCIPAL, subaccount: [] },
        };

        let approve_result = await ledger_auth.icrc2_approve(approve_args);
        if (approve_result.hasOwnProperty("Err")) {
          return false;
        }
        return approve_result.Ok;
      } catch (error) {
        toast(error);
        setIsAddLiquidityConfirmationModalOpen(false);
        setIsProcessing(false);
        setRequestId(null);
        return false;
      }
    },
    []
  );

  const transferPayToken = useCallback(async (pay_amount, ledger_auth) => {
    try {
      let transfer_args = {
        to: { owner: KONG_BACKEND_PRINCIPAL, subaccount: [] },
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: pay_amount,
      };

      let transfer_result = await ledger_auth.icrc1_transfer(transfer_args);
      if (transfer_result.hasOwnProperty("Err")) {
        toast(transfer_result.Err);
        return false;
      }
      return transfer_result.Ok;
    } catch (error) {
      toast(error);
      setIsAddLiquidityConfirmationModalOpen(false);
      setIsProcessing(false);
      setRequestId(null);
      return false;
    }
  }, []);

  const addLiquidity = useCallback(async () => {
    setIsProcessing(true);

    const { decimals: youPayDecimals, gasFee: gasFeePay } =
      getTokenDecimals(youPayToken);
    const { decimals: youReceiveDecimals, gasFee: gasFeeReceive } =
      getTokenDecimals(youReceiveToken);

    let youPayAmountFinal;
    let youReceiveAmountFinal;

    if (youPayToken && youPayDecimals !== undefined) {
      youPayAmountFinal = new BigNumber(youPayInternal).multipliedBy(
        new BigNumber(10).pow(youPayDecimals)
      );
    }

    if (youReceiveToken && youReceiveDecimals !== undefined) {
      youReceiveAmountFinal = new BigNumber(youReceive).multipliedBy(
        new BigNumber(10).pow(youReceiveDecimals)
      );
    }

    const selectBackend = (token) => {
      switch (token) {
        case "ICP":
          return icp_ledger_backend;
        case "ckBTC":
          return ckbtc_ledger_backend;
        case "ckETH":
          return cketh_ledger_backend;
        case "ckUSDC":
          return ckusdc_ledger_backend;
        case "ckUSDT":
          return ckusdt_ledger_backend;
        case "DKP":
          return dkp_ledger_backend;
        case "Bits":
          return bits_ledger_backend;
        case "CHAT":
          return chat_ledger_backend;
        case "nanas":
          return nanas_ledger_backend;
        case "ND64":
          return nd64_ledger_backend;
        case "WTN":
          return wtn_ledger_backend;
        case "YUGE":
          return yuge_ledger_backend;
        case "nICP":
          return NICP_ledger_backend;
        case "ALPACALB":
          return alpacalb_backend;
        case "PARTY":
          return party_backend;
        case "SNEED":
          return sneed_backend;
        case "CLOWN":
          return clown_backend;
        case "DAMONIC":
          return damonic_backend;
        case "EXE":
          return exe_backend;
        case "WUMBO":
          return wumbo_backend;
        case "MCS":
          return mcs_backend;
        case "BOB":
          return bob_backend;
        case "BURN":
          return burn_backend;
        case "NTN":
          return ntn_backend;
        case "DCD":
          return dcd_backend;
        case "GLDGov":
          return gldgov_backend;
        case "OWL":
          return owl_backend;
        case "OGY":
          return ogy_backend;
        case "FPL":
          return fpl_backend;
        case "DITTO":
          return ditto_backend;
        case "ICVC":
          return icvc_backend;
        default:
          return null;
      }
    };

    let approve_tx_id_1;
    let transfer_tx_id_1;

    if (icrc1Tokens.includes(youPayToken)) {
      // Transfer token
      transfer_tx_id_1 = await transferPayToken(
        youPayAmountFinal.toNumber(),
        selectBackend(youPayToken)
      );
      setPayToken1Finished(true);
      if (!transfer_tx_id_1) {
        setIsProcessing(false);
        return;
      }
    } else {
      // Approve Pay Token
      approve_tx_id_1 = await approvePayToken(
        youPayAmountFinal.toNumber(),
        gasFeePay,
        selectBackend(youPayToken)
      );
      setPayToken1Finished(true);
      if (!approve_tx_id_1) {
        setIsProcessing(false);
        return;
      }
    }


    // Approve Receive Token
    const approve_tx_id_2 = await approvePayToken(
      youReceiveAmountFinal.toNumber(),
      gasFeeReceive,
      selectBackend(youReceiveToken)
    );
    setReceiveToken1Finished(true);
    if (!approve_tx_id_2) {
      setIsProcessing(false);
      return;
    }

    const liquidityObjRequest = {
      token_0: youPayToken,
      amount_0: youPayAmountFinal.toNumber(),
      tx_id_0: transfer_tx_id_1 ? [{ BlockIndex: transfer_tx_id_1 }] : [],
      token_1: youReceiveToken,
      amount_1: youReceiveAmountFinal.toNumber(),
      tx_id_1: [],
    };

    backendKingKong
      .add_liquidity_async(liquidityObjRequest)
      .then((response) => {
        if (response.Ok) {
          setRequestId(response.Ok);
        } else if (response.Err) {
          toast(response.Err);
        }
      })
      .catch((error) => {
        console.error("Add liquidity error:", error);
        toast("An error occurred while adding liquidity.");
        setIsAddLiquidityConfirmationModalOpen(false);
      });
  }, [
    youPayToken,
    youReceiveToken,
    youPayInternal,
    youReceive,
    backendKingKong,
    approvePayToken,
    setPayToken1Finished,
    setReceiveToken1Finished,
    getTokenDecimals,
    setIsAddLiquidityConfirmationModalOpen,
    icp_ledger_backend,
    ckbtc_ledger_backend,
    cketh_ledger_backend,
    // kong_ledger_backend,
    ckusdc_ledger_backend,
    ckusdt_ledger_backend,
    dkp_ledger_backend,
    bits_ledger_backend,
    chat_ledger_backend,
    nanas_ledger_backend,
    nd64_ledger_backend,
    wtn_ledger_backend,
    yuge_ledger_backend,
    NICP_ledger_backend,
    alpacalb_backend,
    party_backend,
    sneed_backend,
    clown_backend,
    damonic_backend,
    exe_backend,
    wumbo_backend,
    mcs_backend,
    bob_backend,
    burn_backend,
    ntn_backend,
    dcd_backend,
    gldgov_backend,
    owl_backend,
    ogy_backend,
    fpl_backend,
    ditto_backend,
    icvc_backend,
  ]);

  useEffect(() => {
    if (requestId) {
      const intervalId = setInterval(async () => {
        try {
          const requestObj = await backendKingKong.requests([requestId]);
          const requestReply =
            requestObj && requestObj.Ok[0] && requestObj.Ok[0].reply;
          setTransactionStateObject(requestObj);
          // console.log('request object', requestObj)
          if (
            requestReply &&
            requestReply.AddLiquidity &&
            requestReply.AddLiquidity.status === "Failed"
          ) {
            const claimIds = requestReply.AddLiquidity.claim_ids;
            setHasClaimed(claimIds.length > 0);

            toast("An error occurred while adding liquidity.");
            setIsAddLiquidityConfirmationModalOpen(false);
            setIsProcessing(false);
            setRequestId(null);
            setIsFailedModalOpen(true);
            clearInterval(intervalId);
          } else if (requestReply && requestReply.Pending === null) {
            return;
          } else if (
            requestReply &&
            requestReply.AddLiquidity &&
            requestReply.AddLiquidity.status === "Success"
          ) {
            // console.log('request reply', requestReply.AddLiquidity)
            const claimIds = requestReply.AddLiquidity.claim_ids;
            const { decimals: youPayDecimals } = getTokenDecimals(youPayToken);
            const { decimals: youReceiveDecimals } =
              getTokenDecimals(youReceiveToken);
            setHasClaimed(claimIds.length > 0);
            setYouPay(
              new BigNumber(requestReply.AddLiquidity.amount_0)
                .dividedBy(new BigNumber(10).pow(youPayDecimals))
                .toString()
            );
            setYouReceive(
              new BigNumber(requestReply.AddLiquidity.amount_1)
                .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
                .toString()
            );
            setDisplayYouReceive(formatNumber(youReceive, 6));
            getUserBalances();
            getLiquidityPoolBalances();
            playAddLiqClickSound();
            setIsAddLiquidityConfirmationModalOpen(false);
            setIsProcessing(false);
            setIsAddLiquiditySuccessfulModalOpen(true);
            setRequestId(null);
            clearInterval(intervalId);
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
  }, [
    requestId,
    backendKingKong,
    youReceiveToken,
    youPayToken,
    tokenPrices,
    getTokenDecimals,
    getUserBalances,
    getLiquidityPoolBalances,
  ]);

  const handleTokenChange = (token) => {
    if (token === "ckUSDT") {
      setIsModalOpen(false);
      return;
    }
    if (isSelectingPayToken) {
      setYouPayToken(token);
    }
    setIsModalOpen(false);
  };

  const sanitizeInput = useCallback((input) => {
    // Prefix leading dot with a zero
    let sanitizedInput = input.replace(/^\./, "0.");

    // Remove leading zeros unless followed by a dot
    sanitizedInput = sanitizedInput.replace(/^0+(?!\.|$)/, "");

    // Allow only one dot and remove non-numeric characters except dot
    sanitizedInput = sanitizedInput.replace(/[^0-9.]/g, "");

    // Allow only one dot in the input
    sanitizedInput = sanitizedInput.replace(/(\..*?)\..*/g, "$1");
    const clean = DOMPurify.sanitize(sanitizedInput);
    return clean;
  }, []);

  const handleInputChange = useCallback(
    (value) => {
      const sanitizedValue = sanitizeInput(value);
      inputProcess.current = sanitizedValue;
      setIsProcessingOutput(true)
      // Check if the input is zero or invalid (like 0, 0.00, etc.)
      if (
        sanitizedValue === "" || // Empty input
        sanitizedValue === "0" || // Plain zero
        /^0+(\.0+)?$/.test(sanitizedValue) // Matches 0.0, 0.00, etc.
      ) {
        setYouPay(sanitizedValue); // Set youPay with the sanitized value
        setYouReceive("0"); // Reset youReceive to "0"
        setDisplayYouReceive("0"); // Update the displayed value of youReceive
        setIsProcessingOutput(false)
        return; // Prevent further execution
      }

      setYouPay(sanitizedValue); // Set the input value for `youPay`
      debouncedAddLiquidityPrice(sanitizedValue); // Call the debounced function with the valid input
    },
    [sanitizeInput, debouncedAddLiquidityPrice]
  );

  const handleMaxClick = () => {
    handleInputChange(availableBalanceMax);
  };

  useEffect(() => {
    const getLiquidityPriceInitial = async () => {
      if (!backendKingKong || !youPayToken || !youReceiveToken || !userDetails)
        return null;

      // Get user balance and sanitize by removing commas, handling empty values as "0"
      const userBalanceRawPay =
        userDetails[tokenBalancesSelector[youPayToken]] || "0";
      const userBalancePaySanitized = userBalanceRawPay.replace(/,/g, "");
      const userBalance = new BigNumber(userBalancePaySanitized);

      // Get token decimals and gas fee information
      const { decimals: youPayDecimals, gasFee: gasFeePay } =
        getTokenDecimals(youPayToken);
      const { decimals: youReceiveDecimals, gasFee: gasFeeReceive } =
        getTokenDecimals(youReceiveToken);

      // Transform user balance to the required precision
      const transformedPayAmount = userBalance.multipliedBy(
        new BigNumber(10).pow(youPayDecimals)
      );

      // Deduct the gas fee from the transformed amount for `youPayToken`
      const gasCost1 = icrc1Tokens.includes(youPayToken)
        ? new BigNumber(gasFeePay)
        : new BigNumber(gasFeePay).multipliedBy(2);
      const gasCost2 = icrc1Tokens.includes(youReceiveToken)
        ? new BigNumber(gasFeeReceive)
        : new BigNumber(gasFeeReceive).multipliedBy(2);

      const availableAmountAfterFeePay = transformedPayAmount.minus(gasCost1);

      // Convert back to the normal decimal representation for display for `youPayToken`
      const availableBalanceMaxPay = availableAmountAfterFeePay
        .dividedBy(new BigNumber(10).pow(youPayDecimals))
        .toString();

      // Repeat the process for `youReceiveToken`
      const userBalanceRawReceive =
        userDetails[tokenBalancesSelector[youReceiveToken]] || "0";
      const userBalanceReceiveSanitized = userBalanceRawReceive.replace(
        /,/g,
        ""
      );
      const receiveUserBalance = new BigNumber(userBalanceReceiveSanitized);
      const transformedReceiveAmount = receiveUserBalance.multipliedBy(
        new BigNumber(10).pow(youReceiveDecimals)
      );
      const availableAmountAfterFeeReceive =
        transformedReceiveAmount.minus(gasCost2);
      const availableBalanceMaxReceive = availableAmountAfterFeeReceive
        .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
        .toString();

      // Use priceRoundedAmount to format the amounts, ensuring no NaN values
      const availableMaxDisplayPay = priceRoundedAmount(
        tokenPrices[youPayToken + "_ckUSDT"],
        availableBalanceMaxPay
      );
      const availableMaxDisplayReceive = priceRoundedAmount(
        tokenPrices[youReceiveToken + "_ckUSDT"],
        availableBalanceMaxReceive
      );

      // Update the state variables for displaying max available balance

      if (userBalance.isZero() || availableAmountAfterFeePay.isNegative()) {
        setAvailableBalanceMax("0.0000");
      } else {
        setAvailableBalanceMax(
          !availableMaxDisplayPay ? "0.0000" : availableMaxDisplayPay
        );
      }

      if (
        receiveUserBalance.isZero() ||
        availableAmountAfterFeeReceive.isNegative()
      ) {
        setAvailableBalanceMaxReceive("0.0000");
      } else {
        setAvailableBalanceMaxReceive(
          !availableMaxDisplayReceive ? "0.0000" : availableMaxDisplayReceive
        );
      }
    };

    getLiquidityPriceInitial();
  }, [
    userDetails,
    youPayToken,
    youReceiveToken,
    backendKingKong,
    getTokenDecimals,
    tokenPrices,
  ]);

  useEffect(() => {
    const isPayTokenInsufficient = Number(youPay) > Number(availableBalanceMax);
    const isReceiveTokenInsufficient =
      Number(youReceive) > Number(availableBalanceMaxReceive);

    if (isPayTokenInsufficient && isReceiveTokenInsufficient) {
      setButtonText("Insufficient Balances"); // Both tokens have insufficient balance
      setInsufficientPayTokenBalance(true);
      setInsufficientReceiveTokenBalance(true);
    } else if (isPayTokenInsufficient) {
      setButtonText(`Insufficient ${youPayToken} Balance`); // If pay token balance is insufficient
      setInsufficientPayTokenBalance(true);
      setInsufficientReceiveTokenBalance(false);
    } else if (isReceiveTokenInsufficient) {
      setButtonText(`Insufficient ${youReceiveToken} Balance`); // If receive token balance is insufficient
      setInsufficientPayTokenBalance(false);
      setInsufficientReceiveTokenBalance(true);
    } else {
      setButtonText("Add Liquidity"); // Reset the button if both balances are sufficient
      setInsufficientPayTokenBalance(false);
      setInsufficientReceiveTokenBalance(false);
    }
  }, [
    youPay,
    youReceive,
    availableBalanceMax,
    availableBalanceMaxReceive,
    userDetails,
    youPayToken,
    youReceiveToken,
    tokenBalancesSelector,
  ]);

  const clearInputs = () => {
    setYouPay("0");
    setYouReceive("0");
    setYouPayInternal("0");
    setDisplayYouReceive("0");
    setRequestId(null);
    setTransactionStateObject(null);
    setPayToken1Finished(false);
    setReceiveToken1Finished(false);
    setIsAddLiquiditySuccessfulModalOpen(false);
  };

  const closeFailedModal = () => {
    setIsFailedModalOpen(false);
    setTransactionStateObject(null);
    clearInputs();
  };

  const isButtonDisabled = useMemo(() => {
    return (
      isProcessing ||
      insufficientPayTokenBalance ||
      insufficientReceiveTokenBalance ||
      isAddLiquidityConfirmationModalOpen ||
      inputError ||
      !principal ||
      Number(youPay) === 0
    );
  }, [
    inputError,
    youPay,
    isProcessing,
    principal,
    insufficientPayTokenBalance,
    insufficientReceiveTokenBalance,
    isAddLiquidityConfirmationModalOpen,
  ]);

  useEffect(() => {
    const youPayBigNumber = new BigNumber(youPay);
    const youReceiveBigNumber = new BigNumber(youReceive);
    if ((youPayBigNumber.isZero() || youPayBigNumber.isNaN() || !youPay) && !youReceiveBigNumber.isZero()) {
      setYouPay(null);
      setYouReceive("0");
      setDisplayYouReceive("0");
    }
  }, [youPay, youReceive]);

  useEffect(() => {
    if (isProcessingOutput && displayYouReceive) {
      // add a delay to prevent the input from flickering
      setTimeout(() => {
        setIsProcessingOutput(false);
      } , 400);
    }
  }, [displayYouReceive]);

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
          <div className="pool-container">
            <div className="pool-container-head-tabs">
              <Link className="pool-container-head-tab active">
                Add Liquidity
              </Link>
              <Link
                to={`/?viewtab=remove&pool=${youPayToken}_${youReceiveToken}`}
                className="pool-container-head-tab"
              >
                Remove Liquidity
              </Link>
            </div>
            <h4 className="pool-container-title pool-container-title--select">
              Select Tokens
            </h4>
            <div className="pool-token-selectors">
              <span
                onClick={() => {
                  setIsSelectingPayToken(true);
                  setIsModalOpen(true);
                }}
                className="buttonmed-yellow buttonmed-yellow--customselect2 buttonmed-yellow--poolpay"
              >
                <span className="buttonmed-yellow__pressed">
                  <span className="buttonmed-yellow__pressed__l"></span>
                  <span className="buttonmed-yellow__pressed__mid"></span>
                  <span className="buttonmed-yellow__pressed__r"></span>
                </span>
                <span className="buttonmed-yellow__selected">
                  <span className="buttonmed-yellow__selected__l"></span>
                  <span className="buttonmed-yellow__selected__mid"></span>
                  <span className="buttonmed-yellow__selected__r"></span>
                </span>
                <span className="buttonmed-yellow__default">
                  <span className="buttonmed-yellow__default__l"></span>
                  <span className="buttonmed-yellow__default__mid"></span>
                  <span className="buttonmed-yellow__default__r"></span>
                </span>
                <img
                  src={tokenImages[youPayToken]}
                  className="buttonmed-yellow__icon"
                />
                <span className="buttonmed-yellow__text">{youPayToken}</span>
                <svg
                  className="custom-select-2-arrow"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g clipPath="url(#clip0_75_306)">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M9.795 12.045C9.58406 12.2557 9.29813 12.374 9 12.374C8.70188 12.374 8.41594 12.2557 8.205 12.045L3.9615 7.80304C3.75056 7.59199 3.63209 7.30579 3.63216 7.0074C3.63223 6.709 3.75083 6.42286 3.96188 6.21191C4.17292 6.00097 4.45912 5.8825 4.75752 5.88257C5.05591 5.88264 5.34205 6.00124 5.553 6.21229L9 9.65929L12.447 6.21229C12.6591 6.00726 12.9432 5.89373 13.2382 5.89615C13.5332 5.89858 13.8154 6.01676 14.0241 6.22524C14.2327 6.43373 14.3512 6.71584 14.3539 7.01081C14.3566 7.30578 14.2433 7.59002 14.0385 7.80229L9.79575 12.0458L9.795 12.045Z"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_75_306">
                      <rect width="18" height="18" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </span>

              <span className="buttonmed-yellow buttonmed-yellow--selected buttonmed-yellow--customselect2 buttonmed-yellow--poolreceive">
                <span className="buttonmed-yellow__pressed">
                  <span className="buttonmed-yellow__pressed__l"></span>
                  <span className="buttonmed-yellow__pressed__mid"></span>
                  <span className="buttonmed-yellow__pressed__r"></span>
                </span>
                <span className="buttonmed-yellow__selected">
                  <span className="buttonmed-yellow__selected__l"></span>
                  <span className="buttonmed-yellow__selected__mid"></span>
                  <span className="buttonmed-yellow__selected__r"></span>
                </span>
                <span className="buttonmed-yellow__default">
                  <span className="buttonmed-yellow__default__l"></span>
                  <span className="buttonmed-yellow__default__mid"></span>
                  <span className="buttonmed-yellow__default__r"></span>
                </span>
                <img
                  src={tokenImages[youReceiveToken]}
                  className="buttonmed-yellow__icon"
                />
                <span className="buttonmed-yellow__text">
                  {youReceiveToken}
                </span>
              </span>
            </div>
            <h4 className="pool-container-title pool-container-title--deposit">
              Deposit Amounts
            </h4>
            <div className="pool-fieldset pool-fieldset-first">
              <div className="pool-fieldset-items">
                <div className="pool-fieldset-left">
                  <div className="pool-fieldset-inputholder"></div>
                  {/* <span className="pool-fieldset-inputholder-value">$198,605.00</span> */}
                </div>
                <div className="pool-fieldset-right">
                  <span className="pool-selected-data">
                    <img
                      src={tokenImages[youPayToken]}
                      className="pool-selected-data-logo"
                    />
                    <span className="pool-selected-data-name">
                      {youPayToken}
                    </span>
                  </span>

                  <div className="pool-under-select">
                    <span className="pool-container-selectedtoken-value">
                      Avail. {availableBalanceMax}
                    </span>
                    <span
                      onClick={() => handleMaxClick(youPayToken)}
                      className="pool-container-selectedtoken-max"
                    >
                      Max
                    </span>
                  </div>
                </div>
              </div>

              <input
                type="text"
                className="pool-container-input"
                onChange={(e) => handleInputChange(e.target.value)}
                value={youPay}
              />
            </div>
            <div className="pool-fieldset pool-fieldset-second">
              <div className="pool-fieldset-items">
                <div className="pool-fieldset-left">
                  <div className="pool-fieldset-inputholder"></div>
                  {/* <span className="pool-fieldset-inputholder-value">$198,605.00</span> */}
                </div>
                <div className="pool-fieldset-right">
                  <span className="pool-selected-data">
                    <img
                      src={tokenImages[youReceiveToken]}
                      className="pool-selected-data-logo"
                    />
                    <span className="custom-select-data-name">
                      {youReceiveToken}
                    </span>
                  </span>
                  <div className="pool-under-select">
                    <span className="pool-container-selectedtoken-value">
                      Avail. {availableBalanceMaxReceive}
                    </span>
                    {/* <span onClick={() => handleMaxClick(youReceiveToken)} className="pool-container-selectedtoken-max">Max</span> */}
                  </div>
                </div>
              </div>
              {
                isProcessingOutput ? (
                  <div className="pool-container-input-skeleton">
                    <Skeleton variant="text" width="70%" height="5rem" animation="wave" />
                  </div>
                ) : (
                  <input
                  type="text"
                  className="pool-container-input"
                  disabled
                  value={displayYouReceive}
                />
                )
              }
            </div>
          </div>
        </div>
      </div>

      <div className="pool-add-button-container">
        <button
          disabled={isButtonDisabled}
          onClick={() => setIsAddLiquidityConfirmationModalOpen(true)}
          type="button"
          className={`buttonbig-yellow buttonbig-yellow--asbutton buttonbig-yellow--pool-add ${
            isButtonDisabled ? "buttonbig-yellow__disabled" : ""
          }`}
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
          <span className="buttonbig-yellow__text">{buttonText}</span>
        </button>
      </div>
      {isProcessing ? (
        <Modal
          isOpen={isProcessing}
          onClose={() => setIsProcessing(false)}
          headTitle={"Add Liquidity Submitted"}
        >
          <TransactionProgressComponent
            transaction={
              transactionStateObject &&
              transactionStateObject.Ok &&
              transactionStateObject
            }
            typeOfTransaction={"addLiquidity"}
            initialState={"Approve"}
            payToken1Finished={payToken1Finished}
            receiveToken1Finished={receiveToken1Finished}
          />
        </Modal>
      ) : isModalOpen ? (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          headTitle={"Select a token"}
        >
          <div className="token-select-list">
            {Object.keys(tokenBalancesSelector).map((token) => (
              <div
                className="token-select-item"
                key={token}
                onClick={() => handleTokenChange(token)}
              >
                <img
                  src={tokenImages[token]}
                  className="token-select-logo"
                  alt={token}
                />
                <span className="token-select-details">
                  <span className="token-select-longname">{token}</span>
                  <span className="token-select-name">{token}</span>
                </span>
              </div>
            ))}
          </div>
        </Modal>
      ) : isAddLiquidityConfirmationModalOpen ? (
        <Modal
          isOpen={isAddLiquidityConfirmationModalOpen}
          onClose={() => setIsAddLiquidityConfirmationModalOpen(false)}
          headTitle={"Review Liquidity Addition"}
        >
          <div className="modal-content">
            <div className="review-lq-item">
              <img
                src={tokenImages[youPayToken]}
                className="review-lq-token review-lq-token--behind"
              />
              <img
                src={tokenImages[youReceiveToken]}
                className="review-lq-token"
              />
              <span className="review-lq-tokens-name">
                {youPayToken}/{youReceiveToken} LP
              </span>
            </div>
            <h4 className="modal-confirmation-panneltitle">
              Liquidity to be Added
            </h4>
            <div className="modal-confirmation-summary">
              <div className="summary-row">
                <div className="summary-token">
                  <img
                    src={tokenImages[youPayToken]}
                    className="summary-token-logo"
                  />
                  <span className="summary-token-name">{youPayToken}</span>
                </div>
                <div className="summary-value">
                  <span className="summary-value-number">{youPay}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-token">
                  <img
                    src={tokenImages[youReceiveToken]}
                    className="summary-token-logo"
                  />
                  <span className="summary-token-name">{youReceiveToken}</span>
                </div>
                <div className="summary-value">
                  <span className="summary-value-number">
                    {displayYouReceive}
                  </span>
                </div>
              </div>
            </div>
            <span
              onClick={addLiquidity}
              className="buttonbig-yellow buttonbig-yellow--confirmation"
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
            </span>
          </div>
        </Modal>
      ) : isAddLiquiditySuccessfulModalOpen ? (
        <Modal
          isOpen={isAddLiquiditySuccessfulModalOpen}
          onClose={clearInputs}
          headTitle={"Add Liquidity Successful"}
          customHead={
            <div className="modal-head">
              <div onClick={clearInputs} className="modal-close">
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
          <div className="modal-content">
            <div className="modal-image-status">
              <img src={confirmationImageAddLq} className="modal-top-pic" />
            </div>
            <div className="modal-title-status">Add Liquidity Successful</div>
            <div className="modal-view-on-explorer">
              <div className="view-on-explorer-button">
                {hasClaimed ? (
                  <span
                    onClick={() => {
                      clearInputs();
                      changeDrawerContent("claims");
                    }}
                    className="view-on-explorer-text"
                  >
                    Add liquidity successful, but an issue occured on the final
                    step. Please claim your tokens here{" "}
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
            <div className="modal-confirmation-summary">
              <div className="summary-row">
                <div className="summary-label">You added</div>
                <div className="summary-values">
                  <div className="summary-value-row">
                    <span className="summary-value-number">{youPay}</span>
                    <span className="summary-value-small">{youPayToken}</span>
                  </div>
                  <div className="summary-value-row">
                    <span className="summary-value-number">
                      {displayYouReceive}
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
          headTitle={"Failed Add liq"}
          customHead={
            <div className="modal-head">
              <div onClick={closeFailedModal} className="modal-close">
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
          <div className="modal-image-status">
            <img src={failedImageSwap} className="modal-top-pic" />
          </div>
          <div className="modal-title-status">Oops, something went wrong</div>
          <div className="modal-view-on-explorer">
            <div className="view-on-explorer-button">
              {hasClaimed ? (
                <span
                  onClick={() => {
                    clearInputs();
                    changeDrawerContent("claims");
                  }}
                  className="view-on-explorer-text"
                >
                  Add liquidity successful, but an issue occured on the final
                  step. Please claim your tokens here{" "}
                </span>
              ) : null}
            </div>
          </div>
          <div className="modal-confirmation-summary">
            {/* <div className="summary-row">
            <div className="summary-value">
              <span className="summary-value-number">
                  Failed to add liquidity {youPayToken}/{youReceiveToken} LP
                </span>
            </div>
          </div> */}
            <div className="summary-row">
              <div className="summary-value">
                {/* <span className="summary-value-number">{youPay}</span>
              <span className="summary-value-small">{youPayToken}</span> */}
                {transactionStateObject && transactionStateObject.Ok ? (
                  <span className="summary-value-number">
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

export default PoolsComponent;
