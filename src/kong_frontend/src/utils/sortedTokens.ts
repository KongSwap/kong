// src/kong_frontend/src/sortedTokens.js

import BigNumber from "bignumber.js";
import { priceRoundedPool } from "./numberUtils";
import { tokenImages } from "./tokenImageUtils";

export const getSortedTokens = (shownBalances: any, tokenPrices: any) => {
  const parseBalance = (balance: BigInt) => {
    if (!balance) return new BigNumber(0);
    try {
      return new BigNumber(balance.toString().replace(/,/g, ""));
    } catch (error) {
      console.error("Error parsing balance:", balance, error);
      return new BigNumber(0);
    }
  };

  const parsePrice = (price: BigInt) => {
    if (!price) return new BigNumber(0);
    try {
      return new BigNumber(price.toString());
    } catch (error) {
      console.error("Error parsing price:", price, error);
      return new BigNumber(0);
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
  ].sort((a, b) => parseFloat(b.usdBalance) - parseFloat(a.usdBalance));
};

