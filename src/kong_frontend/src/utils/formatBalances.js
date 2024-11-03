import BigNumber from "bignumber.js";
import { priceRoundedAmount } from "./priceDecimalConvertor";

export function formatBalances(userDetails, tokenPrices) {
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
    gldtBalance: priceRoundedAmount(
      tokenPrices["GLDT_ckUSDT"], // Assuming the pool symbol is "GLDT_ckUSDT"
      userDetails.gldtBalance
    ),
    ghostBalance: priceRoundedAmount(
      tokenPrices["GHOST_ckUSDT"], // Assuming the pool symbol is "GHOST_ckUSDT"
      userDetails.ghostBalance
    ),
    ctzBalance: priceRoundedAmount(
      tokenPrices["CTZ_ckUSDT"], // Assuming the pool symbol is "CTZ_ckUSDT"
      userDetails.ctzBalance
    ),
    elnaBalance: priceRoundedAmount(
      tokenPrices["ELNA_ckUSDT"], // Assuming the pool symbol is "ELNA_ckUSDT"
      userDetails.elnaBalance
    ),
    dogmiBalance: priceRoundedAmount(
      tokenPrices["DOGMIB_ckUSDT"], // Assuming the pool symbol is "DOGMI_ckUSDT"
      userDetails.dogmiBalance
    ),
    estBalance: priceRoundedAmount(
      tokenPrices["EST_ckUSDT"], // Assuming the pool symbol is "EST_ckUSDT"
      userDetails.estBalance
    ),
    pandaBalance: priceRoundedAmount(
      tokenPrices["PANDA_ckUSDT"], // Assuming the pool symbol is "PANDA_ckUSDT"
      userDetails.pandaBalance
    ),
    kinicBalance: priceRoundedAmount(
      tokenPrices["KINIC_ckUSDT"], // Assuming the pool symbol is "KINIC_ckUSDT"
      userDetails.kinicBalance
    ),
    dolrBalance: priceRoundedAmount(
      tokenPrices["DOLR_ckUSDT"], // Assuming the pool symbol is "DOLR_ckUSDT"
      userDetails.dolrBalance
    ),
    traxBalance: priceRoundedAmount(
      tokenPrices["TRAX_ckUSDT"], // Assuming the pool symbol is "TRAX_ckUSDT"
      userDetails.traxBalance
    ),
    motokoBalance: priceRoundedAmount(
      tokenPrices["MOTOKO_ckUSDT"], // Assuming the pool symbol is "MOTOKO_ckUSDT"
      userDetails.motokoBalance
    ),
    ckpepeBalance: priceRoundedAmount(
      tokenPrices["CKPEPE_ckUSDT"], // Assuming the pool symbol is "CKPEPE_ckUSDT"
      userDetails.ckpepeBalance
    ),
    ckshibBalance: priceRoundedAmount(
      tokenPrices["CKSHIB_ckUSDT"], // Assuming the pool symbol is "CKSHIB_ckUSDT"
      userDetails.ckshibBalance
    ),
    dodBalance: priceRoundedAmount(
      tokenPrices["DOD_ckUSDT"], // Assuming the pool symbol is "DOD_ckUSDT"
      userDetails.dodBalance
    ),
    kong1Balance: priceRoundedAmount(
      tokenPrices["KONG1_ckUSDT"], // Assuming the pool symbol is "KONG1_ckUSDT"
      userDetails.kong1Balance
    ),
    kong2Balance: priceRoundedAmount(
      tokenPrices["KONG2_ckUSDT"], // Assuming the pool symbol is "KONG2_ckUSDT"
      userDetails.kong2Balance
    ),
  };
}

export const formatNumber = (number, decimals) => {
  const bigNumberValue = new BigNumber(number);
  const integerPart = bigNumberValue.integerValue();
  const decimalPart = bigNumberValue.decimalPlaces();

  // If the number is an integer or has fewer decimals than required, return as is
  if (decimalPart <= decimals || integerPart.toNumber() !== 0) {
    return bigNumberValue.toFormat(decimals, BigNumber.ROUND_DOWN);
  }

  // Otherwise, return the number formatted with the appropriate decimal places
  return bigNumberValue.toFormat(decimals, BigNumber.ROUND_DOWN);
};
