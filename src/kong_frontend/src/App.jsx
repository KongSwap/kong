import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import {
  priceRoundedPool,
  priceRoundedAmount,
} from "./utils/priceDecimalConvertor";
import bananaButtonShow from "../../assets/bananas-show.png";
import bananaButtonHide from "../../assets/bananas-hide.png";
import kongImage from "../../assets/kong.png";
import tokenAdaImage from "../../assets/tokens/ADA.svg";
import tokenArbImage from "../../assets/tokens/ARB.svg";
import tokenAlpacalbImage from "../../assets/tokens/alpacalb.png";
import tokenAvaxImage from "../../assets/tokens/AVAX.svg";
import tokenBitsImage from "../../assets/tokens/bits.svg";
import tokenBnbImage from "../../assets/tokens/BNB.svg";
import tokenBobImage from "../../assets/tokens/bob.svg";
import tokenBtcImage from "../../assets/tokens/BTC.svg";
import tokenBurnImage from "../../assets/tokens/burn.png";
import tokenCatImage from "../../assets/tokens/CAT.svg";
import tokenChatImage from "../../assets/tokens/CHAT.svg";
import tokenCkbtcImage from "../../assets/tokens/ckBTC.svg";
import tokenCkethImage from "../../assets/tokens/ckETH.svg";
import tokenCkusdcImage from "../../assets/tokens/ckUSDC.svg";
import tokenCkusdtImage from "../../assets/tokens/ckUSDT.svg";
import tokenCkpepeImage from "../../assets/tokens/ckpepe.svg";
import tokenCkshibImage from "../../assets/tokens/ckshib.svg";
import tokenClownImage from "../../assets/tokens/clown.svg";
import tokenCsprImage from "../../assets/tokens/CSPR.svg";
import tokenCtzImage from "../../assets/tokens/ctz.png";
import tokenDamonicImage from "../../assets/tokens/damonic.svg";
import tokenDecideAiImage from "../../assets/tokens/decideai.png";
import tokenDittoImage from "../../assets/tokens/ditto.png";
import tokenDkpImage from "../../assets/tokens/DKP.svg";
import tokenDodImage from "../../assets/tokens/dod.png";
import tokenDotImage from "../../assets/tokens/DOT.svg";
import tokenDogmiImage from "../../assets/tokens/dogmi.png";
import tokenDolrImage from "../../assets/tokens/dolr.png";
import tokenElnaImage from "../../assets/tokens/elna.png";
import tokenEstImage from "../../assets/tokens/est.png";
import tokenEthImage from "../../assets/tokens/ETH.svg";
import tokenExeImage from "../../assets/tokens/EXE.svg";
import tokenFplImage from "../../assets/tokens/fpl.png";
import tokenGhostImage from "../../assets/tokens/GHOST.svg";
import tokenGlazeImage from "../../assets/tokens/glaze.png";
import tokenGldtImage from "../../assets/tokens/gldt.png";
import tokenGoldDaoImage from "../../assets/tokens/golddao.png";
import tokenGrtImage from "../../assets/tokens/GRT.svg";
import tokenHmfeeImage from "../../assets/tokens/hmfee.svg";
import tokenHtcethImage from "../../assets/tokens/htcketh.svg";
import tokenHtdnaImage from "../../assets/tokens/htDNA.svg";
import tokenHtsns1Image from "../../assets/tokens/htSNS1.svg";
import tokenIcpImage from "../../assets/tokens/ICP.svg";
import tokenIcPumperImage from "../../assets/tokens/icpumper.png";
import tokenIcvcImage from "../../assets/tokens/icvc.png";
import tokenIdogeImage from "../../assets/tokens/idoge.png";
import tokenKinicImage from "../../assets/tokens/kinic.png";
import tokenKongImage from "../../assets/tokens/KONG.svg";
import tokenLinkImage from "../../assets/tokens/LINK.svg";
import tokenLtcImage from "../../assets/tokens/LTC.svg";
import tokenMaticImage from "../../assets/tokens/MATIC.svg";
import tokenMcsImage from "../../assets/tokens/mcs.svg";
import tokenMotokoImage from "../../assets/tokens/motoko.png";
import tokenNanasImage from "../../assets/tokens/nanas.svg";
import tokenNd64Image from "../../assets/tokens/nd64.svg";
import tokenNicpImage from "../../assets/tokens/nicp.svg";
import tokenNtnImage from "../../assets/tokens/ntn.png";
import tokenOrigynImage from "../../assets/tokens/origyn.png";
import tokenOwlImage from "../../assets/tokens/owl.png";
import tokenPandaImage from "../../assets/tokens/panda.png";
import tokenPartyImage from "../../assets/tokens/party.svg";
import tokenPepeImage from "../../assets/tokens/PEPE.svg";
import tokenShibImage from "../../assets/tokens/SHIB.svg";
import tokenSneedImage from "../../assets/tokens/sneed.svg";
import tokenSolImage from "../../assets/tokens/SOL.svg";
import tokenTaggrImage from "../../assets/tokens/taggr.png";
import tokenTendiesImage from "../../assets/tokens/tendies.png";
import tokenTotalHoldingsImage from "../../assets/tokens/total-holdings.svg";
import tokenTraxImage from "../../assets/tokens/trax.png";
import tokenUniImage from "../../assets/tokens/UNI.svg";
import tokenUsdcImage from "../../assets/tokens/USDC.svg";
import tokenUsdtImage from "../../assets/tokens/USDT.svg";
import tokenWbtcImage from "../../assets/tokens/WBTC.svg";
import tokenWtnImage from "../../assets/tokens/wtn.svg";
import tokenWumboImage from "../../assets/tokens/wumbo.svg";
import tokenYugeImage from "../../assets/tokens/yuge.svg";
import SwapComponent from "./components/SwapComponent";
import { ToastContainer, toast } from "react-toastify";
import Navigation, {
  formatPoolName,
  extractParts,
} from "./components/Navigation";
import { useLocation, useNavigate } from "react-router-dom";
import StatsPage from "./components/StatsPage";
import PoolsComponent from "./components/PoolsComponent";
import RemoveLiquidityComponent from "./components/RemoveLiquidityComponent";
import SendComponent from "./components/SendComponent";
import Modal from "./components/Modal";
import { formatBalances, formatNumber } from "./utils/formatBalances";
import {
  getActor as kong_backend,
  getAuthActor as kong_backend_auth,
} from "./lib/kong_backend";
import useIdentity from "./components/useIdentity";
import { FRONTEND_URL } from "./constants/config";
import ReceiveComponent from "./components/ReceiveComponent";
import Tippy from "@tippyjs/react";
import FooterSocials from "./components/FooterSocials";
import { defaultStateUser } from "./constants/defaultState";
import GorilaText from "./components/GorilaText";
import { isEqual } from "lodash";

const tokenImages = {
  ADA: tokenAdaImage,
  ARB: tokenArbImage,
  ALPACALB: tokenAlpacalbImage,
  AVAX: tokenAvaxImage,
  Bits: tokenBitsImage,
  BNB: tokenBnbImage,
  BOB: tokenBobImage,
  BTC: tokenBtcImage,
  BURN: tokenBurnImage,
  CAT: tokenCatImage,
  CHAT: tokenChatImage,
  ckBTC: tokenCkbtcImage,
  ckETH: tokenCkethImage,
  ckUSDC: tokenCkusdcImage,
  ckUSDT: tokenCkusdtImage,
  ckPEPE: tokenCkpepeImage,
  ckSHIB: tokenCkshibImage,
  CLOWN: tokenClownImage,
  CSPR: tokenCsprImage,
  CTZ: tokenCtzImage,
  DAMONIC: tokenDamonicImage,
  DCD: tokenDecideAiImage,
  DITTO: tokenDittoImage,
  DKP: tokenDkpImage,
  DOD: tokenDodImage,
  DOT: tokenDotImage,
  DOGMI: tokenDogmiImage,
  DOLR: tokenDolrImage,
  ELNA: tokenElnaImage,
  EST: tokenEstImage,
  ETH: tokenEthImage,
  EXE: tokenExeImage,
  FPL: tokenFplImage,
  GHOST: tokenGhostImage,
  GLAZE: tokenGlazeImage,
  GLDGov: tokenGoldDaoImage,
  GLDT: tokenGldtImage,
  GRT: tokenGrtImage,
  HMFEE: tokenHmfeeImage,
  HTCETH: tokenHtcethImage,
  HTDNA: tokenHtdnaImage,
  HTSNS1: tokenHtsns1Image,
  ICP: tokenIcpImage,
  ICPUMPER: tokenIcPumperImage,
  ICVC: tokenIcvcImage,
  IDOGE: tokenIdogeImage,
  KINIC: tokenKinicImage,
  KONG: tokenKongImage,
  LINK: tokenLinkImage,
  LTC: tokenLtcImage,
  MATIC: tokenMaticImage,
  MCS: tokenMcsImage,
  MOTOKO: tokenMotokoImage,
  nanas: tokenNanasImage,
  ND64: tokenNd64Image,
  nICP: tokenNicpImage,
  NTN: tokenNtnImage,
  OGY: tokenOrigynImage,
  OWL: tokenOwlImage,
  PANDA: tokenPandaImage,
  PARTY: tokenPartyImage,
  PEPE: tokenPepeImage,
  SHIB: tokenShibImage,
  SNEED: tokenSneedImage,
  SOL: tokenSolImage,
  TAGGR: tokenTaggrImage,
  TENDIES: tokenTendiesImage,
  TOTALHOLDINGS: tokenTotalHoldingsImage,
  TRAX: tokenTraxImage,
  UNI: tokenUniImage,
  USDC: tokenUsdcImage,
  USDT: tokenUsdtImage,
  WBTC: tokenWbtcImage,
  WTN: tokenWtnImage,
  WUMBO: tokenWumboImage,
  YUGE: tokenYugeImage,
};

const allowedViewTabs = ["swap", "pools", "send", "receive", "remove"];

export const tokenBalancesSelector = {
  ICP: "icpBalance",
  ckBTC: "ckbtcBalance",
  ckETH: "ckethBalance",
  ckUSDC: "ckusdcBalance",
  ckUSDT: "ckusdtBalance",
  DKP: "dkpBalance",
  Bits: "bitsBalance",
  CHAT: "chatBalance",
  nanas: "nanasBalance",
  ND64: "nd64Balance",
  WTN: "wtnBalance", // Include new tokens in balances selector
  YUGE: "yugeBalance",
  nICP: "nicpBalance",
  ALPACALB: "alpacalbBalance",
  PARTY: "partyBalance",
  SNEED: "sneedBalance",
  CLOWN: "clownBalance",
  DAMONIC: "damonicBalance",
  EXE: "exeBalance",
  WUMBO: "wumboBalance",
  MCS: "mcsBalance",
  BOB: "bobBalance",
  BURN: "burnBalance",
  NTN: "ntnBalance",
  DCD: "dcdBalance",
  GLDGov: "gldgovBalance",
  OWL: "owlBalance",
  OGY: "ogyBalance",
  FPL: "fplBalance",
  DITTO: "dittoBalance",
  ICVC: "icvcBalance",
  GLDT: "gldtBalance",
  GHOST: "ghostBalance",
  CTZ: "ctzBalance",
  ELNA: "elnaBalance",
  DOGMI: "dogmiBalance",
  EST: "estBalance",
  PANDA: "pandaBalance",
  KINIC: "kinicBalance",
  DOLR: "dolrBalance",
  TRAX: "traxBalance",
  MOTOKO: "motokoBalance",
  ckPEPE: "ckpepeBalance",
  ckSHIB: "ckshibBalance",
  DOD: "dodBalance",
  KONG: "kongBalance",
};

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
      paca_backend,
      kong_ledger_backend,
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
  const [tokenSearchTerm, setTokenSearchTerm] = useState('');

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
      if (pool.symbol_1 === 'ICP') {
        priceMap[pool.symbol_0 + '_ckUSDT'] = pool.price * priceMap['ICP_ckUSDT'];
      } else {
        const tokenSymbol = pool.lp_token_symbol;
        priceMap[tokenSymbol] = pool.price; // Store price against token symbol
      }
    });
    return priceMap;
  }, [poolsInfo]);

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
    console.log("activeIdentity=", activeIdentity);
    console.log("plugPrincipal=", plugPrincipal);
    console.log("isAuthenticated=", isAuthenticated);
    if (!activeIdentity && !plugPrincipal && !isAuthenticated) {
      setPrincipal(null);
      initializeUserData();
      setIsDrawerOpen(false);
    } else if (plugPrincipal && localStorage.getItem('last_wallet_connected') === 'plug') {
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
    async (retryCount = 0, maxRetries = 1) => {
      const lastWallet = localStorage.getItem('last_wallet_connected');
      console.log("lastWallet=", lastWallet);
      if (!principal || !isInitialized || !lastWallet) {
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
      updateBalance(gldt_backend, "GLDT"),
      updateBalance(ghost_backend, "GHOST"),
      updateBalance(ctz_backend, "CTZ"),
      updateBalance(elna_backend, "ELNA"),
      updateBalance(dogmi_backend, "DOGMI"),
      updateBalance(est_backend, "EST"),
      updateBalance(panda_backend, "PANDA"),
      updateBalance(kinic_backend, "KINIC"),
      updateBalance(dolr_backend, "DOLR"),
      updateBalance(trax_backend, "TRAX"),
      updateBalance(motoko_backend, "MOTOKO"),
      updateBalance(ckpepe_backend, "ckPEPE"),
      updateBalance(ckshib_backend, "ckSHIB"),
      updateBalance(dod_backend, "DOD"),
      updateBalance(kong_ledger_backend, "KONG"),
      updateBalance(paca_backend, "PACA"),
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
    paca_backend,
    kong_backend,
    kong_ledger_backend,
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

  const sortedTokens = useMemo(() => {
    // Helper function to parse balance and return a BigNumber instance
    const parseBalance = (balance) => {
      if (!balance) return new BigNumber(0); // Return a BigNumber with value 0 if balance is invalid
      try {
        return new BigNumber(balance.toString().replace(/,/g, "")); // Remove commas and parse the balance
      } catch (error) {
        console.error("Error parsing balance:", balance, error);
        return new BigNumber(0); // Return 0 in case of any parsing error
      }
    };

    // Helper function to parse price and return a BigNumber instance
    const parsePrice = (price) => {
      if (!price) return new BigNumber(0); // Return a BigNumber with value 0 if price is invalid
      try {
        return new BigNumber(price); // Convert the price to BigNumber
      } catch (error) {
        console.error("Error parsing price:", price, error);
        return new BigNumber(0); // Return 0 in case of any parsing error
      }
    };

    return [
      {
        symbol: "ICP",
        balance: shownBalances.icpBalance,
        usdBalance: parseBalance(shownBalances.icpBalance)
          .multipliedBy(parsePrice(tokenPrices["ICP_ckUSDT"]))
          .toFixed(2), // Calculate USD balance with fixed 2 decimal places
        image: tokenImages["ICP"],
        price:
          priceRoundedPool(
            tokenPrices["ICP_ckUSDT"],
            tokenPrices["ICP_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ckBTC",
        balance: shownBalances.ckbtcBalance,
        usdBalance: parseBalance(shownBalances.ckbtcBalance)
          .multipliedBy(parsePrice(tokenPrices["ckBTC_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ckBTC"],
        price:
          priceRoundedPool(
            tokenPrices["ckBTC_ckUSDT"],
            tokenPrices["ckBTC_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ckETH",
        balance: shownBalances.ckethBalance,
        usdBalance: parseBalance(shownBalances.ckethBalance)
          .multipliedBy(parsePrice(tokenPrices["ckETH_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ckETH"],
        price:
          priceRoundedPool(
            tokenPrices["ckETH_ckUSDT"],
            tokenPrices["ckETH_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ckUSDC",
        balance: shownBalances.ckusdcBalance,
        usdBalance: parseBalance(shownBalances.ckusdcBalance)
          .multipliedBy(parsePrice(tokenPrices["ckUSDC_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ckUSDC"],
        price:
          priceRoundedPool(
            tokenPrices["ckUSDC_ckUSDT"],
            tokenPrices["ckUSDC_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ckUSDT",
        balance: shownBalances.ckusdtBalance,
        usdBalance: parseBalance(shownBalances.ckusdtBalance)
          .multipliedBy(1) // Assuming ckUSDT is always priced at 1 USD
          .toFixed(2),
        image: tokenImages["ckUSDT"],
        price: "1.00",
      },
      {
        symbol: "DKP",
        balance: shownBalances.dkpBalance,
        usdBalance: parseBalance(shownBalances.dkpBalance)
          .multipliedBy(parsePrice(tokenPrices["DKP_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DKP"],
        price:
          priceRoundedPool(
            tokenPrices["DKP_ckUSDT"],
            tokenPrices["DKP_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "Bits",
        balance: shownBalances.bitsBalance,
        usdBalance: parseBalance(shownBalances.bitsBalance)
          .multipliedBy(parsePrice(tokenPrices["Bits_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["Bits"],
        price:
          priceRoundedPool(
            tokenPrices["Bits_ckUSDT"],
            tokenPrices["Bits_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "CHAT",
        balance: shownBalances.chatBalance,
        usdBalance: parseBalance(shownBalances.chatBalance)
          .multipliedBy(parsePrice(tokenPrices["CHAT_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["CHAT"],
        price:
          priceRoundedPool(
            tokenPrices["CHAT_ckUSDT"],
            tokenPrices["CHAT_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "nanas",
        balance: shownBalances.nanasBalance,
        usdBalance: parseBalance(shownBalances.nanasBalance)
          .multipliedBy(parsePrice(tokenPrices["nanas_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["nanas"],
        price:
          priceRoundedPool(
            tokenPrices["nanas_ckUSDT"],
            tokenPrices["nanas_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ND64",
        balance: shownBalances.nd64Balance,
        usdBalance: parseBalance(shownBalances.nd64Balance)
          .multipliedBy(parsePrice(tokenPrices["ND64_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ND64"],
        price:
          priceRoundedPool(
            tokenPrices["ND64_ckUSDT"],
            tokenPrices["ND64_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "WTN",
        balance: shownBalances.wtnBalance,
        usdBalance: parseBalance(shownBalances.wtnBalance)
          .multipliedBy(parsePrice(tokenPrices["WTN_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["WTN"],
        price:
          priceRoundedPool(
            tokenPrices["WTN_ckUSDT"],
            tokenPrices["WTN_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "YUGE",
        balance: shownBalances.yugeBalance,
        usdBalance: parseBalance(shownBalances.yugeBalance)
          .multipliedBy(parsePrice(tokenPrices["YUGE_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["YUGE"],
        price:
          priceRoundedPool(
            tokenPrices["YUGE_ckUSDT"],
            tokenPrices["YUGE_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "nICP",
        balance: shownBalances.nicpBalance,
        usdBalance: parseBalance(shownBalances.nicpBalance)
          .multipliedBy(parsePrice(tokenPrices["nICP_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["nICP"],
        price:
          priceRoundedPool(
            tokenPrices["nICP_ckUSDT"],
            tokenPrices["nICP_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ALPACALB",
        balance: shownBalances.alpacalbBalance,
        usdBalance: parseBalance(shownBalances.alpacalbBalance)
          .multipliedBy(parsePrice(tokenPrices["ALPACALB_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ALPACALB"],
        price:
          priceRoundedPool(
            tokenPrices["ALPACALB_ckUSDT"],
            tokenPrices["ALPACALB_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "PARTY",
        balance: shownBalances.partyBalance,
        usdBalance: parseBalance(shownBalances.partyBalance)
          .multipliedBy(parsePrice(tokenPrices["PARTY_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["PARTY"],
        price:
          priceRoundedPool(
            tokenPrices["PARTY_ckUSDT"],
            tokenPrices["PARTY_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "SNEED",
        balance: shownBalances.sneedBalance,
        usdBalance: parseBalance(shownBalances.sneedBalance)
          .multipliedBy(parsePrice(tokenPrices["SNEED_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["SNEED"],
        price:
          priceRoundedPool(
            tokenPrices["SNEED_ckUSDT"],
            tokenPrices["SNEED_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "CLOWN",
        balance: shownBalances.clownBalance,
        usdBalance: parseBalance(shownBalances.clownBalance)
          .multipliedBy(parsePrice(tokenPrices["CLOWN_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["CLOWN"],
        price:
          priceRoundedPool(
            tokenPrices["CLOWN_ckUSDT"],
            tokenPrices["CLOWN_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "DAMONIC",
        balance: shownBalances.damonicBalance,
        usdBalance: parseBalance(shownBalances.damonicBalance)
          .multipliedBy(parsePrice(tokenPrices["DAMONIC_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DAMONIC"],
        price:
          priceRoundedPool(
            tokenPrices["DAMONIC_ckUSDT"],
            tokenPrices["DAMONIC_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "EXE",
        balance: shownBalances.exeBalance,
        usdBalance: parseBalance(shownBalances.exeBalance)
          .multipliedBy(parsePrice(tokenPrices["EXE_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["EXE"],
        price:
          priceRoundedPool(
            tokenPrices["EXE_ckUSDT"],
            tokenPrices["EXE_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "WUMBO",
        balance: shownBalances.wumboBalance,
        usdBalance: parseBalance(shownBalances.wumboBalance)
          .multipliedBy(parsePrice(tokenPrices["WUMBO_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["WUMBO"],
        price:
          priceRoundedPool(
            tokenPrices["WUMBO_ckUSDT"],
            tokenPrices["WUMBO_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "MCS",
        balance: shownBalances.mcsBalance,
        usdBalance: parseBalance(shownBalances.mcsBalance)
          .multipliedBy(parsePrice(tokenPrices["MCS_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["MCS"],
        price:
          priceRoundedPool(
            tokenPrices["MCS_ckUSDT"],
            tokenPrices["MCS_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "BOB",
        balance: shownBalances.bobBalance,
        usdBalance: parseBalance(shownBalances.bobBalance)
          .multipliedBy(parsePrice(tokenPrices["BOB_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["BOB"],
        price:
          priceRoundedPool(
            tokenPrices["BOB_ckUSDT"],
            tokenPrices["BOB_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "BURN",
        balance: shownBalances.burnBalance,
        usdBalance: parseBalance(shownBalances.burnBalance)
          .multipliedBy(parsePrice(tokenPrices["BURN_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["BURN"],
        price:
          priceRoundedPool(
            tokenPrices["BURN_ckUSDT"],
            tokenPrices["BURN_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "NTN",
        balance: shownBalances.ntnBalance,
        usdBalance: parseBalance(shownBalances.ntnBalance)
          .multipliedBy(parsePrice(tokenPrices["NTN_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["NTN"],
        price:
          priceRoundedPool(
            tokenPrices["NTN_ckUSDT"],
            tokenPrices["NTN_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "DCD",
        balance: shownBalances.dcdBalance,
        usdBalance: parseBalance(shownBalances.dcdBalance)
          .multipliedBy(parsePrice(tokenPrices["DCD_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DCD"],
        price:
          priceRoundedPool(
            tokenPrices["DCD_ckUSDT"],
            tokenPrices["DCD_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "GLDGov",
        balance: shownBalances.gldgovBalance,
        usdBalance: parseBalance(shownBalances.gldgovBalance)
          .multipliedBy(parsePrice(tokenPrices["GLDGov_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["GLDGov"],
        price:
          priceRoundedPool(
            tokenPrices["GLDGov_ckUSDT"],
            tokenPrices["GLDGov_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "OWL",
        balance: shownBalances.owlBalance,
        usdBalance: parseBalance(shownBalances.owlBalance)
          .multipliedBy(parsePrice(tokenPrices["OWL_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["OWL"],
        price:
          priceRoundedPool(
            tokenPrices["OWL_ckUSDT"],
            tokenPrices["OWL_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "OGY",
        balance: shownBalances.ogyBalance,
        usdBalance: parseBalance(shownBalances.ogyBalance)
          .multipliedBy(parsePrice(tokenPrices["OGY_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["OGY"],
        price:
          priceRoundedPool(
            tokenPrices["OGY_ckUSDT"],
            tokenPrices["OGY_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "FPL",
        balance: shownBalances.fplBalance,
        usdBalance: parseBalance(shownBalances.fplBalance)
          .multipliedBy(parsePrice(tokenPrices["FPL_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["FPL"],
        price:
          priceRoundedPool(
            tokenPrices["FPL_ckUSDT"],
            tokenPrices["FPL_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "DITTO",
        balance: shownBalances.dittoBalance,
        usdBalance: parseBalance(shownBalances.dittoBalance)
          .multipliedBy(parsePrice(tokenPrices["DITTO_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DITTO"],
        price:
          priceRoundedPool(
            tokenPrices["DITTO_ckUSDT"],
            tokenPrices["DITTO_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ICVC",
        balance: shownBalances.icvcBalance,
        usdBalance: parseBalance(shownBalances.icvcBalance)
          .multipliedBy(parsePrice(tokenPrices["ICVC_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ICVC"],
        price:
          priceRoundedPool(
            tokenPrices["ICVC_ckUSDT"],
            tokenPrices["ICVC_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "GLDT",
        balance: shownBalances.gldtBalance,
        usdBalance: parseBalance(shownBalances.gldtBalance)
          .multipliedBy(parsePrice(tokenPrices["GLDT_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["GLDT"],
        price:
          priceRoundedPool(
            tokenPrices["GLDT_ckUSDT"],
            tokenPrices["GLDT_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "GHOST",
        balance: shownBalances.ghostBalance,
        usdBalance: parseBalance(shownBalances.ghostBalance)
          .multipliedBy(parsePrice(tokenPrices["GHOST_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["GHOST"],
        price:
          priceRoundedPool(
            tokenPrices["GHOST_ckUSDT"],
            tokenPrices["GHOST_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "CTZ",
        balance: shownBalances.ctzBalance,
        usdBalance: parseBalance(shownBalances.ctzBalance)
          .multipliedBy(parsePrice(tokenPrices["CTZ_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["CTZ"],
        price:
          priceRoundedPool(
            tokenPrices["CTZ_ckUSDT"],
            tokenPrices["CTZ_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ELNA",
        balance: shownBalances.elnaBalance,
        usdBalance: parseBalance(shownBalances.elnaBalance)
          .multipliedBy(parsePrice(tokenPrices["ELNA_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ELNA"],
        price:
          priceRoundedPool(
            tokenPrices["ELNA_ckUSDT"],
            tokenPrices["ELNA_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "DOGMI",
        balance: shownBalances.dogmiBalance,
        usdBalance: parseBalance(shownBalances.dogmiBalance)
          .multipliedBy(parsePrice(tokenPrices["DOGMI_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DOGMI"],
        price:
          priceRoundedPool(
            tokenPrices["DOGMI_ckUSDT"],
            tokenPrices["DOGMI_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "EST",
        balance: shownBalances.estBalance,
        usdBalance: parseBalance(shownBalances.estBalance)
          .multipliedBy(parsePrice(tokenPrices["EST_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["EST"],
        price:
          priceRoundedPool(
            tokenPrices["EST_ckUSDT"],
            tokenPrices["EST_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "PANDA",
        balance: shownBalances.pandaBalance,
        usdBalance: parseBalance(shownBalances.pandaBalance)
          .multipliedBy(parsePrice(tokenPrices["PANDA_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["PANDA"],
        price:
          priceRoundedPool(
            tokenPrices["PANDA_ckUSDT"],
            tokenPrices["PANDA_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "KINIC",
        balance: shownBalances.kinicBalance,
        usdBalance: parseBalance(shownBalances.kinicBalance)
          .multipliedBy(parsePrice(tokenPrices["KINIC_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["KINIC"],
        price:
          priceRoundedPool(
            tokenPrices["KINIC_ckUSDT"],
            tokenPrices["KINIC_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "DOLR",
        balance: shownBalances.dolrBalance,
        usdBalance: parseBalance(shownBalances.dolrBalance)
          .multipliedBy(parsePrice(tokenPrices["DOLR_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DOLR"],
        price:
          priceRoundedPool(
            tokenPrices["DOLR_ckUSDT"],
            tokenPrices["DOLR_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "TRAX",
        balance: shownBalances.traxBalance,
        usdBalance: parseBalance(shownBalances.traxBalance)
          .multipliedBy(parsePrice(tokenPrices["TRAX_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["TRAX"],
        price:
          priceRoundedPool(
            tokenPrices["TRAX_ckUSDT"],
            tokenPrices["TRAX_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "MOTOKO",
        balance: shownBalances.motokoBalance,
        usdBalance: parseBalance(shownBalances.motokoBalance)
          .multipliedBy(parsePrice(tokenPrices["MOTOKO_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["MOTOKO"],
        price:
          priceRoundedPool(
            tokenPrices["MOTOKO_ckUSDT"],
            tokenPrices["MOTOKO_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ckPEPE",
        balance: shownBalances.ckpepeBalance,
        usdBalance: parseBalance(shownBalances.ckpepeBalance)
          .multipliedBy(parsePrice(tokenPrices["ckPEPE_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ckPEPE"],
        price:
          priceRoundedPool(
            tokenPrices["ckPEPE_ckUSDT"],
            tokenPrices["ckPEPE_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "ckSHIB",
        balance: shownBalances.ckshibBalance,
        usdBalance: parseBalance(shownBalances.ckshibBalance)
          .multipliedBy(parsePrice(tokenPrices["ckSHIB_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["ckSHIB"],
        price:
          priceRoundedPool(
            tokenPrices["ckSHIB_ckUSDT"],
            tokenPrices["ckSHIB_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "DOD",
        balance: shownBalances.dodBalance,
        usdBalance: parseBalance(shownBalances.dodBalance)
          .multipliedBy(parsePrice(tokenPrices["DOD_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["DOD"],
        price:
          priceRoundedPool(
            tokenPrices["DOD_ckUSDT"],
            tokenPrices["DOD_ckUSDT"]
          ) || 0,
      },
      {
        symbol: "KONG",
        balance: shownBalances.kongBalance,
        usdBalance: parseBalance(shownBalances.kongBalance)
          .multipliedBy(parsePrice(tokenPrices["KONG_ckUSDT"]))
          .toFixed(2),
        image: tokenImages["KONG"],
        price:
          priceRoundedPool(
            tokenPrices["KONG_ckUSDT"],
            tokenPrices["KONG_ckUSDT"]
          ) || 0,
      },
    ].sort((a, b) => parseFloat(b.usdBalance) - parseFloat(a.usdBalance));
  }, [shownBalances, tokenPrices]);

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
          <MainPage
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
            sortedTokens={sortedTokens}
            tokenPrices={tokenPrices}
            tokenImages={tokenImages}
            accountId={accountId}
            poolsInfo={poolsInfo}
          />
        </div>
      )}
      {/* <Outlet /> */}
    </>
  );
};

export default App;

function MainPage({
  userDetails,
  showBalances,
  setShowBalances,
  isCopied,
  onTabClick,
  viewTab,
  poolBalances,
  selectedPool,
  updatePoolBalances,
  updateUserBalances,
  principal,
  slippage,
  isSlippageModalOpen,
  toggleSlippageModal,
  updateSlippage,
  handleSlippageBlur,
  copyToClipboard,
  smallerPrincipal,
  changeDrawerContent,
  tokenDetails,
  sortedTokens,
  tokenPrices,
  tokenImages,
  accountId,
  poolsInfo,
}) {
  const [walletContentView, setWalletContentView] = useState("tokens-table");
  const [slippageDefaultView, setSlippageDefaultView] = useState(true);
  const [tokenSearchTerm, setTokenSearchTerm] = useState('');
  const filteredTokens = useMemo(() => {
    return sortedTokens.filter(token => 
      token.symbol.toLowerCase().includes(tokenSearchTerm.toLowerCase()) 
    );
  }, [sortedTokens, tokenSearchTerm]);


  return (
    <>
      <main className="swap-page-main">
        <span className="swap-page-title-as-image"></span>
        {!FRONTEND_URL.includes("3ldz4-aiaaa-aaaar-qaina-cai") && (
          <span className="swap-page-title">(BETA MODE, TEST TOKENS ONLY)</span>
        )}
        <section className="swap-page-section">
          <div className="swap-page-left-container">
            {showBalances && (
              <div className="panel-green-second  panel-green-second--forwallet">
                <div className="panel-green-second__tl"></div>
                <div className="panel-green-second__tm"></div>
                <div className="panel-green-second__tr"></div>

                <div className="panel-green-second__ml"></div>
                <div className="panel-green-second__mr"></div>

                <div className="panel-green-second__bl"></div>
                <div className="panel-green-second__bm"></div>
                <div className="panel-green-second__br"></div>

                <div className="panel-green-second__content">
                  <div className="wallet">
                    <div class="wallet-head">
                      <span class="wallet-headlabel">Address</span>
                      <span class="wallet-address-wrapper">
                        <input
                          type="text"
                          class="wallet-address-input"
                          value={
                            smallerPrincipal ? smallerPrincipal : "no address"
                          }
                        />
                        <Tippy content="Copied!" visible={isCopied}>
                          <button
                            className="copy-button"
                            onClick={() => copyToClipboard(principal || "")}
                          >
                            {!isCopied ? (
                              <svg
                                class="copy-icon"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M15.04 0H4.8C4.54539 0 4.30121 0.101143 4.12118 0.281178C3.94114 0.461212 3.84 0.705392 3.84 0.96V3.84H0.96C0.705392 3.84 0.461212 3.94114 0.281178 4.12118C0.101143 4.30121 0 4.54539 0 4.8V15.04C0 15.2946 0.101143 15.5388 0.281178 15.7188C0.461212 15.8989 0.705392 16 0.96 16H11.2C11.4546 16 11.6988 15.8989 11.8788 15.7188C12.0589 15.5388 12.16 15.2946 12.16 15.04V12.16H15.04C15.2946 12.16 15.5388 12.0589 15.7188 11.8788C15.8989 11.6988 16 11.4546 16 11.2V0.96C16 0.705392 15.8989 0.461212 15.7188 0.281178C15.5388 0.101143 15.2946 0 15.04 0ZM10.24 14.08H1.92V5.76H10.24V14.08ZM14.08 10.24H12.16V4.8C12.16 4.54539 12.0589 4.30121 11.8788 4.12118C11.6988 3.94114 11.4546 3.84 11.2 3.84H5.76V1.92H14.08V10.24Z"
                                  fill="white"
                                />
                              </svg>
                            ) : (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  fill-rule="evenodd"
                                  clip-rule="evenodd"
                                  d="M4.80005 0H15.04C15.2947 0 15.5388 0.101562 15.7188 0.28125C15.8989 0.460938 16 0.705078 16 0.959961V11.2002C16 11.4551 15.8989 11.6992 15.7188 11.8789C15.5388 12.0586 15.2947 12.1602 15.04 12.1602H12.1599V15.04C12.1599 15.2949 12.0588 15.5391 11.8789 15.7188C11.6987 15.8984 11.4546 16 11.2 16H0.959961C0.705322 16 0.461182 15.8984 0.28125 15.7188C0.101074 15.5391 0 15.2949 0 15.04V4.7998C0 4.54492 0.101074 4.30078 0.28125 4.12109C0.461182 3.94141 0.705322 3.83984 0.959961 3.83984H3.84009V0.959961C3.84009 0.705078 3.94116 0.460938 4.12109 0.28125C4.30127 0.101562 4.54541 0 4.80005 0ZM12.1599 10.2402H14.0801V1.91992H5.76001V3.83984H11.2C11.4546 3.83984 11.6987 3.94141 11.8789 4.12109C12.0588 4.30078 12.1599 4.54492 12.1599 4.7998V10.2402ZM9.90015 6.56348C9.83276 6.4248 9.73218 6.29883 9.6001 6.2002C9.1582 5.86914 8.53149 5.95801 8.19995 6.40039L5.125 10.5L3.6897 9.13281C3.45947 8.91406 3.1521 8.82617 2.86011 8.86719C2.64478 8.89746 2.4375 8.99805 2.27588 9.16797C1.89502 9.56738 1.9104 10.2002 2.3103 10.5811L5.375 13.5L9.80005 7.59961C10.0322 7.29004 10.0576 6.88965 9.90015 6.56348Z"
                                  fill="white"
                                />
                              </svg>
                            )}
                          </button>
                        </Tippy>
                      </span>
                    </div>

                    <div className="wallet-tabs">
                      <span
                        onClick={() => setWalletContentView("tokens-table")}
                        className={`button-green button-green--swap ${
                          walletContentView === "tokens-table" &&
                          "button-green--selected"
                        }`}
                      >
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
                        <span className="button-green__text">Tokens</span>
                      </span>
                      <span
                        onClick={() => setWalletContentView("pools-table")}
                        className={`button-green button-green--send ${
                          walletContentView === "pools-table" &&
                          "button-green--selected"
                        }`}
                      >
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
                        <span className="button-green__text">Pools</span>
                      </span>
                    </div>
                    {walletContentView === "tokens-table" ? (
                      <>
                  
                        <div class="tokenwallet-table-head">
                          <span class="tokenwallet-table-head__itemtokens">
                            Tokens
                          </span>
                          <span class="tokenwallet-table-head__itemprice">
                            Price
                          </span>
                          <span class="tokenwallet-table-head__itemamount">
                            Amount
                          </span>
                        </div>
                       
                        <div class="tokenwallet-table-container">
                          <div className="tokenwallet-search-wrapper">
                        <input 
                          type="text" 
                          className="tokenwallet-search"
                          placeholder="Search tokens" 
                          value={tokenSearchTerm}
                          onChange={(e) => setTokenSearchTerm(e.target.value)}
                        />
                        </div>
                          <ul className="tokenwallet-table-list">
                            {filteredTokens.map((token) => (
                              <li
                                className="tokenwallet-table-item"
                                onClick={() =>
                                  onTabClick("swap", `${token.symbol}_ckUSDT`)
                                }
                                key={token.symbol}
                              >
                                <div className="tokenwallet-token-container">
                                  <img
                                    src={token.image}
                                    className="tokenwallet-token-logo"
                                    alt={token.symbol}
                                  />
                                  <span className="tokenwallet-token-name">
                                    {token.symbol}
                                  </span>
                                </div>

                                <div className="tokenwallet-token-price-container">
                                  <span className="tokenwallet-token-price">
                                    ${token.price}
                                  </span>
                                </div>

                                <div className="tokenwallet-token-amount-container">
                                  <span className="tokenwallet-token-amount">
                                    {token.balance}
                                  </span>
                                  <span className="tokenwallet-token-value">
                                    (${token.usdBalance})
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    ) : (
                      <>
                        <div class="wallet-table-head">
                          <span>Pools</span>
                          <span>Liquidity</span>
                        </div>
                        <div class="wallet-table-container">
                          <ul class="wallet-table-list">
                            {poolBalances.length > 0 ? (
                              poolBalances.map((pool) => (
                                <li class="wallet-table-item" key={pool.name}>
                                  <span class="wallet-token-logos-2">
                                    <img
                                      src={tokenImages[pool.name.split("/")[0]]}
                                      class="wallet-token-logo wallet-token-logo-primary"
                                    />
                                    <img
                                      src={tokenImages[pool.name.split("/")[1]]}
                                      class="wallet-token-logo wallet-token-logo-secondary"
                                    />
                                  </span>

                                  <span class="wallet-token-name-for-pools">
                                    {pool.name} LP
                                  </span>

                                  <div class="wallet-token-amount-container">
                                    <span class="wallet-token-amount-highlight">
                                      {pool.balance} LP
                                    </span>
                                    <span class="wallet-token-amount-small">
                                      {pool.amount_0} {pool.symbol_0} /{" "}
                                      {pool.amount_1} {pool.symbol_1}
                                    </span>
                                  </div>

                                  <div class="wallet-token-controls-for-pools">
                                    <span
                                      onClick={() =>
                                        onTabClick("pools", pool.name)
                                      }
                                      className="wallet-token-control"
                                      title="Add"
                                    >
                                      <svg
                                        width="42"
                                        height="42"
                                        viewBox="0 0 42 42"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          fill-rule="evenodd"
                                          clip-rule="evenodd"
                                          d="M12 42V40H8V38H6V36H4V34H2V30H0V12H2V8H4V6H6V4H8V2H12V0H30V2H34V4H36V6H38V8H40V12H42V30H40V34H38V36H36V38H34V40H30V42H12ZM19 35V23H7V19H19V7H23V19H35V23H23V35H19Z"
                                          fill="white"
                                        />
                                      </svg>
                                    </span>
                                    <span
                                      onClick={() =>
                                        onTabClick("remove", pool.name)
                                      }
                                      className="wallet-token-control"
                                      title="Remove"
                                    >
                                      <svg
                                        width="42"
                                        height="42"
                                        viewBox="0 0 42 42"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          fill-rule="evenodd"
                                          clip-rule="evenodd"
                                          d="M12 42V40H8V38H6V36H4V34H2V30H0V12H2V8H4V6H6V4H8V2H12V0H30V2H34V4H36V6H38V8H40V12H42V30H40V34H38V36H36V38H34V40H30V42H12ZM35 19H7V23H35V19Z"
                                          fill="white"
                                        />
                                      </svg>
                                    </span>
                                  </div>
                                </li>
                              ))
                            ) : (
                              <span class="no-pools">No pools found</span>
                            )}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            <span
              onClick={() => setShowBalances(!showBalances)}
              className="banana-button"
            >
              {!showBalances && (
                <img
                  src={bananaButtonShow}
                  className="banana-button__img"
                  alt=""
                />
              )}
              {showBalances && (
                <img
                  src={bananaButtonHide}
                  className="banana-button__img"
                  alt=""
                />
              )}
            </span>
          </div>

          <div className="swap-page-center-container">
            <div className="SwapInterface">
              <div className="swap-outter-tabs">
                <span
                  onClick={() => onTabClick("swap", selectedPool)}
                  className={`button-green button-green--swap ${
                    viewTab === "swap" && "button-green--selected"
                  }`}
                >
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
                  <span className="button-green__text">Swap</span>
                </span>
                <span
                  onClick={() => onTabClick("pools", selectedPool)}
                  className={`button-green button-green--pools ${
                    (viewTab === "pools" || viewTab === "remove") &&
                    "button-green--selected"
                  }`}
                >
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
                  <span className="button-green__text">Pools</span>
                </span>
                <span
                  onClick={() => onTabClick("receive", selectedPool)}
                  className={`button-green button-green--send ${
                    viewTab === "receive" && "button-green--selected"
                  }`}
                >
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
                  <span className="button-green__text">Receive</span>
                </span>
                <span
                  onClick={() => onTabClick("send", selectedPool)}
                  className={`button-green button-green--send ${
                    viewTab === "send" && "button-green--selected"
                  }`}
                >
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
                  <span className="button-green__text">Send</span>
                </span>

                <span
                  onClick={() => toggleSlippageModal()}
                  className="tab-settings"
                >
                  <svg
                    className="tab-set-icon"
                    width="23"
                    height="23"
                    viewBox="0 0 23 23"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20.5 9.5V8.5H19.5V6.5H20.5V4.5H19.5V3.5H18.5V2.5H16.5V3.5H14.5V2.5H13.5V0.5H9.5V2.5H8.5V3.5H6.5V2.5H4.5V3.5H3.5V4.5H2.5V6.5H3.5V8.5H2.5V9.5H0.5V13.5H2.5V14.5H3.5V16.5H2.5V18.5H3.5V19.5H4.5V20.5H6.5V19.5H8.5V20.5H9.5V22.5H13.5V20.5H14.5V19.5H16.5V20.5H18.5V19.5H19.5V18.5H20.5V16.5H19.5V14.5H20.5V13.5H22.5V9.5H20.5ZM9.5 9.5V8.5H13.5V9.5H14.5V13.5H13.5V14.5H9.5V13.5H8.5V9.5H9.5Z"
                      stroke="black"
                      stroke-miterlimit="10"
                    />
                  </svg>
                </span>
              </div>

              <div className="swap-interface-undertabs">
                {viewTab === "swap" ? (
                  <SwapComponent
                    receiveAddress={principal ? principal : "no address"}
                    initialPool={selectedPool}
                    slippage={slippage}
                    userDetails={userDetails}
                    changeDrawerContent={changeDrawerContent}
                    tokenDetails={tokenDetails}
                    getUserBalances={updateUserBalances}
                    getLiquidityPoolBalances={updatePoolBalances}
                    tokenPrices={tokenPrices}
                    principal={principal}
                    tokenImages={tokenImages}
                  />
                ) : viewTab === "send" ? (
                  <SendComponent
                    userBalances={userDetails}
                    getUserBalances={updateUserBalances}
                    tokenDetails={tokenDetails}
                    tokenImages={tokenImages}
                    userDetails={userDetails}
                    tokenPrices={tokenPrices}
                  />
                ) : viewTab === "pools" ? (
                  <PoolsComponent
                    userDetails={userDetails}
                    changeDrawerContent={changeDrawerContent}
                    getUserBalances={updateUserBalances}
                    getLiquidityPoolBalances={updatePoolBalances}
                    tokenDetails={tokenDetails}
                    tokenPrices={tokenPrices}
                    principal={principal}
                    initialPool={selectedPool}
                    tokenImages={tokenImages}
                    poolsInfo={poolsInfo}
                  />
                ) : viewTab === "remove" ? (
                  <RemoveLiquidityComponent
                    key={selectedPool}
                    poolName={selectedPool}
                    getUserBalances={updateUserBalances}
                    getLiquidityPoolBalances={updatePoolBalances}
                    userPoolBalances={poolBalances}
                    changeDrawerContent={changeDrawerContent}
                    tokenDetails={tokenDetails}
                    tokenPrices={tokenPrices}
                    tokenImages={tokenImages}
                  />
                ) : viewTab === "receive" ? (
                  <ReceiveComponent
                    principal={principal}
                    accountId={accountId}
                  />
                ) : null}
              </div>
            </div>
          </div>
        <GorilaText />
          {/* <img src={kongImage} className="swap-page-kong-image-container" alt="" /> */}
        </section>
        {isSlippageModalOpen && (
          <Modal
            isOpen={isSlippageModalOpen}
            onClose={() => toggleSlippageModal()}
            headTitle={"Max Slippage"}
            customHead={
              <div class="modal-head">
                <div class="modal-head-title">Max Slippage</div>
                <div onClick={() => toggleSlippageModal()} class="modal-close">
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
            <div className="slip-fieldset">
              <div className="slip-tabs">
                <span
                  onClick={() => {
                    setSlippageDefaultView(true);
                    updateSlippage(defaultSlippage);
                  }}
                  className={`button-green button-green--swap ${
                    slippageDefaultView && "button-green--selected"
                  }`}
                >
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
                  <span className="button-green__text">Default</span>
                </span>
                <span
                  onClick={() => {
                    setSlippageDefaultView(false);
                  }}
                  className={`button-green button-green--send ${
                    !slippageDefaultView && "button-green--selected"
                  }`}
                >
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
                  <span className="button-green__text">Custom</span>
                </span>
              </div>
              <input
                type="text"
                className="slip-container-input"
                onChange={(e) => updateSlippage(e.target.value)}
                onBlur={handleSlippageBlur}
                value={slippage}
                disabled={slippageDefaultView}
              />
              <span className="slip-container-input-um">%</span>
            </div>
            <p className="slip-description">
              Maximum slippage is the largest allowable price decrease during a
              trade before the order is automatically cancelled.
            </p>
          </Modal>
        )}
        <FooterSocials />
        <ToastContainer
          stacked
          position="bottom-right"
          toastClassName="toast-container"
          bodyClassName="toast-body"
        />
      </main>
    </>
  );
}
