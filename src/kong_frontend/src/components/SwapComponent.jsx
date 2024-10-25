import React, { useState, useCallback, useEffect, useMemo, memo, useRef } from "react";
import kongSwapSuccessfullSound from "../../../assets/Swap-Successful.mp3";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Modal from "./Modal";
import swapIconSeparator from "../../../assets/pxicons/arrow.svg";
import confirmationImageSwap from "../../../assets/kong-approves.png";
import failedImageSwap from "../../../assets/kong-failed.png";
import { useNavigate } from "react-router-dom";
import TransactionProgressComponent from "./TransactionProgressComponent";
import DOMPurify from "dompurify";
import { priceRoundedAmount } from "../utils/priceDecimalConvertor";
import { formatNumber } from "../utils/formatBalances";
import debounce from "lodash/debounce";
import { tokenBalancesSelector } from "../App";
import { icrc1Tokens } from "../utils/getIcrc1Tokens";
import { getExplorerLinks } from "../utils/getExplorerLink";
import { FiExternalLink } from "react-icons/fi";
import { Skeleton } from "@mui/material";
import {
  useCkbtcActor,
  useCkethActor,
  useCkusdcActor,
  useIcpActor,
  useKingKongActor,
  useCkusdtActor,
  useNICPActor,
  useWtnActor,
  useYugeActor,
  useChatActor,
  useDkpActor,
  useNanasActor,
  useNd64Actor,
  useBitsActor,
  useAlpacalbActor,
  usePartyActor,
  useSneedActor,
  useClownActor,
  useExeActor,
  useWumboActor,
  useMcsActor,
  useDamonicActor,
  useBobActor,
  useBurnActor,
  useDcdActor,
  useDittoActor,
  useFplActor,
  useGldgovActor,
  useIcvcActor,
  useNtnActor,
  useOgyActor,
  useOwlActor
} from "../Actors/identityKitActorInitiation";

export const KONG_FRONTEND =
  "http://" + process.env.CANISTER_ID_KONG_FRONTEND + ".localhost:4943";
export const KONG_BACKEND_PRINCIPAL = Principal.fromText(
  process.env.CANISTER_ID_KONG_BACKEND
);

function is_principal_id(principal_id) {
  return /^([a-z0-9]{5}-){10}[a-z0-9]{3}|([a-z0-9]{5}-){4}cai$/.test(
    principal_id
  );
}

let swapSuccessfullSound = new Audio(kongSwapSuccessfullSound);

const SwapComponent = memo(({
  receiveAddress,
  initialPool,
  slippage,
  userDetails,
  changeDrawerContent,
  tokenDetails,
  getUserBalances,
  getLiquidityPoolBalances,
  tokenPrices,
  principal,
  tokenImages,
}) => {
  const { authenticated: backendKingKong } = useKingKongActor();
  const { authenticated: icpLedgerActor } = useIcpActor();
  const { authenticated: ckbtcLedgerActor } = useCkbtcActor();
  const { authenticated: ckethLedgerActor } = useCkethActor();
  const { authenticated: ckusdcLedgerActor } = useCkusdcActor();
  const { authenticated: ckusdtLedgerActor } = useCkusdtActor();
  const { authenticated: NICPLedgerActor } = useNICPActor();
  const { authenticated: wtnLedgerActor } = useWtnActor();
  const { authenticated: yugeLedgerActor } = useYugeActor();
  const { authenticated: chatLedgerActor } = useChatActor();
  const { authenticated: dkpLedgerActor } = useDkpActor();
  const { authenticated: nanasLedgerActor } = useNanasActor();
  const { authenticated: nd64LedgerActor } = useNd64Actor();
  const { authenticated: bitsLedgerActor } = useBitsActor();
  const { authenticated: alpacalbLedgerActor } = useAlpacalbActor();
  const { authenticated: partyLedgerActor } = usePartyActor();
  const { authenticated: sneedLedgerActor } = useSneedActor();
  const { authenticated: clownLedgerActor } = useClownActor();
  const { authenticated: exeLedgerActor } = useExeActor();
  const { authenticated: wumboLedgerActor } = useWumboActor();
  const { authenticated: mcsLedgerActor } = useMcsActor();
  const { authenticated: damonicLedgerActor } = useDamonicActor();
  const { authenticated: bobLedgerActor } = useBobActor();
  const { authenticated: burnLedgerActor } = useBurnActor();
  const { authenticated: ntnLedgerActor } = useNtnActor();
  const { authenticated: dcdLedgerActor } = useDcdActor();
  const { authenticated: gldgovLedgerActor } = useGldgovActor();
  const { authenticated: owlLedgerActor } = useOwlActor();
  const { authenticated: ogyLedgerActor } = useOgyActor();
  const { authenticated: fplLedgerActor } = useFplActor();
  const { authenticated: dittoLedgerActor } = useDittoActor();
  const { authenticated: icvcLedgerActor } = useIcvcActor();

  const initialYouPayToken = initialPool ? initialPool.split("_")[0] : null;
  const initialYouReceiveToken = initialPool ? initialPool.split("_")[1] : null;
  const [youPay, setYouPay] = useState("0");
  const [youPayToken, setYouPayToken] = useState(initialYouPayToken);
  const [youReceive, setYouReceive] = useState("0");
  const [youReceiveToken, setYouReceiveToken] = useState(
    initialYouReceiveToken
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectingPayToken, setIsSelectingPayToken] = useState(true);
  const [transactionStateObject, setTransactionStateObject] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [isSendAndWithdrawFinished, setIsSendAndWithdrawFinished] =
    useState(false);
  // const [isProcressingSwap, setIsProcessingSwap] = useState(false);

  const [isSwapConfirmationModalOpen, setIsSwapConfirmationModalOpen] =
    useState(false);
  const [isSwapSuccessfulModalOpen, setIsSwapSuccessfulModalOpen] =
    useState(false);

  const [isSendConfirmationModalOpen, setIsSendConfirmationModalOpen] =
    useState(false);
  const [isSendSuccessfulModalOpen, setIsSendSuccessfulModalOpen] =
    useState(false);
  const [swapSlippage, setSwapSlippage] = useState(null);
  const [lp_fee_0, setLp_fee_0] = useState(0);
  const [gas_fee_0, setGas_fee_0] = useState(0);
  const [tokenFee, setTokenFee] = useState(undefined);

  const [lp_fee_1, setLp_fee_1] = useState(0);
  const [gas_fee_1, setGas_fee_1] = useState(0);
  const [tokenFee1, setTokenFee1] = useState(undefined);

  const [gasFee, setGasFee] = useState(0);

  const [enableSend, setEnableSend] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [withdrawalInitiated, setWithdrawalInitiated] = useState(false); // New state variable
  const [withdrawalLock, setWithdrawalLock] = useState(false); // New state variable
  const [availableBalanceMax, setAvailableBalanceMax] = useState(undefined);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isFailedModalOpen, setIsFailedModalOpen] = useState(false);
  const [displayYouReceive, setDisplayYouReceive] = useState("0");

  // button error implementation
  const [buttonText, setButtonText] = useState("Swap"); // Default button text
  const [insufficientBalance, setInsufficientBalance] = useState(false); // Insufficient balance error
  const [invalidInput, setInvalidInput] = useState(false); // Invalid or zero input error
  const [isProcessing, setIsProcessing] = useState(false); // Processing state
  const [explorerLinks, setExplorerLinks] = useState(undefined); // Array of explorer links
  const [usdValue, setUsdValue] = useState("0");
  const [price, setPrice] = useState("0");
  const [isProcessingOutput, setIsProcessingOutput] = useState(false);
  const inputProcess = useRef(null);

  const navigate = useNavigate();
  useEffect(() => {
    swapSuccessfullSound = new Audio(kongSwapSuccessfullSound);
  }, []); // Empty dependency array to ensure this runs only once

  const playswapSuccessfullSound = () => {
    swapSuccessfullSound.play();
  };

  useEffect(() => {
    if (initialPool) {
      const [payToken, receiveToken] = initialPool.split("_");
      setYouPayToken(payToken);
      setYouReceiveToken(receiveToken);
    }
  }, [initialPool]);

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

  const getSwapPrice = useCallback(
    async (payAmount, noOutcome) => {
      const { decimals: youPayDecimals, gasFee } =
        getTokenDecimals(youPayToken);
      const { decimals: youReceiveDecimals } =
        getTokenDecimals(youReceiveToken);

      let youPayAmount;
      if (youPayToken && youPayDecimals !== undefined) {
        youPayAmount = new BigNumber(payAmount).multipliedBy(
          new BigNumber(10).pow(youPayDecimals)
        );
      }
      let swap_price_result = await backendKingKong.swap_amounts(
        youPayToken,
        youPayAmount.toNumber(),
        youReceiveToken
      );
      if (payAmount !== inputProcess.current) {
        return;
      }
      if (swap_price_result.Ok) {
        const receiveAmount = new BigNumber(swap_price_result.Ok.receive_amount)
          .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
          .toString();

        if (noOutcome) {
          return {
            receiveAmount,
            payAmount: swap_price_result.Ok.pay_amount,
            youPayDecimals,
          };
        }
        setSwapSlippage(swap_price_result.Ok.slippage);
        const filteredPool =
        youReceiveToken === "ckUSDT"
          ? 1
          : tokenPrices[youReceiveToken + "_ckUSDT"];
      const usdValueFormatted = new BigNumber(receiveAmount)
        .multipliedBy(filteredPool)
        .toFormat(2);
        setUsdValue(usdValueFormatted);
        setYouReceive(receiveAmount);
        setDisplayYouReceive(formatNumber(receiveAmount, 6));
        setPrice(swap_price_result.Ok.price);
        // Update the slippage value in state
        if (swap_price_result.Ok.txs.length === 1) {
          const firstTx = swap_price_result.Ok.txs[0];
          const isDoubleGasFee = icrc1Tokens.includes(youPayToken)
            ? false
            : true;
          setLp_fee_0(
            new BigNumber(firstTx.lp_fee)
              .dividedBy(
                new BigNumber(10).pow(
                  getTokenDecimals(firstTx.receive_symbol).decimals
                )
              )
              .toFormat(8)
          );
          setGas_fee_0(
            new BigNumber(firstTx.gas_fee)
              .dividedBy(
                new BigNumber(10).pow(
                  getTokenDecimals(firstTx.receive_symbol).decimals
                )
              )
              .toFormat(8)
          );
          setTokenFee(firstTx.receive_symbol);
          // set gas fee as gasFee * 2
          if (isDoubleGasFee) {
            setGasFee(
              new BigNumber(gasFee)
                .multipliedBy(2)
                .dividedBy(new BigNumber(10).pow(youPayDecimals))
                .toFormat(8)
            );
          } else {
            setGasFee(
              new BigNumber(gasFee)
                .dividedBy(new BigNumber(10).pow(youPayDecimals))
                .toFormat(8)
            );
          }
          setLp_fee_1(0);
          setGas_fee_1(0);
          setTokenFee1(undefined);
        }
        if (swap_price_result.Ok.txs.length > 1) {
          const firstTx = swap_price_result.Ok.txs[0];
          const isDoubleGasFee = icrc1Tokens.includes(youPayToken)
            ? false
            : true;
          setLp_fee_0(
            new BigNumber(firstTx.lp_fee)
              .dividedBy(
                new BigNumber(10).pow(
                  getTokenDecimals(firstTx.receive_symbol).decimals
                )
              )
              .toFormat(8)
          );
          if (isDoubleGasFee) {
            setGas_fee_0(
              new BigNumber(gasFee)
                .multipliedBy(2)
                .dividedBy(new BigNumber(10).pow(youPayDecimals))
                .toFormat(8)
            );
          } else {
            setGas_fee_0(
              new BigNumber(gasFee)
                .dividedBy(new BigNumber(10).pow(youPayDecimals))
                .toFormat(8)
            );
          }

          setTokenFee(firstTx.receive_symbol);

          const secondTx = swap_price_result.Ok.txs[1];
          setLp_fee_1(
            new BigNumber(secondTx.lp_fee)
              .dividedBy(
                new BigNumber(10).pow(
                  getTokenDecimals(secondTx.receive_symbol).decimals
                )
              )
              .toFormat(8)
          );
          setGas_fee_1(
            new BigNumber(secondTx.gas_fee)
              .dividedBy(
                new BigNumber(10).pow(
                  getTokenDecimals(secondTx.receive_symbol).decimals
                )
              )
              .toFormat(8)
          );
          setTokenFee1(secondTx.receive_symbol);
          setGasFee(0);
        }
        setIsProcessingOutput(false);
        return {
          receiveAmount,
          payAmount: swap_price_result.Ok.pay_amount,
          youPayDecimals,
        };
      } else if (swap_price_result.Err) {
        console.log("swap price error", swap_price_result.Err);
        setIsProcessingOutput(false);
        toast(swap_price_result.Err);
        return {
          receiveAmount: "0",
          payAmount: "0",
          youPayDecimals,
        };
      }
      setIsProcessingOutput(false);
      return null;
    },
    [youPayToken, youReceiveToken, backendKingKong, getTokenDecimals, slippage]
  );

  const debouncedGetSwapPrice = useCallback(
    debounce(async (payAmount) => {
      await getSwapPrice(payAmount);
    }, 500), // 100ms delay
    [getSwapPrice]
  );

  // const updatePriceAndSlippage = useCallback(
  //   async (payAmount) => {
  //     const { receiveAmount } = await getSwapPrice(payAmount, true);
  //     const filteredPool =
  //       youReceiveToken === "ckUSDT"
  //         ? 1
  //         : tokenPrices[youReceiveToken + "_ckUSDT"];
  //     const usdValueFormatted = new BigNumber(receiveAmount)
  //       .multipliedBy(filteredPool)
  //       .toFormat(2);
  //     setUsdValue(usdValueFormatted);
  //   },
  //   [getSwapPrice, tokenPrices, youReceiveToken]
  // );

  const approvePayToken = useCallback(
    async (pay_amount, gas_amount, ledger_auth) => {
      try {
        let expires_at = Date.now() * 1000000 + 60000000000; // 30 seconds from now in nanoseconds

        // Convert pay_amount and gas_amount to BigInt
        const payAmountBigInt = BigInt(pay_amount);
        const gasAmountBigInt = BigInt(gas_amount);
  
        // Perform addition using BigInt
        const totalAmountBigInt = payAmountBigInt + gasAmountBigInt;
  
        let approve_args = {
          fee: [],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
          amount: totalAmountBigInt,
          expected_allowance: [],
          expires_at: [expires_at],
          spender: { owner: KONG_BACKEND_PRINCIPAL, subaccount: [] },
        };
        let approve_result = await ledger_auth.icrc2_approve(approve_args);
        console.log("approve result", approve_result);
        if (approve_result.hasOwnProperty("Err")) {
          toast(approve_result.Err);
          return false;
        }
        return approve_result.Ok;

      } catch (error) {
        toast(error);
        setIsProcessing(false);
        setIsSwapConfirmationModalOpen(false);
        setRequestId(null);
        return false;
      }
    },
    [backendKingKong]
  );

  const transferPayToken = useCallback(
    async (pay_amount, ledger_auth) => {
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
        console.log("transfer result", transfer_result);
        if (transfer_result.hasOwnProperty("Err")) {
          toast(transfer_result.Err);
          return false;
        }
        return transfer_result.Ok;
      } catch (error) {
        toast(error);
        setIsProcessing(false);
        setIsSwapConfirmationModalOpen(false);
        setRequestId(null);
        return false;
      }
    },
    [backendKingKong]
  );

  const swap = useCallback(
    async (
      pay_token,
      pay_amount,
      receive_token,
      receive_amount,
      receive_address = null,
      max_slippage = null,
      approve_block_id = null,
      isTransfer = false
    ) => {
      let swap_args = null;

      if (isTransfer) {
        swap_args = {
          pay_token: pay_token,
          pay_amount: pay_amount,
          receive_token: receive_token,
          receive_amount: [receive_amount],
          receive_address: [],
          max_slippage: [parseFloat(slippage)],
          pay_tx_id: approve_block_id ? [{ BlockIndex: approve_block_id }] : [],
          referred_by: [],
        };
      } else {
        swap_args = {
          pay_token: pay_token,
          pay_amount: pay_amount,
          receive_token: receive_token,
          receive_amount: [receive_amount],
          receive_address:
            receive_address === null || receive_address === ""
              ? []
              : [receive_address],
          max_slippage: [parseFloat(slippage)],
          pay_tx_id: [],
          referred_by: [],
        };
      }
      if (enableSend) {
        backendKingKong
          .swap_async(swap_args)
          .then(async (result) => {
            if (result.hasOwnProperty("Err")) {
              setIsProcessing(false);
              // setIsProcessingSwap(false);
              setIsSendConfirmationModalOpen(false);
              toast(result.Err);
              return false;
            } else {
              setRequestId(result.Ok);
            }
          })
          .catch((err) => {
            setIsProcessing(false);
            // setIsProcessingSwap(false);
            setIsSendConfirmationModalOpen(false);
            toast(err);
            return false;
          });
      } else {
        backendKingKong
          .swap_async(swap_args)
          .then((result) => {
            // setIsProcessingSwap(true);
            if (result.hasOwnProperty("Err")) {
              setIsProcessing(false);
              // setIsProcessingSwap(false);
              setIsSwapConfirmationModalOpen(false);
              toast(result.Err);
              console.log("error", result.Err);
              return false;
            } else {
              setRequestId(result.Ok);
            }
          })
          .catch((err) => {
            console.log("error", err);
            setIsProcessing(false);
            // setIsProcessingSwap(false);
            setIsSwapConfirmationModalOpen(false);
            toast(err);
            return false;
          });
      }
    },
    [
      backendKingKong,
      slippage,
      setIsProcessing,
      toast,
      sendTo,
      youReceiveToken,
      enableSend,
    ]
  );

  const clearInputs = useCallback(() => {
    setYouPay("");
    setYouReceive("0");
    setDisplayYouReceive("0");
    setSwapSlippage(null);
    setPrice("0");
    setUsdValue("0");
    setLp_fee_0(0);
    setGas_fee_0(0);
    setTokenFee(undefined);
    setLp_fee_1(0);
    setGas_fee_1(0);
    setTokenFee1(undefined);
    setSendTo("");
    setRequestId(null);
    setTransactionStateObject(null);
    setIsModalOpen(false);
  }, []);

  const onSwap = useCallback(async () => {
    setIsProcessing(true);
    // let approve_block_id = null;
    const { receiveAmount: currentYouReceive, payAmount } = await getSwapPrice(
      youPay
    );
    const { decimals: youPayDecimals, gasFee } = getTokenDecimals(youPayToken); // Replace tokenSymbol with the relevant symbol
    const { decimals: youReceiveDecimals } = getTokenDecimals(youReceiveToken);
    const receive_amount = new BigNumber(currentYouReceive)
      .multipliedBy(new BigNumber(10).pow(youReceiveDecimals))
      .toNumber();

      const selectBackend = (token) => {
        switch (token) {
          case "ICP":
            return icpLedgerActor;
          case "ckBTC":
            return ckbtcLedgerActor;
          case "ckETH":
            return ckethLedgerActor;
          case "ckUSDC":
            return ckusdcLedgerActor;
          case "ckUSDT":
            return ckusdtLedgerActor;
          case "DKP":
            return dkpLedgerActor;
          case "Bits":
            return bitsLedgerActor;
          case "CHAT":
            return chatLedgerActor;
          case "nanas":
            return nanasLedgerActor;
          case "ND64":
            return nd64LedgerActor;
          case "WTN":
            return wtnLedgerActor;
          case "YUGE":
            return yugeLedgerActor;
          case "nICP":
            return NICPLedgerActor;
          case "ALPACALB":
            return alpacalbLedgerActor;
          case "PARTY":
            return partyLedgerActor;
          case "SNEED":
            return sneedLedgerActor;
          case "CLOWN":
            return clownLedgerActor;
          case "DAMONIC":
            return damonicLedgerActor;
          case "EXE":
            return exeLedgerActor;
          case "WUMBO":
            return wumboLedgerActor;
          case "MCS":
            return mcsLedgerActor;
          case "BOB":
            return bobLedgerActor;
          case "BURN":
            return burnLedgerActor;
          case "NTN":
            return ntnLedgerActor;
          case "DCD":
            return dcdLedgerActor;
          case "GLDGov":
            return gldgovLedgerActor;
          case "OWL":
            return owlLedgerActor;
          case "OGY":
            return ogyLedgerActor;
          case "FPL":
            return fplLedgerActor;
          case "DITTO":
            return dittoLedgerActor;
          case "ICVC":
            return icvcLedgerActor;
          default:
            return null;
        }
      };

    let approve_block_id = null;
    let transfer_block_id = null;

    if (icrc1Tokens.includes(youPayToken)) {
      transfer_block_id = await transferPayToken(
        payAmount,
        selectBackend(youPayToken)
      );
    } else {
      approve_block_id = await approvePayToken(
        payAmount,
        gasFee,
        selectBackend(youPayToken)
      );
    }

    if (!approve_block_id && !transfer_block_id) {
      setIsProcessing(false);
      return;
    }

    if (
      !(await swap(
        youPayToken,
        payAmount,
        youReceiveToken,
        receive_amount,
        receiveAddress,
        slippage,
        approve_block_id ? approve_block_id : transfer_block_id,
        !!transfer_block_id
      ))
    ) {
      return;
    }
  }, [
    youPay,
    youPayToken,
    youReceive,
    youReceiveToken,
    slippage,
    receiveAddress,
    getSwapPrice,
    approvePayToken,
    backendKingKong,
    sendTo,
    getTokenDecimals,
    icpLedgerActor,
    ckbtcLedgerActor,
    ckethLedgerActor,
    ckusdcLedgerActor,
    ckusdtLedgerActor,
    dkpLedgerActor,
    bitsLedgerActor,
    chatLedgerActor,
    nanasLedgerActor,
    nd64LedgerActor,
    wtnLedgerActor,
    yugeLedgerActor,
    NICPLedgerActor,
    alpacalbLedgerActor,
    partyLedgerActor,
    sneedLedgerActor,
    clownLedgerActor,
    exeLedgerActor,
    wumboLedgerActor,
    mcsLedgerActor,
    damonicLedgerActor,
    bobLedgerActor,
    burnLedgerActor,
    ntnLedgerActor,
    dcdLedgerActor,
    gldgovLedgerActor,
    owlLedgerActor,
    ogyLedgerActor,
    fplLedgerActor,
    dittoLedgerActor,
    icvcLedgerActor,
  ]);

  const sanitizeInput = useCallback((input) => {
    // Prefix leading dot with a zero
    let sanitizedInput = input.replace(/^\./, "0.");

    // Remove leading zeros unless followed by a dot
    sanitizedInput = sanitizedInput.replace(/^0+(?!\.|$)/, "");

    // Allow only one dot and remove non-numeric characters except dot
    sanitizedInput = sanitizedInput.replace(/[^0-9.]/g, "");

    // Allow only one dot in the input
    sanitizedInput = sanitizedInput.replace(/(\..*?)\..*/g, "$1");

    const purified = DOMPurify.sanitize(sanitizedInput);

    return purified;
  }, []);

  const onWithdraw = useCallback(
    async (amount, address, clearInterval) => {
      setIsProcessing(true);
      // let withdraw_amount;
      let withdraw_block_id = null;

      // const youReceiveDecimals = getTokenDecimals(youReceiveToken);
      // const withdraw_amount = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(youReceiveDecimals)).toNumber();

      // if (youReceiveToken === "ICP") {
      //   withdraw_amount = new BigNumber(amount)
      //     .multipliedBy(icp_ledger_getDecimal)
      //     .toNumber();
      //   withdraw_block_id = await withdraw_principal_id(
      //     withdraw_amount,
      //     address,
      //     icp_ledger_backend
      //   );
      // } else if (youReceiveToken === "ckBTC") {
      //   withdraw_amount = new BigNumber(amount)
      //     .multipliedBy(ckbtc_ledger_getDecimal)
      //     .toNumber();
      //   withdraw_block_id = await withdraw_principal_id(
      //     withdraw_amount,
      //     address,
      //     ckbtc_ledger_backend
      //   );
      // } else if (youReceiveToken === "ckETH") {
      //   withdraw_amount = new BigNumber(amount)
      //     .multipliedBy(cketh_ledger_getDecimal)
      //     .toNumber();
      //   withdraw_block_id = await withdraw_principal_id(
      //     withdraw_amount,
      //     address,
      //     cketh_ledger_backend
      //   );
      //   // } else if (youReceiveToken === "KONG") {
      //   //   withdraw_amount = new BigNumber(amount)
      //   //     .multipliedBy(kong_ledger_getDecimal)
      //   //     .toNumber();
      //   //   withdraw_block_id = await withdraw_principal_id(
      //   //     withdraw_amount,
      //   //     address,
      //   //     kong_ledger_backend
      //   //   );
      // } else if (youReceiveToken === "ckUSDC") {
      //   withdraw_amount = new BigNumber(amount)
      //     .multipliedBy(ckusdc_ledger_getDecimal)
      //     .toNumber();
      //   withdraw_block_id = await withdraw_principal_id(
      //     withdraw_amount,
      //     address,
      //     ckusdc_ledger_backend
      //   );
      // } else if (youReceiveToken === "ckUSDT") {
      //   withdraw_amount = new BigNumber(amount)
      //     .multipliedBy(ckusdt_ledger_getDecimal)
      //     .toNumber();
      //   withdraw_block_id = await withdraw_principal_id(
      //     withdraw_amount,
      //     address,
      //     ckusdt_ledger_backend
      //   );
      // }

      // if (withdraw_block_id) {
      //   setIsSendConfirmationModalOpen(false);
      //   setIsSendSuccessfulModalOpen(true);
      //   toast("Send successful");
      //   setYouPay("0");
      //   setReceivingAddress("");
      // } else {
      //   toast("Send failed");
      // }

      setIsProcessing(false);
    },
    [youReceiveToken, sendTo]
  );

  const withdraw_principal_id = useCallback(
    async (withdraw_amount, withdraw_address, ledger_auth) => {
      if (!is_principal_id(withdraw_address)) {
        console.log("Invalid principal id");
        setIsProcessing(false);
        // setIsProcessingSwap(false);
        setWithdrawalInitiated(false);
        return false;
      }
      const transfer_args = {
        to: { owner: Principal.fromText(withdraw_address), subaccount: [] },
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: withdraw_amount,
      };
      ledger_auth
        .icrc1_transfer(transfer_args)
        .then((result) => {
          if (result.Ok) {
            setIsSendAndWithdrawFinished(true);
            setIsSendConfirmationModalOpen(false);
            setIsProcessing(false);
            setIsSendSuccessfulModalOpen(true);
            setRequestId(null);
            setTransactionStateObject(null);
            setWithdrawalInitiated(false);
            setWithdrawalLock(false);
            return true;
          } else {
            return false;
          }
        })
        .catch((err) => {
          console.log("error", err);
          setIsProcessing(false);
          // setIsProcessingSwap(false);
          setIsSendConfirmationModalOpen(false);
          toast("Send failed", err);
          setRequestId(null);
          setWithdrawalInitiated(false);
          setTransactionStateObject(null);
          setWithdrawalLock(false);
          return false;
        })
        .finally(() => {
          setIsProcessing(false);
          // setIsProcessingSwap(false);
          setIsSendConfirmationModalOpen(false);
          return;
        });
    },
    []
  );

  const handleInputChange = useCallback(
    (inputValue) => {
      const sanitizedValue = sanitizeInput(inputValue);
      inputProcess.current = sanitizedValue;
      // Check if the input is zero or invalid (like 0, 0.00, etc.)
      setIsProcessingOutput(true);
      if (
        sanitizedValue === "" || // Empty input
        sanitizedValue === "0" || // Plain zero
        /^0+(\.0+)?$/.test(sanitizedValue) // Matches 0.0, 0.00, etc.
      ) {
        setYouPay(sanitizedValue);
        setYouReceive("0");
        setDisplayYouReceive("0");
        setIsProcessingOutput(false);
        return; // Prevent unnecessary API calls
      }

      setYouPay(sanitizedValue);
      debouncedGetSwapPrice(sanitizedValue);
    },
    [sanitizeInput, debouncedGetSwapPrice]
  );

  const handleChangePayReceive = () => {
    const currentYouPay = youPayToken;
    const currentYouReceive = youReceiveToken;

    // Swap the tokens
    setYouPayToken(currentYouReceive);
    setYouReceiveToken(currentYouPay);

    navigate(`/?viewtab=swap&pool=${currentYouReceive}_${currentYouPay}`, {
      replace: true,
    });
    setIsModalOpen(false);

  };

  const handleTokenChange = (token) => {
    const newPayToken = isSelectingPayToken ? token : youPayToken;
    const newReceiveToken = !isSelectingPayToken ? token : youReceiveToken;

    if (newPayToken === newReceiveToken) {
      handleChangePayReceive();
      return;
    }

    setYouPayToken(newPayToken);
    setYouReceiveToken(newReceiveToken);
    navigate(`/?viewtab=swap&pool=${newPayToken}_${newReceiveToken}`, {
      replace: true,
    });
    setIsModalOpen(false);
  };

  const toggleSwapAndSend = () => {
    setEnableSend(!enableSend);
  };

  const setReceivingAddress = (address) => {
    setSendTo(address);
  };

  const closeSuccessfullModal = () => {
    setIsSwapSuccessfulModalOpen(false);
    setIsSendSuccessfulModalOpen(false);
    clearInputs();
  };

  const closeFailedModal = () => {
    setIsFailedModalOpen(false);
    setTransactionStateObject(null);
    clearInputs();
  };

  const triggerWithdrawal = async () => {
    if (withdrawalInitiated) {
      return;
    }
    setWithdrawalInitiated(true);
    await onWithdraw(youReceive, sendTo);
  };

  const handleMaxClick = () => {
    handleInputChange(availableBalanceMax);
  };

  useEffect(() => {
    const getSwapPriceInitial = async () => {
      if (!backendKingKong || !youPayToken || !userDetails) return null;

      // Get user balance and decimals
      const userBalanceRaw =
        userDetails[tokenBalancesSelector[youPayToken]] || "0";

      // Remove commas from the user balance string

      const userBalanceSanitized = userBalanceRaw.replace(/,/g, "");
      const userBalance = new BigNumber(userBalanceSanitized);
      const { decimals: youPayDecimals, gasFee } =
        getTokenDecimals(youPayToken);

      // Transform user balance to the required precision
      const transformedPayAmount = userBalance.multipliedBy(
        new BigNumber(10).pow(youPayDecimals)
      );

      const gasCost = icrc1Tokens.includes(youPayToken)
        ? new BigNumber(gasFee)
        : new BigNumber(gasFee).multipliedBy(2);
      // Deduct the gas fee from the transformed amount
      const availableAmountAfterFee = transformedPayAmount.minus(gasCost);

      // Convert back to the normal decimal representation for display
      const availableBalanceMax = availableAmountAfterFee
        .dividedBy(new BigNumber(10).pow(youPayDecimals))
        .toString();
      const availableMaxDisplay = priceRoundedAmount(
        tokenPrices[youPayToken + "_ckUSDT"],
        availableBalanceMax
      );

      if (userBalance.isZero() || availableAmountAfterFee.isNegative()) {
        setAvailableBalanceMax("0.0000");
      } else {
        setAvailableBalanceMax(
          availableMaxDisplay < 0 || !availableMaxDisplay
            ? "0.0000"
            : availableMaxDisplay
        );
      }
    };

    getSwapPriceInitial();
  }, [
    userDetails,
    youPayToken,
    backendKingKong,
    getTokenDecimals,
    tokenPrices,
  ]);

  useEffect(() => {
    if (requestId && !withdrawalLock) {
      const intervalId = setInterval(async () => {
        try {
          const requestObj = await backendKingKong.requests([requestId]);
          const requestReply = requestObj.Ok[0].reply;
          setTransactionStateObject(requestObj);
          if (requestReply && requestReply.Pending === null) {
            return;
          } else if (
            requestReply &&
            requestReply.Swap &&
            requestReply.Swap.status &&
            requestReply.Swap.status === "Success" &&
            !withdrawalLock
          ) {
            const claimIds = requestReply.Swap.claim_ids;
            const transfers = requestReply.Swap.transfer_ids;
            const explorerLinks = getExplorerLinks(transfers);
            setExplorerLinks(explorerLinks);
            const { decimals: youReceiveDecimals } =
              getTokenDecimals(youReceiveToken);
            const formattedReceiveAmount = new BigNumber(
              requestObj.Ok[0].reply.Swap.receive_amount
            )
              .dividedBy(new BigNumber(10).pow(youReceiveDecimals))
              .toString();
            setYouReceive(formattedReceiveAmount);
            setDisplayYouReceive(formatNumber(formattedReceiveAmount, 6));
            getUserBalances();
            getLiquidityPoolBalances();
            playswapSuccessfullSound();
            if (enableSend) {
              clearInterval(intervalId);
              setRequestId(null);
              setWithdrawalLock(true); // Set the lock before calling the withdrawal
              await triggerWithdrawal();
            } else {
              setIsProcessing(false);
              setHasClaimed(claimIds.length > 0);
              setIsSwapConfirmationModalOpen(false);
              setIsSwapSuccessfulModalOpen(true);
              setRequestId(null); // Stop polling
              clearInterval(intervalId); // Clear interval
            }
          } else if (
            requestReply &&
            requestReply.Swap &&
            requestReply.Swap.status &&
            requestReply.Swap.status === "Failed"
          ) {
            const claimIds = requestReply.Swap.claim_ids;
            setHasClaimed(claimIds.length > 0);
            clearInterval(intervalId);
            setRequestId(null);
            // setTransactionStateObject(null);
            setIsProcessing(false);
            setIsSwapConfirmationModalOpen(false);
            setIsFailedModalOpen(true);
            toast("Swap failed");
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
    enableSend,
    sendTo,
    withdrawalLock,
    tokenPrices,
  ]);

  useEffect(() => {
    const isInvalidInput = Number(youPay) <= 0 || isNaN(Number(youPay));
    const isInsufficientBalance = Number(youPay) > Number(availableBalanceMax);
    const isSlippageExceeded = swapSlippage > slippage;

    if (isInvalidInput) {
      setButtonText("Enter Amount");
      setInvalidInput(true);
      setInsufficientBalance(false);
    } else if (isInsufficientBalance) {
      setButtonText("Insufficient Balance");
      setInvalidInput(false);
      setInsufficientBalance(true);
    } else if (isSlippageExceeded) {
      setButtonText(`Slippage ${swapSlippage}% exceeds set limit ${slippage}%`);
      setInvalidInput(true);
      setInsufficientBalance(false);
    } else {
      setButtonText("Swap");
      setInvalidInput(false);
      setInsufficientBalance(false);
    }
  }, [youPay, availableBalanceMax, slippage, swapSlippage]);

  useEffect(() => {
    if (
      youPay &&
      new BigNumber(youPay).isGreaterThan(0) &&
      youPayToken &&
      youReceiveToken
    ) {
      getSwapPrice(youPay);
    }
  }, [youPayToken, youReceiveToken]);

  const isButtonDisabled = useMemo(() => {
    return (
      invalidInput ||
      insufficientBalance ||
      isSwapConfirmationModalOpen ||
      !principal ||
      Number(youPay) === 0 ||
      isProcessing
    );
  }, [invalidInput, insufficientBalance, youPay, isProcessing, principal, isSwapConfirmationModalOpen]);

  const handleClaim = () => {
    closeSuccessfullModal();
  };

  const openBlockLink = (block_id, principal_id) => {
    const url = `https://dashboard.internetcomputer.org/sns/${principal_id}/transaction/${block_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const youPayBigNumber = new BigNumber(youPay);
    const youReceiveBigNumber = new BigNumber(youReceive);
    if ((youPayBigNumber.isZero() || youPayBigNumber.isNaN() || !youPay) && !youReceiveBigNumber.isZero()) {
      setYouPay(null);
      setYouReceive("0");
      setDisplayYouReceive("0");
    }
  }, [youPay, youReceive]);

  return (
    <>
      <div className="panel-green-main panel-green-main--swapinput">
        <div className="panel-green-main__tl"></div>
        <div className="panel-green-main__tm"></div>
        <div className="panel-green-main__tr"></div>

        <div className="panel-green-main__ml"></div>
        <div className="panel-green-main__mr"></div>

        <div className="panel-green-main__bl"></div>
        <div className="panel-green-main__bm"></div>
        <div className="panel-green-main__br"></div>

        <div className="panel-green-main__content">
          <div className="swap-container swap-container--you-pay">
            <h4 className="swap-container-label">You Pay</h4>
            <div className="swap-container-items">
              <div className="swap-container-left">
                <div className="swap-container-inputholder"></div>
              </div>
              <div className="swap-container-right">
                <span
                  onClick={() => {
                    setIsSelectingPayToken(true);
                    setIsModalOpen(true);
                  }}
                  className="buttonmed-yellow buttonmed-yellow--customselect2 buttonmed-yellow--youpay"
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
                    class="buttonmed-yellow__icon"
                  />
                  <span className="buttonmed-yellow__text">{youPayToken}</span>
                  <svg
                    class="custom-select-2-arrow"
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g clip-path="url(#clip0_75_306)">
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
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
                <div className="swap-under-select">
                  <span className="swap-container-selectedtoken-value">
                    Avail: {availableBalanceMax}
                  </span>
                  <span
                    onClick={() => handleMaxClick(youPayToken)}
                    className="swap-container-max"
                  >
                    MAX
                  </span>
                </div>
              </div>
            </div>
            <input
              onChange={(e) => handleInputChange(e.target.value)}
              type="text"
              className="swap-container-input"
              // disabled={isProcessingOutput}
              value={youPay}
            />
          </div>
        </div>
      </div>
      <div className="icon-container">
        <svg
          onClick={handleChangePayReceive}
          className="swap-icon-separator"
          width="35"
          height="42"
          viewBox="0 0 35 42"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0.5 26.8824V27.3824H1H2.85294V29.2353V29.7353H3.35294H5.20588V31.5882V32.0882H5.70588H7.55882V33.9412V34.4412H8.05882H9.91177V36.2941V36.7941H10.4118H12.2647V38.6471V39.1471H12.7647H14.6176V41V41.5H15.1176H19.8235H20.3235V41V39.1471H22.1765H22.6765V38.6471V36.7941H24.5294H25.0294V36.2941V34.4412H26.8824H27.3824V33.9412V32.0882H29.2353H29.7353V31.5882V29.7353H31.5882H32.0882V29.2353V27.3824H33.9412H34.4412V26.8824V24.5294V24.0294H33.9412H25.0294V3.35294V2.85294H24.5294H22.6765V1V0.5H22.1765H12.7647H12.2647V1V2.85294H10.4118H9.91177V3.35294V24.0294H1H0.5V24.5294V26.8824Z"
            stroke="black"
          />
        </svg>
      </div>
      <div className="panel-green-main panel-green-main--swapinput">
        <div className="panel-green-main__tl"></div>
        <div className="panel-green-main__tm"></div>
        <div className="panel-green-main__tr"></div>

        <div className="panel-green-main__ml"></div>
        <div className="panel-green-main__mr"></div>

        <div className="panel-green-main__bl"></div>
        <div className="panel-green-main__bm"></div>
        <div className="panel-green-main__br"></div>

        <div className="panel-green-main__content">
          <div className="swap-container swap-container--you-receive">
            <h4 className="swap-container-label">You Receive</h4>
            <div className="swap-container-items">
              <div className="swap-container-left">
                <div className="swap-container-inputholder"></div>
                {(youPay && youPay !== "0" && youPay !== "0.00") && (
                  <span className="swap-container-inputholder-value">
                    {
                      isProcessingOutput ? (
                        <Skeleton variant="text" width="50%" height="2.5rem" animation="wave" />
                      ) : (
                        <>
                                                <span className="tilda-symbol">~</span>${usdValue}{" "}
                        (Slippage: {swapSlippage}
                        <span className="percentage-symbol">%</span>)
                        </>
                      )
                    }
                  </span>
                )}
                {/* <span className="swap-container-inputholder-value"></span> */}
                {/* <span className="swap-container-inputholder-value">$198,605.00</span> */}
              </div>
              <div className="swap-container-right">
                <span
                  onClick={() => {
                    setIsSelectingPayToken(false);
                    setIsModalOpen(true);
                  }}
                  className="buttonmed-yellow buttonmed-yellow--customselect2 buttonmed-yellow--youreceive"
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
                    src={tokenImages[youReceiveToken]}
                    class="buttonmed-yellow__icon"
                  />
                  <span className="buttonmed-yellow__text">
                    {youReceiveToken}
                  </span>
                  <svg
                    class="custom-select-2-arrow"
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g clip-path="url(#clip0_75_306)">
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
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
                <div className="swap-under-select">
                  <span className="swap-container-selectedtoken-value">
                    Avail:{" "}
                    {priceRoundedAmount(
                      tokenPrices[youReceiveToken + "_ckUSDT"],
                      userDetails[tokenBalancesSelector[youReceiveToken]]
                    )}
                  </span>
                  <span className="swap-container-max"></span>
                </div>
              </div>
            </div>
            {isProcessingOutput ? (
              <div className="swap-container-input-skeleton">
                <Skeleton variant="text" width="70%" height="5rem" animation="wave" />
              </div>
            ) : (
              <input
                type="text"
                className="swap-container-input"
                disabled
                value={displayYouReceive}
              />
            )}
          </div>
        </div>
      </div>
      {/* {enableSend && (
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
            <div className="address-inputcontainer">
              <span className="sending-label">Send To:</span>
              <input
                onChange={(e) => setReceivingAddress(e.target.value)}
                className="address-input"
                type="text"
                value={sendTo}
              />
            </div>
          </div>
        </div>
      )} */}
      <div className="swap-button-container">
        <button
          disabled={isButtonDisabled}
          onClick={() => {
            if (!isButtonDisabled) {
              setIsSwapConfirmationModalOpen(true);
            }
          }}
          type="button"
          className={`buttonbig-yellow buttonbig-yellow--asbutton buttonbig-yellow--swap ${
            isButtonDisabled ? "buttonbig-yellow--disabled" : ""
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
      {/* <div className="new-action-container">
        <span
          onClick={() => toggleSwapAndSend()}
          className="button-yellow button-yellow--swam-and-send"
        >
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
            {enableSend ? "Swap" : "Swap & Send"}
          </span>
        </span>
      </div> */}
      {isProcessing ? (
        <Modal
          isOpen={isProcessing}
          onClose={() => setIsProcessing(false)}
          headTitle={sendTo ? "Swap & Send Submitted" : "Swap Submitted"}
        >
          <TransactionProgressComponent
            transaction={
              transactionStateObject &&
              transactionStateObject.Ok &&
              transactionStateObject
            }
            typeOfTransaction={sendTo ? "swapWithdraw" : "swap"}
            initialState={"Approve"}
            isSendAndWithdrawFinished={isSendAndWithdrawFinished}
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
      ) : isSwapConfirmationModalOpen ? (
        <Modal
          isOpen={isSwapConfirmationModalOpen}
          onClose={() => setIsSwapConfirmationModalOpen(false)}
          headTitle={"Review Swap"}
        >
          <div className="review-main">
            <div className="review-main-item">
              <span className="review-label">You Pay</span>
              <span className="review-value-wrap">
                <span className="review-value">
                  {youPay}
                  <span className="review-value-currency">{youPayToken}</span>
                </span>
                <img src={tokenImages[youPayToken]} className="review-token" />
              </span>
            </div>
            <div className="review-main-item">
              <span className="review-label">You Receive</span>
              <span className="review-value-wrap">
                <span className="review-value">
                  {displayYouReceive}
                  <span className="review-value-currency">
                    {youReceiveToken}
                  </span>
                </span>
                <img
                  src={tokenImages[youReceiveToken]}
                  className="review-token"
                />
              </span>
            </div>
          </div>
          <div className="review-fees">
            <div className="review-fees-head">
              <h3 className="review-fees-headtitle">Fees & Charges</h3>
            </div>
            {gasFee > 0 && (
              <div className="review-fees-item">
                <span className="review-fees-item-label">
                  Gas fee (approval)
                </span>
                <span className="review-fees-item-value">
                  {gasFee} {youPayToken}
                </span>
              </div>
            )}
            {lp_fee_0 > 0 && (
              <>
                {lp_fee_1 > 0 ? (
                  <>
                    <div className="review-fees-item">
                      <span className="review-fees-item-label">
                        Gas fee (1st trade)
                      </span>
                      <span className="review-fees-item-value">
                        {gas_fee_0} {youPayToken}
                      </span>
                    </div>
                    <div className="review-fees-item">
                      <span className="review-fees-item-label">
                        Liquidity Pools fee (1st trade)
                      </span>
                      <span className="review-fees-item-value">
                        {lp_fee_0} {tokenFee}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="review-fees-item">
                      <span className="review-fees-item-label">
                        Liquidity Pools fee (1st trade)
                      </span>
                      <span className="review-fees-item-value">
                        {lp_fee_0} {tokenFee}
                      </span>
                    </div>
                    <div className="review-fees-item">
                      <span className="review-fees-item-label">
                        Gas fee (1st trade)
                      </span>
                      <span className="review-fees-item-value">
                        {gas_fee_0} {tokenFee}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            {lp_fee_1 > 0 && (
              <>
                <div className="review-fees-item">
                  <span className="review-fees-item-label">
                    Liquidity Pools fee (2nd trade)
                  </span>
                  <span className="review-fees-item-value">
                    {lp_fee_1} {tokenFee1}
                  </span>
                </div>
                <div className="review-fees-item">
                  <span className="review-fees-item-label">
                    Gas fee (2nd trade)
                  </span>
                  <span className="review-fees-item-value">
                    {gas_fee_1} {tokenFee1}
                  </span>
                </div>
              </>
            )}
          </div>

          <span
            onClick={onSwap}
            class="buttonbig-yellow buttonbig-yellow--confirmation"
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
            <span className="buttonbig-yellow__text">Confirm Swap</span>
          </span>
        </Modal>
      ) : isSwapSuccessfulModalOpen ? (
        <Modal
          isOpen={isSwapSuccessfulModalOpen}
          onClose={closeSuccessfullModal}
          headTitle={"Review Swap"}
          customHead={
            <div class="modal-head">
              <div onClick={closeSuccessfullModal} class="modal-close">
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
            <img src={confirmationImageSwap} class="modal-top-pic" />
          </div>
          <div class="modal-title-status">Swap Successful</div>
          <div className="modal-view-on-explorer">
            {hasClaimed ? (
              <div className="view-on-explorer-button">
                <span onClick={handleClaim} className="view-on-explorer-text">
                  Swap done, but an issue occurred on the final step. Please
                  claim your tokens here.
                </span>
              </div>
            ) : (
              // Check if explorerLinks is not empty and has keys
              explorerLinks &&
              explorerLinks.length > 0 &&
              explorerLinks.map((linkObject, idx) => {
                const [symbol, link] = Object.entries(linkObject)[0];
                return (
                  <a
                    key={`${symbol}-${idx}`}
                    className="view-on-explorer-button"
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="view-on-explorer-text">
                      View {symbol} Transaction
                    </span>
                    <FiExternalLink
                      size={16}
                      className="external-icon"
                      style={{ marginLeft: "8px" }}
                    />
                  </a>
                );
              })
            )}
          </div>
          <div class="modal-confirmation-summary">
            <div class="summary-row">
              <div class="summary-label">You traded</div>
              <div class="summary-value">
                <span class="summary-value-number">{youPay}</span>
                <span class="summary-value-small">{youPayToken}</span>
              </div>
            </div>
            <div class="summary-row">
              <div class="summary-label">For a Total Of:</div>
              <div class="summary-value">
                <span class="summary-value-number">{displayYouReceive}</span>
                <span class="summary-value-small">{youReceiveToken}</span>
              </div>
            </div>
          </div>
        </Modal>
      ) : isSendConfirmationModalOpen ? (
        <Modal
          isOpen={isSendConfirmationModalOpen}
          onClose={() => setIsSendConfirmationModalOpen(false)}
          headTitle={"Review Swap & Send"}
        >
          <div className="review-main">
            <div className="review-main-item">
              <span className="review-label">You Pay</span>
              <span className="review-value-wrap">
                <span className="review-value">
                  {youPay}
                  <span className="review-value-currency">{youPayToken}</span>
                </span>
                <img src={tokenImages[youPayToken]} className="review-token" />
              </span>
            </div>
            <div className="review-main-item">
              <span className="review-label">You Receive</span>
              <span className="review-value-wrap">
                <span className="review-value">
                  {displayYouReceive}
                  <span className="review-value-currency">
                    {youReceiveToken}
                  </span>
                </span>
                <img
                  src={tokenImages[youReceiveToken]}
                  className="review-token"
                />
              </span>
            </div>
            <div className="review-main-item">
              <span className="review-label">Send to Address:</span>
              <span className="review-value-wrap">
                <span className="review-value">{sendTo}</span>
              </span>
            </div>
          </div>
          <div className="review-fees">
            <div className="review-fees-head">
              <h3 className="review-fees-headtitle">Fees & Charges</h3>
            </div>
            {lp_fee_0 > 0 && (
              <>
                <div className="review-fees-item">
                  <span className="review-fees-item-label">
                    Liquidity Pools fee (1st trade)
                  </span>
                  <span className="review-fees-item-value">
                    {lp_fee_0} {tokenFee}
                  </span>
                </div>
                <div className="review-fees-item">
                  <span className="review-fees-item-label">
                    Gas fee (1st trade)
                  </span>
                  <span className="review-fees-item-value">
                    {gas_fee_0} {tokenFee}
                  </span>
                </div>
              </>
            )}
            {lp_fee_1 > 0 && (
              <>
                <div className="review-fees-item">
                  <span className="review-fees-item-label">
                    Liquidity Pools fee (2nd trade)
                  </span>
                  <span className="review-fees-item-value">
                    {lp_fee_1} {tokenFee1}
                  </span>
                </div>
                <div className="review-fees-item">
                  <span className="review-fees-item-label">
                    Gas fee (2nd trade)
                  </span>
                  <span className="review-fees-item-value">
                    {gas_fee_1} {tokenFee1}
                  </span>
                </div>
              </>
            )}
          </div>

          <span
            onClick={onSwap}
            class="buttonbig-yellow buttonbig-yellow--confirmation"
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
            <span className="buttonbig-yellow__text">Confirm Swap & Send</span>
          </span>
        </Modal>
      ) : isSendSuccessfulModalOpen ? (
        <Modal
          isOpen={isSendSuccessfulModalOpen}
          onClose={closeSuccessfullModal}
          headTitle={"Review Swap & Send"}
          customHead={
            <div class="modal-head">
              <div onClick={closeSuccessfullModal} class="modal-close">
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
            <img src={confirmationImageSwap} class="modal-top-pic" />
          </div>
          <div class="modal-title-status">Swap & Send Successful</div>
          <div class="modal-view-on-explorer">
            <div class="view-on-explorer-button">
              <span class="view-on-explorer-text">View on Explorer </span>
              <span class="view-on-explorer-icon">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.66667 4.33333L9 1M9 1H6.77778M9 1V3.22222M9 5.88889V8.11111C9 8.34686 8.90635 8.57295 8.73965 8.73965C8.57295 8.90635 8.34686 9 8.11111 9H1.88889C1.65314 9 1.42705 8.90635 1.26035 8.73965C1.09365 8.57295 1 8.34686 1 8.11111V1.88889C1 1.65314 1.09365 1.42705 1.26035 1.26035C1.42705 1.09365 1.65314 1 1.88889 1H4.11111"
                    stroke="#E3C6AD"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>
          <div class="modal-confirmation-summary">
            <div class="summary-row">
              <div class="summary-label">You traded</div>
              <div class="summary-value">
                <span class="summary-value-number">{youPay}</span>
                <span class="summary-value-small">{youPayToken}</span>
              </div>
            </div>
            <div class="summary-row">
              <div class="summary-label">For a Total Of:</div>
              <div class="summary-value">
                <span class="summary-value-number">{displayYouReceive}</span>
                <span class="summary-value-small">{youReceiveToken}</span>
              </div>
            </div>
            <div class="summary-row">
              <div class="summary-label">To Address:</div>
              <div class="summary-value">
                <span class="summary-value-number">{sendTo}</span>
              </div>
            </div>
          </div>
        </Modal>
      ) : isFailedModalOpen ? (
        <Modal
          isOpen={isFailedModalOpen}
          onClose={closeFailedModal}
          headTitle={"Failed Swap"}
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
          <div class="modal-view-on-explorer">
            <div class="view-on-explorer-button">
              {hasClaimed ? (
                <span onClick={closeFailedModal} class="view-on-explorer-text">
                  Swap done, but an issue occurred on the final step. Please
                  claim your tokens here.
                </span>
              ) : (
                transactionStateObject &&
                transactionStateObject.Ok[0]?.reply?.Swap?.block_ids?.map(
                  (block_id, idx) => (
                    <span
                      key={idx}
                      class="view-on-explorer-text"
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onClick={() =>
                        openBlockLink(block_id.block_id, block_id.principal_id)
                      }
                    >
                      View on Explorer {idx + 1}{" "}
                      <FiExternalLink
                        size={24}
                        className="external-icon"
                        style={{ marginLeft: "8px" }}
                      />
                    </span>
                  )
                )
              )}
            </div>
          </div>
          <div class="modal-confirmation-summary">
            {/* <div class="summary-row">
            <div class="summary-value">
                <span class="summary-value-number">
                  Failed Swapping {youPay} {youPayToken} for {youReceive} {youReceiveToken}
                </span>
            </div>
          </div> */}
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
});

export default SwapComponent;
