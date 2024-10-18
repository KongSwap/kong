import BigNumber from "bignumber.js";
import { priceRoundedAmount } from "./numberUtils";

export function formatBalances(userDetails: any, tokenPrices: any) {
  return {
    ckbtcBalance: priceRoundedAmount(
      tokenPrices["ckBTC_ckUSDT"], // Assuming the pool symbol is "ckBTC_ckUSDT"
      userDetails.ckbtcBalance
    ),
    ckethBalance: priceRoundedAmount(
      tokenPrices["ckETH_ckUSDT"], // Assuming the pool symbol is "ckETH_ckUSDT"
      userDetails.ckethBalance
    ),
    ckusdcBalance: priceRoundedAmount(
      tokenPrices["ckUSDC_ckUSDT"], // Assuming the pool symbol is "ckUSDC_ckUSDT"
      userDetails.ckusdcBalance
    ),
    ckusdtBalance: priceRoundedAmount(
      1, // Assuming the pool symbol is "ckUSDT_ckUSDT" (typically "ckUSDT" price is fixed at 1.00)
      userDetails.ckusdtBalance
    ),
    icpBalance: priceRoundedAmount(
      tokenPrices["ICP_ckUSDT"], // Assuming the pool symbol is "ICP_ckUSDT"
      userDetails.icpBalance
    ),
    bitsBalance: priceRoundedAmount(
      tokenPrices["Bits_ckUSDT"], // Assuming the pool symbol is "Bits_ckUSDT"
      userDetails.bitsBalance
    ),
    yugeBalance: priceRoundedAmount(
      tokenPrices["YUGE_ckUSDT"], // Assuming the pool symbol is "YUGE_ckUSDT"
      userDetails.yugeBalance
    ),
    chatBalance: priceRoundedAmount(
      tokenPrices["CHAT_ckUSDT"], // Assuming the pool symbol is "CHAT_ckUSDT"
      userDetails.chatBalance
    ),
    dkpBalance: priceRoundedAmount(
      tokenPrices["DKP_ckUSDT"], // Assuming the pool symbol is "DKP_ckUSDT"
      userDetails.dkpBalance
    ),
    nanasBalance: priceRoundedAmount(
      tokenPrices["nanas_ckUSDT"], // Assuming the pool symbol is "NANAS_ckUSDT"
      userDetails.nanasBalance
    ),
    nd64Balance: priceRoundedAmount(
      tokenPrices["ND64_ckUSDT"], // Assuming the pool symbol is "ND64_ckUSDT"
      userDetails.nd64Balance
    ),
    wtnBalance: priceRoundedAmount(
      tokenPrices["WTN_ckUSDT"], // Assuming the pool symbol is "WTN_ckUSDT"
      userDetails.wtnBalance
    ),
    nicpBalance: priceRoundedAmount(
      tokenPrices["nICP_ckUSDT"], // Assuming the pool symbol is "NICP_ckUSDT"
      userDetails.nicpBalance
    ),
    alpacalbBalance: priceRoundedAmount(
      tokenPrices["ALPACALB_ckUSDT"], // Assuming the pool symbol is "ALPACALB_ckUSDT"
      userDetails.alpacalbBalance
    ),
    partyBalance: priceRoundedAmount(
      tokenPrices["PARTY_ckUSDT"], // Assuming the pool symbol is "PARTY_ckUSDT"
      userDetails.partyBalance
    ),
    sneedBalance: priceRoundedAmount(
      tokenPrices["SNEED_ckUSDT"], // Assuming the pool symbol is "SNEED_ckUSDT"
      userDetails.sneedBalance
    ),
    clownBalance: priceRoundedAmount(
      tokenPrices["CLOWN_ckUSDT"], // Assuming the pool symbol is "CLOWN_ckUSDT"
      userDetails.clownBalance
    ),
    damonicBalance: priceRoundedAmount(
      tokenPrices["DAMONIC_ckUSDT"], // Assuming the pool symbol is "DAMONIC_ckUSDT"
      userDetails.damonicBalance
    ),
    exeBalance: priceRoundedAmount(
      tokenPrices["EXE_ckUSDT"], // Assuming the pool symbol is "EXE_ckUSDT"
      userDetails.exeBalance
    ),
    wumboBalance: priceRoundedAmount(
      tokenPrices["WUMBO_ckUSDT"], // Assuming the pool symbol is "WUMBO_ckUSDT"
      userDetails.wumboBalance
    ),
    mcsBalance: priceRoundedAmount(
      tokenPrices["MCS_ckUSDT"], // Assuming the pool symbol is "MCS_ckUSDT"
      userDetails.mcsBalance
    ),
    bobBalance: priceRoundedAmount(
      tokenPrices["BOB_ckUSDT"], // Assuming the pool symbol is "BOB_ckUSDT"
      userDetails.bobBalance
    ),
    burnBalance: priceRoundedAmount(
      tokenPrices["BURN_ckUSDT"], // Assuming the pool symbol is "BURN_ckUSDT"
      userDetails.burnBalance
    ),
    ntnBalance: priceRoundedAmount(
      tokenPrices["NTN_ckUSDT"], // Assuming the pool symbol is "NTN_ckUSDT"
      userDetails.ntnBalance
    ),
    dcdBalance: priceRoundedAmount(
      tokenPrices["DCD_ckUSDT"], // Assuming the pool symbol is "DCD_ckUSDT"
      userDetails.dcdBalance
    ),
    gldgovBalance: priceRoundedAmount(
      tokenPrices["GLDGOV_ckUSDT"], // Assuming the pool symbol is "GLDGOV_ckUSDT"
      userDetails.gldgovBalance
    ),
    owlBalance: priceRoundedAmount(
      tokenPrices["OWL_ckUSDT"], // Assuming the pool symbol is "OWL_ckUSDT"
      userDetails.owlBalance
    ),
    ogyBalance: priceRoundedAmount(
      tokenPrices["OGY_ckUSDT"], // Assuming the pool symbol is "OGY_ckUSDT"
      userDetails.ogyBalance
    ),
    fplBalance: priceRoundedAmount(
      tokenPrices["FPL_ckUSDT"], // Assuming the pool symbol is "FPL_ckUSDT"
      userDetails.fplBalance
    ),
    dittoBalance: priceRoundedAmount(
      tokenPrices["DITTO_ckUSDT"], // Assuming the pool symbol is "DITTO_ckUSDT"
      userDetails.dittoBalance
    ),
    icvcBalance: priceRoundedAmount(
      tokenPrices["ICVC_ckUSDT"], // Assuming the pool symbol is "ICVC_ckUSDT"
      userDetails.icvcBalance
    ),
  };
}

export const formatNumber = (number: BigInt, decimals: number) => {
  const bigNumberValue = new BigNumber(number.toString());
  const integerPart = bigNumberValue.integerValue();
  const decimalPart = bigNumberValue.decimalPlaces() || 0;

  // If the number is an integer or has fewer decimals than required, return as is
  if (decimalPart <= decimals || integerPart.toNumber() !== 0) {
    return bigNumberValue.toFormat(decimals, BigNumber.ROUND_DOWN);
  }

  // Otherwise, return the number formatted with the appropriate decimal places
  return bigNumberValue.toFormat(decimals, BigNumber.ROUND_DOWN);
};
