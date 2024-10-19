import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import {
  priceRoundedAmount,
} from "./utils/numberUtils";
import { toast } from "react-toastify";
import Navigation, {
  extractParts,
} from "./components/Navigation";
import { useLocation, useNavigate } from "react-router-dom";
import StatsPage from "./pages/StatsPage";
import { formatBalances, formatNumber } from "./utils/formatBalances";
import {
  getActor as kong_backend,
} from "./lib/kong_backend";
import useIdentity from "./utils/useIdentity";
import { defaultStateUser } from "./constants/defaultState";
import { isEqual } from "lodash";
import { tokenBalancesSelector } from "./constants/tokensConstants";
import { tokenImages } from "./utils/tokenImageUtils";
import { getSortedTokens } from "./utils/sortedTokens";
import SwapPage from "./pages/SwapPage";

const allowedViewTabs = ["swap", "pools", "send", "receive", "remove"];
const validTokens = Object.keys(tokenBalancesSelector);
const defaultSlippage = 2;

const App = () => {
  const location = useLocation();
  const {
    activeIdentity,
    plugPrincipal,
    isAuthenticated,
    expiredSession,
    identityType,
    clear,
    actors: {
      backendKingKong,
      backendKingKongFaucet,
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
    isInitialized,
  } = useIdentity();

  const [userDetails, setUserDetails] = useState(defaultStateUser);

  const [shownBalances, setShownBalances] = useState({});
  const [poolBalances, setPoolBalances] = useState([]);
  const [poolsInfo, setPoolsInfo] = useState([]);
  const [isCopied, setIsCopied] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [principal, setPrincipal] = useState(null);
  const [fetchingTokens, setFetchingTokens] = useState(false);
  const queryParams = new URLSearchParams(location.search);
  const viewTab = queryParams.get("viewtab");
  const pool = queryParams.get("pool");
  const navigate = useNavigate();
  const isStatsPage = location.pathname.startsWith("/stats");
  const [slippage, setSlippage] = useState(defaultSlippage);
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDrowerTokens, setShowDrowerTokens] = useState(true);
  const [showDrowerPools, setShowDrowerPools] = useState(false);
  const [showDrawerClaims, setShowDrawerClaims] = useState(false);
  const [tokenDetails, setTokenDetails] = useState([]);
  const [poolsTotals, setPoolsTotals] = useState({
    totalTvl: 0,
    totalVolume: 0,
    totalFees: 0,
  });
  const [accountId, setAccountId] = useState(null);
  const previousPoolBalances = useRef([]);
  const smallerPrincipal = useMemo(() => {
    if (principal) {
      return extractParts(principal);
    }
    return "";
  }, [principal]);

  const tokenPrices = useMemo(() => {
    if (!poolsInfo.length) return {};
    const priceMap = {};
    poolsInfo.forEach((pool) => {
      const tokenSymbol = pool.lp_token_symbol;
      priceMap[tokenSymbol] = pool.price; // Store price against token symbol
    });
    return priceMap;
  }, [poolsInfo]);
  const sortedTokens = useMemo(() => getSortedTokens(shownBalances, tokenPrices), [shownBalances, tokenPrices]);

  useEffect(() => {
    // validate route
    if (location.pathname !== "/") return;
    if (!viewTab && !isStatsPage) {
      navigate("/?viewtab=swap&pool=ICP_ckUSDT", { replace: true });
    }
    if (!allowedViewTabs.includes(viewTab)) {
      navigate("/?viewtab=swap&pool=ICP_ckUSDT", { replace: true });
    }
    if (pool) {
      const poolParts = pool.split("_");
      if (poolParts.length === 2) {
        const [token0, token1] = poolParts;
        if (validTokens.includes(token0) && validTokens.includes(token1)) {
          return;
        }
      }
    } 

    navigate("/?viewtab=swap&pool=ICP_ckUSDT", { replace: true });
  }, [pool, navigate]);

  useEffect(() => {
    if (isInitialized) {
      setShownBalances(formatBalances(userDetails, tokenPrices));
    }
  }, [userDetails, tokenPrices, isInitialized]);

  useEffect(() => {
    const getTokenDetails = async () => {
      const tokens = await kong_backend().tokens([]);
      setTokenDetails(tokens.Ok || []);
    };
    getTokenDetails();
  }, []);

  useEffect(() => {
    if (!activeIdentity && !plugPrincipal && !isAuthenticated) {
      setPrincipal(null);
      initializeUserData();
      setIsDrawerOpen(false);
    } else if (plugPrincipal && !principal) {
      setPrincipal(plugPrincipal);
    } else if (
      !principal &&
      backendKingKong &&
      activeIdentity &&
      activeIdentity.getPrincipal()
    ) {
      setPrincipal(
        Principal.fromUint8Array(activeIdentity.getPrincipal()._arr).toText()
      );
    }
  }, [
    activeIdentity,
    backendKingKong,
    plugPrincipal,
    principal,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!activeIdentity && !plugPrincipal && !isAuthenticated) {
      setPrincipal(null);
      initializeUserData();
    }
  }, [activeIdentity, plugPrincipal]);

  useEffect(() => {
    if (expiredSession) {
      toast.info("Session expired. Reloading in 5 seconds...", {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      setTimeout(async () => {
        await clear(); // Clear identity (logout)
        window.location.reload(); // Refresh the page
      }, 5000);
    }
  }, [expiredSession, clear]);

  const initializeUserData = useCallback(() => {
    setUserDetails(defaultStateUser);
  }, []);

  const getTokenDecimals = useCallback(
    (tokenSymbol) => {
      if (!tokenDetails) return null;

      const cleanedSymbol = tokenSymbol.includes(".")
        ? tokenSymbol.split(".")[1]
        : tokenSymbol;

      for (const tokenObj of tokenDetails) {
        const tokenKey = Object.keys(tokenObj)[0];
        const token = tokenObj[tokenKey];

        const cleanedTokenSymbol = token.symbol.includes(".")
          ? token.symbol.split(".")[1]
          : token.symbol;

        if (cleanedTokenSymbol === cleanedSymbol) {
          return {
            decimals: token.decimals,
            gasFee: token.fee,
          };
        }
      }

      return { decimals: 8, gasFee: 0 };
    },
    [tokenDetails]
  );

  const getUserProfile = useCallback(
    async (retryCount = 0, maxRetries = 5) => {
      if (!principal || !isInitialized) {
        return;
      }

      try {
        const result = await backendKingKong.get_user();
        const accountId = result.Ok ? result.Ok.account_id : "";
        setAccountId(accountId);
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);

        if (retryCount < maxRetries) {
          const retryDelay = 1000 * (retryCount + 1); // Exponential backoff
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);

          setTimeout(() => {
            getUserProfile(retryCount + 1, maxRetries);
          }, retryDelay);
        } else {
          toast.error("Failed to fetch user profile after multiple attempts.");
        }
      }
    },
    [isInitialized, principal, backendKingKong]
  );

  const updateUserBalances = useCallback(async () => {
    if (!principal || !tokenDetails) {
      initializeUserData();
      return;
    }
    const principalBalance = principal
      ? Principal.fromText(principal)
      : activeIdentity.getPrincipal();

    const balanceUpdates = new Map(); // Use a Map to store balances immutably

    const updateBalance = async (backend, tokenSymbol) => {
      if (!backend) {
        // console.error(`${tokenSymbol} canister not available`);
        return;
      }
      try {
        const { decimals } = getTokenDecimals(tokenSymbol);
        const balance = await backend.icrc1_balance_of({
          owner: principalBalance,
          subaccount: [],
        });

        // Store the balance in the Map
        balanceUpdates.set(
          `${tokenSymbol.toLowerCase()}Balance`,
          formatNumber(
            new BigNumber(balance)
              .dividedBy(new BigNumber(10).pow(decimals))
              .toNumber(),
            6
          )
        );
      } catch (error) {
        // console.error(`Error fetching ${tokenSymbol} balance:`, error);
        // toast.error(`Error fetching ${tokenSymbol} balance:`, error);
      }
    };

    // Fetch all balances in parallel and wait for all promises to resolve
    await Promise.allSettled([
      updateBalance(icp_ledger_backend, "ICP"),
      updateBalance(ckbtc_ledger_backend, "ckBTC"),
      updateBalance(cketh_ledger_backend, "ckETH"),
      updateBalance(ckusdc_ledger_backend, "ckUSDC"),
      updateBalance(ckusdt_ledger_backend, "ckUSDT"),
      updateBalance(dkp_ledger_backend, "DKP"),
      updateBalance(bits_ledger_backend, "Bits"),
      updateBalance(chat_ledger_backend, "CHAT"),
      updateBalance(nanas_ledger_backend, "nanas"),
      updateBalance(nd64_ledger_backend, "ND64"),
      updateBalance(wtn_ledger_backend, "WTN"),
      updateBalance(yuge_ledger_backend, "YUGE"),
      updateBalance(NICP_ledger_backend, "nICP"),
      updateBalance(alpacalb_backend, "ALPACALB"),
      updateBalance(party_backend, "PARTY"),
      updateBalance(sneed_backend, "SNEED"),
      updateBalance(clown_backend, "CLOWN"),
      updateBalance(exe_backend, "EXE"),
      updateBalance(wumbo_backend, "WUMBO"),
      updateBalance(mcs_backend, "MCS"),
      updateBalance(damonic_backend, "DAMONIC"),
      updateBalance(bob_backend, "BOB"),
      updateBalance(burn_backend, "BURN"),
      updateBalance(ntn_backend, "NTN"),
      updateBalance(dcd_backend, "DCD"),
      updateBalance(gldgov_backend, "GLDGov"),
      updateBalance(owl_backend, "OWL"),
      updateBalance(ogy_backend, "OGY"),
      updateBalance(fpl_backend, "FPL"),
      updateBalance(ditto_backend, "DITTO"),
      updateBalance(icvc_backend, "ICVC"),
    ]);

    // Convert the Map to an object
    const balanceUpdatesObject = Object.fromEntries(balanceUpdates);

    // Check if the balances have changed before updating the state
    const updatedUserDetails = {
      ...userDetails,
      ...balanceUpdatesObject,
      userPrincipalId: principalBalance.toText(),
    };
    // Only update the state if the balances have changed
    if (!isEqual(userDetails, updatedUserDetails)) {
      setUserDetails(updatedUserDetails);
    }
  }, [
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
    principal,
    initializeUserData,
    tokenDetails,
    getTokenDecimals,
    burn_backend,
    ntn_backend,
    dcd_backend,
    gldgov_backend,
    owl_backend,
    ogy_backend,
    fpl_backend,
    ditto_backend,
    icvc_backend,
    userDetails,
  ]);

  const updateUserPools = useCallback(async () => {
    if (!principal || !backendKingKong) {
      return;
    }

    try {
      const userBalances = await backendKingKong.user_balances([]);
      const balances = userBalances.Ok || [];
      // Format the pool balances, including amount_0 and amount_1
      const updatedPoolBalances = balances
        .map((item) => {
          const key = Object.keys(item)[0];
          const token = item[key];
          const poolPrice = tokenPrices[`${token.symbol_0}_${token.symbol_1}`]; // Use tokenPrices based on the pool symbols

          // Use the updated functions with the poolPrice and corresponding amounts
          const formattedAmount_0 = priceRoundedAmount(
            poolPrice,
            token.amount_0
          );
          const formattedAmount_1 = priceRoundedAmount(
            poolPrice,
            token.amount_1
          );

          return {
            name: `${token.symbol_0}/${token.symbol_1}`,
            balance: new BigNumber(token.balance).toFormat(8),
            amount_0: formattedAmount_0, // Add formatted amount_0
            amount_1: formattedAmount_1, // Add formatted amount_1
            symbol_0: token.symbol_0, // Keep symbol_0 and symbol_1
            symbol_1: token.symbol_1,
          };
        })
        .filter(Boolean);

      // Set the updated balances in the state
      setPoolBalances(updatedPoolBalances);
    } catch (error) {
      console.error("Error fetching pool balances:", error);
    }
  }, [backendKingKong, principal, tokenPrices]);

  const onTabClick = useCallback(
    (tab, pool = "ICP_ckUSDT") => {
      if (pool === "ckUSDT_ckUSDT") {
        queryParams.set("viewtab", tab);
        queryParams.set("pool", "ICP_ckUSDT");
        navigate(`/?${queryParams.toString()}`, { replace: true });
      } else {
        queryParams.set("viewtab", tab);
        queryParams.set("pool", pool.replace("/", "_"));
        navigate(`/?${queryParams.toString()}`, { replace: true });
      }
    },
    [queryParams, navigate]
  );

  const toggleSlippageModal = useCallback(() => {
    setIsSlippageModalOpen((prevState) => !prevState);
  }, []);

  const updateSlippage = useCallback((value) => {
    setSlippage(value);
  }, []);

  const handleSlippageBlur = useCallback(() => {
    let newValue = parseFloat(slippage);
    if (isNaN(newValue) || newValue < 0.1) newValue = 0.1;
    else if (newValue > 100) newValue = 100;
    setSlippage(newValue.toFixed(1));
  }, [slippage]);

  const copyToClipboard = useCallback(async (text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
      }
      setTimeout(() => {
        setIsCopied(false);
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const changeDrawerContent = useCallback((content) => {
    setIsDrawerOpen(true);
    setShowDrowerTokens(content === "tokens");
    setShowDrowerPools(content === "pools");
    setShowDrawerClaims(content === "claims");
  }, []);

  const getTokens = useCallback(async () => {
    if (!principal || !backendKingKongFaucet) return;
    setFetchingTokens(true);

    try {
      const result = await backendKingKongFaucet.claim();
      updateUserBalances();
      setFetchingTokens(false);

      if (result.hasOwnProperty("Err")) {
        toast(result.Err);
      } else {
        toast("Tokens claimed successfully");
      }
    } catch (error) {
      setFetchingTokens(false);
      toast("Error claiming tokens:", error);
    }
  }, [principal, backendKingKongFaucet, updateUserBalances]);

  const updatePoolBalances = useCallback(async () => {
    try {
      const liquidity_pool_balances_response = await kong_backend().pools([]);
      const liquidity_pool_balances =
        (liquidity_pool_balances_response.Ok &&
          liquidity_pool_balances_response.Ok.pools) ||
        [];
  
      // Check for equality between previous and current balances
      if (!isEqual(previousPoolBalances.current, liquidity_pool_balances)) {
        // Only update if pool balances have changed
        setPoolsInfo(liquidity_pool_balances); // Update pool info
        previousPoolBalances.current = liquidity_pool_balances; // Update the reference
  
        // Fetch the decimals for proper conversion (using the first pool's token as reference)
        const decimals = 6;
  
        const formatBigInt = (value) => {
          if (typeof value === "bigint") {
            const dividedValue = Number(value) / 10 ** decimals;
            return dividedValue.toFixed(0);
          }
          return value;
        };
  
        // Update totals if pool balances changed
        setPoolsTotals({
          totalTvl: formatBigInt(
            liquidity_pool_balances_response.Ok.total_tvl || 0
          ),
          totalVolume: formatBigInt(
            liquidity_pool_balances_response.Ok.total_24h_volume || 0
          ),
          totalFees: formatBigInt(
            liquidity_pool_balances_response.Ok.total_24h_lp_fee || 0
          ),
        });
      }
  
      if (liquidity_pool_balances_response.hasOwnProperty("Err")) {
        console.error(liquidity_pool_balances_response.Err);
      }
    } catch (error) {
      console.error("Error fetching pool balances, retrying...", error);
      setTimeout(updatePoolBalances, 2000);
    }
  }, []);

  useEffect(() => {
    // call it once to get the initial pool balances
    updatePoolBalances();
    const intervalId = setInterval(() => {
      updatePoolBalances();
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (principal && isInitialized) {
        updateUserBalances();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [principal, isInitialized, updateUserBalances]);

  return (
    <>
      {isStatsPage ? (
        <div className="StatsSecondBody">
          <Navigation
            getUserProfile={getUserProfile}
            updatePoolBalances={updateUserPools}
            updateUserBalances={updateUserBalances}
            getTokens={getTokens}
            principal={principal}
            isFetchingTokens={fetchingTokens}
            poolBalances={poolBalances}
            onTabClick={onTabClick}
            changeDrawerContent={changeDrawerContent}
            setIsDrawerOpen={setIsDrawerOpen}
            isDrawerOpen={isDrawerOpen}
            showDrowerTokens={showDrowerTokens}
            showDrowerPools={showDrowerPools}
            showDrawerClaims={showDrawerClaims}
            tokenDetails={tokenDetails}
            sortedTokens={sortedTokens}
            tokenPrices={tokenPrices}
            tokenImages={tokenImages}
          />
          <StatsPage
            poolInfo={poolsInfo}
            tokenDetails={tokenDetails}
            tokenImages={tokenImages}
            poolsTotals={poolsTotals}
          />
        </div>
      ) : (
        <div className="SwapSecondBody">
          <Navigation
            getUserProfile={getUserProfile}
            updatePoolBalances={updateUserPools}
            updateUserBalances={updateUserBalances}
            getTokens={getTokens}
            principal={principal}
            isFetchingTokens={fetchingTokens}
            poolBalances={poolBalances}
            onTabClick={onTabClick}
            changeDrawerContent={changeDrawerContent}
            setIsDrawerOpen={setIsDrawerOpen}
            isDrawerOpen={isDrawerOpen}
            showDrowerTokens={showDrowerTokens}
            showDrowerPools={showDrowerPools}
            showDrawerClaims={showDrawerClaims}
            tokenDetails={tokenDetails}
            sortedTokens={sortedTokens}
            tokenPrices={tokenPrices}
            tokenImages={tokenImages}
          />
          <SwapPage
            userDetails={userDetails}
            showBalances={showBalances}
            setShowBalances={setShowBalances}
            isCopied={isCopied}
            onTabClick={onTabClick}
            viewTab={viewTab}
            poolBalances={poolBalances}
            selectedPool={pool}
            updatePoolBalances={updateUserPools}
            updateUserBalances={updateUserBalances}
            getTokens={getTokens}
            principal={principal}
            slippage={slippage}
            isSlippageModalOpen={isSlippageModalOpen}
            toggleSlippageModal={toggleSlippageModal}
            updateSlippage={updateSlippage}
            handleSlippageBlur={handleSlippageBlur}
            copyToClipboard={copyToClipboard}
            smallerPrincipal={smallerPrincipal}
            changeDrawerContent={changeDrawerContent}
            tokenDetails={tokenDetails}
            poolInfo={poolsInfo}
            sortedTokens={sortedTokens}
            tokenPrices={tokenPrices}
            tokenImages={tokenImages}
            accountId={accountId}
          />
        </div>
      )}
      {/* <Outlet /> */}
    </>
  );
};

export default App;

