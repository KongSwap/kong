import React, { useState, useCallback, useEffect, useMemo } from "react";
import { tokenBalancesSelector } from "../App";
import confirmationImageSend from "../../../assets/kong-approves-3.png";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Modal from "./Modal";
import useIdentity from "./useIdentity";
import DOMPurify from "dompurify";
import { priceRoundedAmount } from "../utils/priceDecimalConvertor";
import { useNavigate } from "react-router-dom";

function is_principal_id(principal_id) {
  return /^([a-z0-9]{5}-){10}[a-z0-9]{3}|([a-z0-9]{5}-){4}cai$/.test(
    principal_id
  );
}

function is_account_id(account_id) {
  // ICP Account IDs are 64-character hexadecimal strings
  return /^[0-9a-fA-F]{64}$/.test(account_id);
}

function hexStringToUint8Array(hexString) {
  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const array = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < array.length; i++) {
    const byte = hexString.substr(i * 2, 2);
    array[i] = parseInt(byte, 16);
  }
  return array;
}

const SendComponent = ({
  userBalances,
  getUserBalances,
  tokenDetails,
  tokenImages,
  userDetails,
  tokenPrices,
}) => {
  const {
    actors: {
      icp_ledger_backend,
      ckbtc_ledger_backend,
      cketh_ledger_backend,
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
      exe_backend,
      wumbo_backend,
      mcs_backend,
      damonic_backend,
      bob_backend,
      // BURN NTN DCD GLDGov OWL OGY FPL DITTO ICVC
      burn_backend,
      ntn_backend,
      dcd_backend,
      gldgov_backend,
      owl_backend,
      ogy_backend,
      fpl_backend,
      ditto_backend,
      icvc_backend,
      gldt_backend,
      ghost_backend,
      ctz_backend,
      elna_backend,
      dogmi_backend,
      est_backend,
      panda_backend,
      kinic_backend,
      dolr_backend,
      trax_backend,
      motoko_backend,
      ckpepe_backend,
      ckshib_backend,
      dod_backend,
      kong_ledger_backend,
    },
  } = useIdentity();
  const navigate = useNavigate();
  const [youPay, setYouPay] = useState("0");
  const [receivingAddress, setReceivingAddress] = useState("");
  const [youPayToken, setYouPayToken] = useState(null);

  const [isAddressInvalid, setIsAddressInvalid] = useState(false);
  const [addressErrorMessage, setAddressErrorMessage] = useState("");

  const [isAmountInvalid, setIsAmountInvalid] = useState(false);
  const [amountErrorMessage, setAmountErrorMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendConfirmationModalOpen, setIsSendConfirmationModalOpen] =
    useState(false);
  const [isSendSuccessfulModalOpen, setIsSendSuccessfulModalOpen] =
    useState(false);
  const [availableBalanceMax, setAvailableBalanceMax] = useState("0.0000");

  const [tokenSelectSearchTerm, setTokenSelectSearchTerm] = useState('');

  const filteredSelectTokens = useMemo(() => {
    return Object.keys(tokenBalancesSelector).filter(token => 
      token.toLowerCase().includes(tokenSelectSearchTerm.toLowerCase())
    );
  }, [tokenSelectSearchTerm]);

  // Read 'pool' parameter on mount

  const isButtonDisabled = useMemo(() => {
    return isProcessing || isAddressInvalid || isAmountInvalid;
  }, [isProcessing, isAddressInvalid, isAmountInvalid]);

  const clearInputs = () => {
    setIsAmountInvalid(false);
    setAmountErrorMessage("");
    setIsModalOpen(false);
  };

  const getButtonText = useCallback(() => {
    if (isProcessing) {
      return "Processing...";
    }
    if (isAddressInvalid) {
      return addressErrorMessage;
    }
    if (isAmountInvalid) {
      return amountErrorMessage;
    }
    return "Send";
  }, [
    isProcessing,
    isAddressInvalid,
    isAmountInvalid,
    addressErrorMessage,
    amountErrorMessage,
  ]);

  const sanitizeInput = useCallback((input) => {
    let sanitizedInput = input.replace(/^\./, "0.");
    sanitizedInput = sanitizedInput.replace(/^0+(?!\.|$)/, "");
    sanitizedInput = sanitizedInput.replace(/[^0-9.]/g, "");
    sanitizedInput = sanitizedInput.replace(/(\..*?)\..*/g, "$1");
    const clean = DOMPurify.sanitize(sanitizedInput);
    return clean;
  }, []);

  const handleInputChange = useCallback(
    (inputValue) => {
      const sanitizedValue = sanitizeInput(inputValue); // Sanitize the input
      setYouPay(sanitizedValue === "" ? "" : sanitizedValue); // Update state
    },
    [sanitizeInput]
  );

  const handleTokenChange = (token) => {
    setYouPayToken(token);
    clearInputs();
    setYouPay("0");

    // Update the 'pool' parameter in the URL
    const params = new URLSearchParams(window.location.search);
    params.set("pool", `${token}_ckUSDT`);
    const newUrl = window.location.pathname + "?" + params.toString();
    navigate(newUrl);
  };

  const getTokenDecimals = useCallback(
    (tokenSymbol) => {
      if (!tokenDetails || !tokenSymbol) return null;

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
            gasFee: BigInt(token.fee),
          };
        }
      }

      return {
        decimals: 8,
        gasFee: BigInt(0),
      }; // Default to 8 if the token is not found, adjust if necessary
    },
    [tokenDetails]
  );

  const selectBackend = useCallback(
    (token) => {
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
        case "GLDT":
          return gldt_backend;
        case "GHOST":
          return ghost_backend;
        case "CTZ":
          return ctz_backend;
        case "ELNA":
          return elna_backend;
        case "DOGMI":
          return dogmi_backend;
        case "EST":
          return est_backend;
        case "PANDA":
          return panda_backend;
        case "KINIC":
          return kinic_backend;
        case "DOLR":
          return dolr_backend;
        case "TRAX":
          return trax_backend;
        case "MOTOKO":
          return motoko_backend;
        case "ckPEPE":
          return ckpepe_backend;
        case "ckSHIB":
          return ckshib_backend;
        case "DOD":
          return dod_backend;
        case "KONG":
          return kong_ledger_backend;
        default:
          return null;
      }
    },
    [
      icp_ledger_backend,
      ckbtc_ledger_backend,
      cketh_ledger_backend,
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
      exe_backend,
      wumbo_backend,
      mcs_backend,
      damonic_backend,
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
      ghost_backend,
      ctz_backend,
      elna_backend,
      dogmi_backend,
      est_backend,
      panda_backend,
      kinic_backend,
      dolr_backend,
      trax_backend,
      motoko_backend,
      ckpepe_backend,
      ckshib_backend,
      dod_backend,
      gldt_backend,
      kong_ledger_backend,
    ]
  );

  const withdraw_principal_id = useCallback(
    async (withdraw_amount, withdraw_address, ledger_auth) => {
      if (is_principal_id(withdraw_address)) {
        withdraw_amount = BigInt(withdraw_amount);

        const transfer_args = {
          to: { owner: Principal.fromText(withdraw_address), subaccount: [] },
          fee: [], // Include if necessary
          memo: [], // Include if necessary
          from_subaccount: [], // Include if necessary
          created_at_time: [], // Include if necessary
          amount: withdraw_amount,
        };
        console.log(transfer_args);
        ledger_auth
          .icrc1_transfer(transfer_args)
          .then((result) => {
            if (result.Ok) {
              setIsSendConfirmationModalOpen(false);
              setIsSendSuccessfulModalOpen(true);
              getUserBalances();
              setIsProcessing(false);
              clearInputs();
              return true;
            } else {
              // Handle transfer error
              console.error("Transfer failed:", result.Err);
              toast.error("Transfer failed");
              setIsProcessing(false);
              clearInputs();
              return false;
            }
          })
          .catch((err) => {
            setIsProcessing(false);
            setIsSendConfirmationModalOpen(false);
            console.error("Transfer error:", err);
            toast.error("Send failed");
            return false;
          });
      } else if (is_account_id(withdraw_address)) {
        if (youPayToken === "ICP") {
          // Convert the hex string Account ID to Uint8Array
          console.log("Account ID detected");
          let accountIdBytes;
          try {
            accountIdBytes = hexStringToUint8Array(withdraw_address);
          } catch (error) {
            console.error("Invalid Account ID format:", error);
            setIsProcessing(false);
            toast.error("Invalid Account ID format.");
            return;
          }

          // Ensure withdraw_amount is a BigInt
          withdraw_amount = BigInt(withdraw_amount);

          // Get fee amount (ensure it's a BigInt)
          const { gasFee } = getTokenDecimals(youPayToken);
          const feeAmount = gasFee; // Already a BigInt

          const transfer_args = {
            to: Array.from(accountIdBytes),
            fee: { e8s: feeAmount },
            memo: BigInt(0),
            from_subaccount: [],
            created_at_time: [],
            amount: { e8s: withdraw_amount },
          };

          // Execute the transfer
          ledger_auth
            .transfer(transfer_args)
            .then((result) => {
              if (result.Ok) {
                setIsSendConfirmationModalOpen(false);
                setIsSendSuccessfulModalOpen(true);
                getUserBalances();
                setIsProcessing(false);
                clearInputs();
              } else {
                console.error("Transfer failed:", result.Err);
                toast.error("Transfer failed");
                setIsProcessing(false);
                clearInputs();
              }
            })
            .catch((err) => {
              setIsProcessing(false);
              setIsSendConfirmationModalOpen(false);
              console.error("Transfer error:", err);
              toast.error("Send failed");
            });
        } else {
          console.log("Sending to Account IDs is not supported for this token");
          setIsProcessing(false);
          toast.error("Sending to Account IDs is only supported for ICP.");
        }
      } else {
        console.log("Invalid address");
        setIsProcessing(false);
        toast.error("Invalid address format.");
      }
    },
    [
      youPayToken,
      getUserBalances,
      getTokenDecimals,
      is_account_id,
      is_principal_id,
    ]
  );

  const onWithdraw = useCallback(async () => {
    if (isButtonDisabled || isProcessing || !youPayToken) return;

    setIsProcessing(true);
    let withdraw_amount;

    const { decimals: youPayDecimals } = getTokenDecimals(youPayToken);
    withdraw_amount = BigInt(
      new BigNumber(youPay)
        .multipliedBy(new BigNumber(10).pow(youPayDecimals))
        .toFixed(0)
    );

    const selectedBackend = selectBackend(youPayToken);
    await withdraw_principal_id(
      withdraw_amount,
      receivingAddress,
      selectedBackend
    );
  }, [
    youPay,
    youPayToken,
    receivingAddress,
    getTokenDecimals,
    isButtonDisabled,
    isProcessing,
    withdraw_principal_id,
    selectBackend,
  ]);

  const validateAddress = useCallback((address, token) => {
    if (!address) {
      setIsAddressInvalid(true);
      setAddressErrorMessage("Enter Address");
      return;
    }

    if (!is_principal_id(address) && !is_account_id(address)) {
      setIsAddressInvalid(true);
      setAddressErrorMessage("Invalid Address Format");
      return;
    }

    if (is_account_id(address) && token !== "ICP") {
      setIsAddressInvalid(true);
      setAddressErrorMessage("Only ICP Supports Account IDs");
      return;
    }

    // Address is valid
    setIsAddressInvalid(false);
    setAddressErrorMessage("");
  }, []);

  // Re-validate when youPayToken or receivingAddress changes

  const handleAddressChange = useCallback(
    (address) => {
      setReceivingAddress(address);
      validateAddress(address, youPayToken);
    },
    [validateAddress, youPayToken]
  );

  const validateInput = useCallback(() => {
    if (!youPay || isNaN(youPay) || !youPayToken) {
      setIsAmountInvalid(true);
      setAmountErrorMessage("Enter Amount");
      return;
    }

    const isInsufficient = new BigNumber(youPay).isGreaterThan(
      new BigNumber(availableBalanceMax)
    );
    const isInvalid =
      new BigNumber(youPay).isLessThanOrEqualTo(0) || isNaN(youPay);

    if (isInvalid) {
      setIsAmountInvalid(true);
      setAmountErrorMessage("Enter Valid Amount");
      return;
    }

    if (isInsufficient) {
      setIsAmountInvalid(true);
      console.log("setting insufficient balance");
      setAmountErrorMessage("Insufficient Balance");
      return;
    }

    // Amount is valid
    setIsAmountInvalid(false);
    setAmountErrorMessage("");
  }, [youPay, youPayToken, getTokenDecimals]);

  useEffect(() => {
    validateInput();
  }, [youPay, youPayToken, validateInput]);

  useEffect(() => {
    validateAddress(receivingAddress, youPayToken);
  }, [youPayToken, receivingAddress, validateAddress]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pool = params.get("pool");
    if (pool) {
      const token = pool.split("_")[0];
      setYouPayToken(token);
    } else {
      setYouPayToken("ICP");
    }
  }, []);

  useEffect(() => {
    const calculateMaxBalance = async () => {
      if (!youPayToken || !userBalances || !getTokenDecimals) return;

      // Get the raw user balance for the selected token
      const userBalanceRaw =
        userBalances[tokenBalancesSelector[youPayToken]] || "0";

      // Remove commas and sanitize the balance string
      const userBalanceSanitized = userBalanceRaw.replace(/,/g, "");
      const userBalance = new BigNumber(userBalanceSanitized);

      const { decimals: youPayDecimals, gasFee } =
        getTokenDecimals(youPayToken);

      // Convert balance to the required precision
      const transformedPayAmount = userBalance.multipliedBy(
        new BigNumber(10).pow(youPayDecimals)
      );

      const availableAmountAfterFee = transformedPayAmount.minus(
        new BigNumber(gasFee)
      );

      // Convert back to the normal decimal representation for display
      const availableBalanceMax = availableAmountAfterFee
        .dividedBy(new BigNumber(10).pow(youPayDecimals))
        .toString();
      const availableMaxDisplay = priceRoundedAmount(
        tokenPrices[youPayToken + "_ckUSDT"],
        availableBalanceMax
      );

      // Set the maximum balance or 0.0000 if invalid
      setAvailableBalanceMax(
        userBalance.isZero() ||
          userBalance.isNegative() ||
          availableMaxDisplay < 0
          ? "0.0000"
          : availableMaxDisplay
      );
    };

    calculateMaxBalance();
  }, [youPayToken, userBalances, getTokenDecimals, tokenPrices]);

  const handleMaxClick = () => {
    handleInputChange(availableBalanceMax);
  };

  return (
    <>
      <div className="panel-green-main panel-green-main--sendingcontainer">
        <div className="panel-green-main__tl"></div>
        <div className="panel-green-main__tm"></div>
        <div className="panel-green-main__tr"></div>
        <div className="panel-green-main__ml"></div>
        <div className="panel-green-main__mr"></div>
        <div className="panel-green-main__bl"></div>
        <div className="panel-green-main__bm"></div>
        <div className="panel-green-main__br"></div>
        <div className="panel-green-main__content">
          <div className="sending-container">
            <h4 className="sending-container-label">You send</h4>
            <div className="sending-container-items">
              <div className="sending-container-left">
                <div className="sending-container-inputholder"></div>
              </div>
              <div className="sending-container-right">
                <span
                  onClick={() => {
                    setIsModalOpen(true);
                  }}
                  className="buttonmed-yellow buttonmed-yellow--customselect2 buttonmed-yellow--youresending"
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
                <div className="sending-under-select">
                  <span className="sending-container-selectedtoken-value">
                    Avail: {availableBalanceMax}
                  </span>
                  <span
                    onClick={() => handleMaxClick()}
                    className="sending-container-max"
                  >
                    MAX
                  </span>
                </div>
              </div>
            </div>
            <input
              onChange={(e) => handleInputChange(e.target.value)}
              type="text"
              className="sending-container-input"
              value={youPay}
            />
          </div>
        </div>
      </div>
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
            <span className="sending-label">To</span>
            <input
              onChange={(e) => handleAddressChange(e.target.value)}
              className="address-input"
              type="text"
              value={receivingAddress}
            />
          </div>
        </div>
      </div>
      <div className="sending-button-container">
        <button
          onClick={() => setIsSendConfirmationModalOpen(true)}
          type="button"
          className={`buttonbig-yellow buttonbig-yellow--asbutton buttonbig-yellow--sending-button ${
            isButtonDisabled ? "buttonbig-yellow--disabled" : ""
          }`}
          disabled={isButtonDisabled}
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
          <span className="buttonbig-yellow__text">{getButtonText()}</span>
        </button>
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTokenSelectSearchTerm(''); // Clear search when closing
        }}
        headTitle={"Select a token"}
      >
        <div className="token-select-container">
          <div className="tokenwallet-search-wrapper">
            <input 
              type="text" 
              className="tokenwallet-search"
              placeholder="Search tokens by symbol" 
              value={tokenSelectSearchTerm}
              onChange={(e) => setTokenSelectSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="token-select-list">
            {filteredSelectTokens.map((token) => (
              <div
                className="token-select-item"
                key={token}
                onClick={() => {
                  handleTokenChange(token);
                  setTokenSelectSearchTerm(''); // Clear search after selection
                }}
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
        </div>
      </Modal>
      {isSendConfirmationModalOpen && (
        <Modal
          isOpen={isSendConfirmationModalOpen}
          onClose={() => setIsSendConfirmationModalOpen(false)}
          headTitle={"Review Send"}
        >
          <div className="review-main">
            <div className="review-main-item">
              <span className="review-label">You are sending</span>
              <span className="review-value-wrap">
                <span className="review-value">
                  {youPay}
                  <span className="review-value-currency">{youPayToken}</span>
                </span>
                <img src={tokenImages[youPayToken]} className="review-token" />
              </span>
            </div>
            <div className="review-send-item">
              <span className="review-send-label">Send To:</span>
              <span className="review-send-address">{receivingAddress}</span>
            </div>
          </div>
          {/* <div className="review-fees">
            <div className="review-fees-head">
              <h3 className="review-fees-headtitle">Fees & Charges</h3>
            </div>
            <div className="review-fees-item">
              <span className="review-fees-item-label">Network Fee</span>
              <span className="review-fees-item-value">0.001 ICP</span>
            </div>
          </div> */}
          <span
            onClick={onWithdraw}
            disabled={isButtonDisabled}
            className={`buttonbig-yellow buttonbig-yellow--confirmation ${
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
            <span className="buttonbig-yellow__text">
              {isProcessing
                ? "Processing..."
                : isButtonDisabled
                ? getButtonText()
                : "Confirm Send"}
            </span>
          </span>
        </Modal>
      )}
      {isSendSuccessfulModalOpen && (
        <Modal
          isOpen={isSendSuccessfulModalOpen}
          onClose={() => {
            setIsSendSuccessfulModalOpen(false);
            clearInputs();
            setYouPay("0");
          }}
          headTitle={"Send Successful"}
          customHead={
            <div className="modal-head">
              <div
                onClick={() => setIsSendSuccessfulModalOpen(false)}
                className="modal-close"
              >
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
            <img src={confirmationImageSend} className="modal-top-pic" />
          </div>
          <div className="modal-title-status">Send Successful</div>
          <div className="modal-view-on-explorer">
            <div className="view-on-explorer-button">
              <span className="view-on-explorer-text">View on Explorer </span>
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
                    stroke="#E3C6AD"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>
          <div className="modal-confirmation-summary">
            <div className="summary-row">
              <div className="summary-label">You sent</div>
              <div className="summary-value">
                <span className="summary-value-number">{youPay}</span>
                <span className="summary-value-small">{youPayToken}</span>
              </div>
            </div>
            <div className="review-send-item">
              <span className="review-send-label">Send To Address:</span>
              <span className="review-send-address">{receivingAddress}</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default SendComponent;
