import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import kongImage from "../../../assets/kong.png";
import cloud1 from "../../../assets/cloud-1.png";
import cloud2 from "../../../assets/cloud-2.png";
import panelGroundBg from "../../../assets/panel-ground-bg.png";
import panelGroundBgMobile from "../../../assets/panel-ground-bg-mobile.png";
import FooterSocials from "./FooterSocials";
import tokenFullNames from "../constants/tokenFullNames";
import BigNumber from "bignumber.js";

function StatsPage({ poolInfo, tokenDetails, tokenImages, poolsTotals }) {
  const [pools, setPools] = useState([]);
  const [expandedToken, setExpandedToken] = useState(null);
  const [viewTab, setViewTab] = useState("stats");
  const [sortConfig, setSortConfig] = useState({
    key: "tvl",
    direction: "descending",
  });
  const queryParams = new URLSearchParams(location.search);
  const navigate = useNavigate();
  const [tokenSearchTerm, setTokenSearchTerm] = useState("");

  const onTabClick = (tab, pool) => {
    queryParams.set("viewtab", tab);
    queryParams.set("pool", pool);
    navigate(`/?${queryParams.toString()}`, { replace: true });
  };

  const formatNumberCustom = (number, maxDecimals) => {
    const parts = number.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (maxDecimals > 0) {
      const decimalPart = (parts[1] || "")
        .padEnd(maxDecimals, "0")
        .substring(0, maxDecimals);
      return `${integerPart}.${decimalPart}`;
    } else {
      return integerPart;
    }
  };

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

  // Updated function to group pools by token
  const groupPoolsByToken = (poolsData) => {
    const groupedPools = {};
    
    // Find the ICP/ckUSDT pool to get ICP price
    const icpUsdtPool = poolsData.find(pool => 
      pool.symbol_0 === "ICP" && pool.symbol_1 === "ckUSDT"
    );
    const icpPrice = icpUsdtPool ? new BigNumber(icpUsdtPool.price) : new BigNumber(0);

    poolsData.forEach(pool => {
      // Calculate USD price for the pool
      let priceUsd;
      const priceBigNum = new BigNumber(pool.price);

      // Price calculation logic with rounding
      if (pool.symbol_1 === "ckUSDT") {
        priceUsd = priceBigNum;
      } else if (pool.symbol_1 === "ICP") {
        priceUsd = priceBigNum.multipliedBy(icpPrice);
      } else {
        priceUsd = new BigNumber(0);
      }
      
      pool.priceUsd = priceUsd;
      // Remove commas before converting String to BigNumber
      pool.tvl = new BigNumber(pool.tvl.replace(/,/g, "")); 
      pool.apy = new BigNumber(pool.apy.replace(/,/g, ""));
      // Convert volume BigInt to BigNumber and handle decimals
      pool.rolling_24h_volume_calc = new BigNumber(pool.rolling_24h_volume).dividedBy(10 ** 6);

      if(!groupedPools[pool.symbol_0]) {
        groupedPools[pool.symbol_0] = {
          symbol: pool.symbol_0,
          pools: [],
          total24hVolume: new BigNumber(0),
          totalTvl: new BigNumber(0),
          priceWeighted: new BigNumber(0),
          priceUsd: new BigNumber(0),
          weightedApy: new BigNumber(0)
        }
      }

      groupedPools[pool.symbol_0].pools.push(pool);
      
      // Accumulate values
      groupedPools[pool.symbol_0].total24hVolume = groupedPools[pool.symbol_0].total24hVolume.plus(pool.rolling_24h_volume_calc);
      groupedPools[pool.symbol_0].totalTvl = groupedPools[pool.symbol_0].totalTvl.plus(pool.tvl);
      groupedPools[pool.symbol_0].priceWeighted = groupedPools[pool.symbol_0].priceWeighted.plus(priceUsd.multipliedBy(pool.tvl));
      groupedPools[pool.symbol_0].weightedApy = groupedPools[pool.symbol_0].weightedApy.plus(pool.apy.multipliedBy(pool.tvl));
    });

    // Add ckUSDT to the groupedPools with fixed price of 1
    const ckUsdtPools = poolsData.filter(pool => pool.symbol_1 === "ckUSDT");
    const ckUsdtTotalTvl = ckUsdtPools.reduce((acc, pool) => acc.plus(pool.tvl), new BigNumber(0));
    const ckUsdtWeightedApy = ckUsdtPools.reduce((acc, pool) => acc.plus(pool.apy.multipliedBy(pool.tvl)), new BigNumber(0));

    groupedPools["ckUSDT"] = {
      symbol: "ckUSDT",
      pools: ckUsdtPools,
      total24hVolume: ckUsdtPools.reduce((acc, pool) => acc.plus(pool.rolling_24h_volume_calc), new BigNumber(0)),
      totalTvl: ckUsdtTotalTvl,
      priceWeighted: new BigNumber(1),
      priceUsd: new BigNumber(1),
      weightedApy: ckUsdtTotalTvl.isZero() ? new BigNumber(0) : ckUsdtWeightedApy.dividedBy(ckUsdtTotalTvl)
    };

    // Calculate final values for each group
    Object.values(groupedPools).forEach(token => {
      // Skip price calculation for ckUSDT
      if (!token.totalTvl.isZero() && token.symbol !== "ckUSDT") {
        token.priceUsd = token.priceWeighted.dividedBy(token.totalTvl);
        token.weightedApy = token.weightedApy.dividedBy(token.totalTvl);
      }

      // Convert to strings for display with 2 decimal places
      token.totalTvl = token.totalTvl.toFormat(0);
      token.priceUsd = token.priceUsd.toFormat(8);
      token.weightedApy = token.weightedApy.toFormat(2);
      token.total24hVolume = token.total24hVolume.toFormat(2);
    });

    return groupedPools;
  };

  const formatToNextSignificantDigit = (number, maxDecimals) => {
    if (!number) return "0.00";
    
    const numStr = number.toString();
    const [integerPart, decimalPart = ""] = numStr.split(".");
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (!decimalPart) return `${formattedInteger}.00`;
  
    const firstNonZeroPos = decimalPart.search(/[1-9]/);
    if (firstNonZeroPos === -1) return `${formattedInteger}.00`;  // If no non-zero digits found in decimal
  
    // Get leading zeros plus significant digits
    const leadingZeros = decimalPart.slice(0, firstNonZeroPos);
    
    // If integer part is 0, show 2 digits after first significant digit
    if (integerPart === "0") {
      const significantDigits = decimalPart.slice(firstNonZeroPos, firstNonZeroPos + 3);
      const paddedSignificantDigits = significantDigits.padEnd(3, '0');
      return `${formattedInteger}.${leadingZeros}${paddedSignificantDigits}`;
    }
    
    // Otherwise show 2 significant digits total
    const significantDigits = decimalPart.slice(firstNonZeroPos, firstNonZeroPos + 2);
    const paddedSignificantDigits = significantDigits.padEnd(2, '0');
    return `${formattedInteger}.${leadingZeros}${paddedSignificantDigits}`;
  };

  // Sorting function
  const sortedPools = useMemo(() => {
    if (!sortConfig.key) return Object.values(pools);

    const valueGetters = {
      symbol: ({ symbol }) => symbol?.toLowerCase() || '',
      price: ({ priceUsd }) => {
        return new BigNumber(priceUsd.replace(/,/g, '').replace('$', ''));
      },
      tvl: ({ totalTvl }) => new BigNumber(totalTvl.replace(/,/g, '')),
      volume: ({ total24hVolume }) => new BigNumber(total24hVolume.replace(/,/g, '')),
      apy: ({ weightedApy }) => new BigNumber(weightedApy.replace(/,/g, '')),
    };

    const getValue = valueGetters[sortConfig.key] || (() => 0);
    const direction = sortConfig.direction === "ascending" ? 1 : -1;

    return Object.values(pools).sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      
      // Special handling for symbol sorting
      if (sortConfig.key === 'symbol') {
        return direction * aVal.localeCompare(bVal);
      }
      
      // Handle BigNumber comparisons
      if (aVal instanceof BigNumber && bVal instanceof BigNumber) {
        return aVal.comparedTo(bVal) * direction;
      }
      
      // Handle other comparisons
      return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * direction;
    });
  }, [pools, sortConfig.key, sortConfig.direction]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (poolInfo && tokenDetails.length > 0) {
      const updatedPools = poolInfo.map((pool) => {
        const balance = Number(pool.balance || 0);
        const decimals1 = getTokenDecimals(pool.symbol_1);

        const apy = formatNumberCustom(Number(pool.rolling_24h_apy || 0), 2);
        const roll24hVolume = formatNumberCustom(
          Number(pool.rolling_24h_volume || 0) / 10 ** decimals1,
          0
        );
        const tvl = formatNumberCustom(balance / 10 ** 6, 0);

        return {
          ...pool,
          apy,
          roll24hVolume,
          tvl,
        };
      });
      setPools(groupPoolsByToken(updatedPools));
    }
  }, [poolInfo, tokenDetails]);

  return (
    <main className="stats-page-main">
      <span className="stats-page-title-as-image"></span>
      <section className="stats-page-section">
        <div className="stats-page-kong-panel-container-mobile">
          <img
            src={cloud2}
            className="stats-page-kong-panel-cloud-behind"
            alt=""
          />
          <img
            src={panelGroundBgMobile}
            className="stats-page-kong-panel-ground-bg-mobile"
            alt=""
          />
          <img
            src={cloud1}
            className="stats-page-kong-panel-cloud-left"
            alt=""
          />
          <img
            src={cloud2}
            className="stats-page-kong-panel-cloud-right"
            alt=""
          />

          <svg
            className="stats-page-kong-panel-ground-text-mobile"
            version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            x="0px"
            y="0px"
            viewBox="0 0 320 125"
            style={{ enableBackground: "new 0 0 320 125" }}>
            <text x="10%" y="50" dominantBaseline="left" textAnchor="start">
              TOTAL TVL
            </text>
            <text x="90%" y="50" dominantBaseline="right" textAnchor="end">
              ${formatNumberCustom(poolsTotals.totalTvl, 0)}
            </text>
            <text x="10%" y="66" dominantBaseline="left" textAnchor="start">
              24H VOLUME
            </text>
            <text x="90%" y="66" dominantBaseline="right" textAnchor="end">
              ${formatNumberCustom(poolsTotals.totalVolume, 0)}
            </text>
            <text x="10%" y="83" dominantBaseline="left" textAnchor="start">
              24H FEES
            </text>
            <text x="90%" y="83" dominantBaseline="right" textAnchor="end">
              ${formatNumberCustom(poolsTotals.totalFees, 0)}
            </text>
          </svg>
        </div>

        {/* Desktop Total Stats */}
        <div className="stats-page-leftcolumn">
          <div className="stats-page-tabs">
            {/* div left to preserve spacing */}
          </div>
          <div className="stats-page-kong-panel-container">
            <img
              src={panelGroundBg}
              className="stats-page-kong-panel-ground-bg"
              alt=""
            />

            <svg
              className="stats-page-kong-panel-ground-text"
              version="1.1"
              id="Layer_1"
              xmlns="http://www.w3.org/2000/svg"
              x="0px"
              y="0px"
              viewBox="0 0 320 375"
              style={{ enableBackground: "new 0 0 320 375" }}>
              <text x="10%" y="65" dominantBaseline="left" textAnchor="start">
                TOTAL TVL
              </text>
              <text x="90%" y="65" dominantBaseline="right" textAnchor="end">
                ${formatNumberCustom(poolsTotals.totalTvl, 0)}
              </text>
              <text x="10%" y="107" dominantBaseline="left" textAnchor="start">
                24H VOLUME
              </text>
              <text x="90%" y="107" dominantBaseline="right" textAnchor="end">
                ${formatNumberCustom(poolsTotals.totalVolume, 0)}
              </text>
              <text x="10%" y="150" dominantBaseline="left" textAnchor="start">
                24H FEES
              </text>
              <text x="90%" y="150" dominantBaseline="right" textAnchor="end">
                ${formatNumberCustom(poolsTotals.totalFees, 0)}
              </text>
            </svg>
          </div>
        </div>

        {viewTab === "stats" ? (
          <div className="stats-table">
            <div className="stats-table-twrap">
              <span>*** </span>
              <h2>Overview of Kong Tokens</h2>
              <span> ***</span>
            </div>

            <div className="stats-search-wrapper">
              <input
                type="text"
                className="stats-search"
                placeholder="Search tokens by symbol"
                value={tokenSearchTerm}
                onChange={(e) => setTokenSearchTerm(e.target.value)}
              />
            </div>

            <div className="stats-table-head">
              <div className="stats-table-head__content">
                <div
                  className="stats-table-head-pool clickable"
                  onClick={() => requestSort("symbol")}>
                  TOKEN
                  {sortConfig.key === "symbol" ? (
                    sortConfig.direction === "ascending" ? (
                      <span className="sort-direction"> ▲</span>
                    ) : (
                      <span className="sort-direction"> ▼</span>
                    )
                  ) : null}
                </div>
                <div
                  className="stats-table-head-price clickable"
                  onClick={() => requestSort("price")}>
                  PRICE
                  {sortConfig.key === "price" ? (
                    sortConfig.direction === "ascending" ? (
                      <span className="sort-direction"> ▲</span>
                    ) : (
                      <span className="sort-direction"> ▼</span>
                    )
                  ) : null}
                </div>
                <div
                  className="stats-table-head-tvl clickable"
                  onClick={() => requestSort("tvl")}>
                  TOTAL TVL
                  {sortConfig.key === "tvl" ? (
                    sortConfig.direction === "ascending" ? (
                      <span className="sort-direction"> ▲</span>
                    ) : (
                      <span className="sort-direction"> ▼</span>
                    )
                  ) : null}
                </div>
                <div
                  className="stats-table-head-totalvol clickable"
                  onClick={() => requestSort("volume")}>
                  24H VOLUME
                  {sortConfig.key === "volume" ? (
                    sortConfig.direction === "ascending" ? (
                      <span className="sort-direction"> ▲</span>
                    ) : (
                      <span className="sort-direction"> ▼</span>
                    )
                  ) : null}
                </div>
                <div
                  className="stats-table-head-apr clickable"
                  onClick={() => requestSort("apy")}>
                  AVG APY
                  {sortConfig.key === "apy" ? (
                    sortConfig.direction === "ascending" ? (
                      <span className="sort-direction"> ▲</span>
                    ) : (
                      <span className="sort-direction"> ▼</span>
                    )
                  ) : null}
                </div>
              </div>
            </div>
            <div className="stats-table-body">
              {sortedPools
                .filter(
                  (tokenGroup) =>
                    tokenGroup.symbol
                      ?.toLowerCase()
                      ?.includes(tokenSearchTerm?.toLowerCase()) ||
                    tokenGroup.canisterId
                      ?.toLowerCase()
                      ?.includes(tokenSearchTerm?.toLowerCase()) ||
                    tokenGroup.name
                      ?.toLowerCase()
                      ?.includes(tokenSearchTerm?.toLowerCase())
                )
                .map((tokenGroup) => (
                  <React.Fragment key={tokenGroup.symbol}>
                    <div
                      className="stats-table-row clickable"
                      onClick={() =>
                        setExpandedToken(
                          expandedToken === tokenGroup.symbol
                            ? null
                            : tokenGroup.symbol
                        )
                      }>
                      <div className="stats-table-cell stats-table-cell-pool">
                        <div className="stats-table-logos">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              paddingRight: "8px",
                            }}>
                            {expandedToken !== tokenGroup.symbol ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                style={{ width: "12px", height: "12px" }}>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m4.5 15.75 7.5-7.5 7.5 7.5"
                                />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                style={{ width: "12px", height: "12px" }}>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                                />
                              </svg>
                            )}
                          </div>
                          <img
                            src={tokenImages[tokenGroup.symbol]}
                            className="stats-table-token"
                            alt={tokenGroup.symbol}
                          />
                        </div>
                        <span className="stats-table-tokenname">
                          {tokenGroup.symbol}
                        </span>
                      </div>
                      <div className="stats-table-cell stats-table-cell-price">
                        <span className="stats-table-cell-value">
                          ${formatToNextSignificantDigit(tokenGroup.priceUsd, 6)}
                        </span>
                      </div>
                      <div className="stats-table-cell stats-table-cell-tvl">
                        <span className="stats-table-cell-value">
                          ${formatNumberCustom(tokenGroup.totalTvl, 0)}
                        </span>
                      </div>
                      <div className="stats-table-cell stats-table-cell-totalvol">
                        <span className="stats-table-cell-value">
                          ${tokenGroup.total24hVolume}
                        </span>
                      </div>
                      <div className="stats-table-cell stats-table-cell-apr">
                        <span className="stats-table-cell-value">
                          {formatToNextSignificantDigit(tokenGroup.weightedApy, 1)}
                          <span className="percentage-symbol">%</span>
                        </span>
                      </div>
                    </div>

                    {expandedToken === tokenGroup.symbol && (
                      <div className="stats-table-expanded">
                        <div className="stats-table-expanded-header">
                          <span className="stats-table-tokenname-subtitle">
                            <strong style={{ fontWeight: "bold" }}>
                              {tokenGroup.symbol} Canister ID
                            </strong>
                            {tokenGroup.pools?.at(0)?.address_0}
                          </span>
                        </div>

                        {/* Add header row for the expanded section */}
                        <div className="stats-table-subrow stats-table-subrow-header">
                          <div className="stats-table-cell stats-table-cell-pool-expanded">
                            Pool
                          </div>
                          <div className="stats-table-cell">Price</div>
                          <div className="stats-table-cell">TVL</div>
                          <div className="stats-table-cell">Volume</div>
                          <div className="stats-table-cell">APY</div>
                          <div className="stats-table-cell stats-table-cell-controls">
                            Actions
                          </div>
                        </div>

                        {/* Existing pool rows */}
                        {tokenGroup.pools.map((pool, index) => (
                          <div className="stats-table-subrow" key={index}>
                            <div className="stats-table-cell stats-table-cell-pool-expanded">
                              <div className="stats-table-logos">
                                <img
                                  src={tokenImages[pool.symbol_0]}
                                  alt={pool.symbol_0}
                                  style={{ zIndex: 2 }}
                                />
                                <img
                                  src={tokenImages[pool.symbol_1]}
                                  alt={pool.symbol_1}
                                  style={{ marginLeft: "-12px", zIndex: 1 }}
                                />
                              </div>
                              <span style={{ width: "100%" }}>
                                {pool.symbol_0}/{pool.symbol_1}
                              </span>
                            </div>
                            <div className="stats-table-cell">
                          
                                  <span>
                                    ${formatToNextSignificantDigit(pool.priceUsd, 6)}
                                  </span>
                      
                            </div>
                            <div className="stats-table-cell">
                              <span>${formatNumberCustom(pool.tvl, 0)}</span>
                            </div>
                            <div className="stats-table-cell">
                              <span>
                                ${formatToNextSignificantDigit(pool.rolling_24h_volume_calc, 0)}
                              </span>
                            </div>
                            <div className="stats-table-cell">
                              <span>{formatToNextSignificantDigit(pool.apy, 1)}%</span>
                            </div>
                            <div className="stats-table-cell stats-table-cell-controls">
                              <span
                                onClick={() =>
                                  onTabClick("swap", pool.lp_token_symbol)
                                }
                                className="buttonsmall-green stats-table-controlbtn">
                                <span className="buttonsmall-green__pressed">
                                  <span className="buttonsmall-green__pressed__l"></span>
                                  <span className="buttonsmall-green__pressed__mid"></span>
                                  <span className="buttonsmall-green__pressed__r"></span>
                                </span>
                                <span className="buttonsmall-green__selected">
                                  <span className="buttonsmall-green__selected__l"></span>
                                  <span className="buttonsmall-green__selected__mid"></span>
                                  <span className="buttonsmall-green__selected__r"></span>
                                </span>
                                <span className="buttonsmall-green__default">
                                  <span className="buttonsmall-green__default__l"></span>
                                  <span className="buttonsmall-green__default__mid"></span>
                                  <span className="buttonsmall-green__default__r"></span>
                                </span>
                                <span className="buttonsmall-green__text">
                                  Swap
                                </span>
                              </span>
                              <span
                                onClick={() =>
                                  onTabClick("pools", pool.lp_token_symbol)
                                }
                                className="buttonsmall-green stats-table-controlbtn">
                                <span className="buttonsmall-green__pressed">
                                  <span className="buttonsmall-green__pressed__l"></span>
                                  <span className="buttonsmall-green__pressed__mid"></span>
                                  <span className="buttonsmall-green__pressed__r"></span>
                                </span>
                                <span className="buttonsmall-green__selected">
                                  <span className="buttonsmall-green__selected__l"></span>
                                  <span className="buttonsmall-green__selected__mid"></span>
                                  <span className="buttonsmall-green__selected__r"></span>
                                </span>
                                <span className="buttonsmall-green__default">
                                  <span className="buttonsmall-green__default__l"></span>
                                  <span className="buttonsmall-green__default__mid"></span>
                                  <span className="buttonsmall-green__default__r"></span>
                                </span>
                                <span className="buttonsmall-green__text">
                                  Add Liquidity
                                </span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                ))}
            </div>
          </div>
        ) : viewTab === "tokens" ? (
          <div className="stats-table">
            <div className="stats-table-twrap">
              <span>*** </span>
              <h2>Canister Contracts</h2>
              <span> ***</span>
            </div>
            <div className="statspage-tokenstable-head">
              <div className="statspage-tokenstable-head__content">
                <div className="stats-table-head-token">TOKEN</div>
                <div className="stats-table-head-symbol">SYMBOL</div>
                <div className="stats-table-head-address">CANISTER ADDRESS</div>
              </div>
            </div>

            <div className="statspage-tokenstable-body">
              {tokenDetails.map((token, index) => {
                const token_type = Object.keys(token)[0];
                if (token_type !== "IC") {
                  return null; // skip
                }
                token = token[token_type];
                return (
                  <div className="statspage-tokenstable-row" key={index}>
                    <div className="statspage-tokenstable-cell statspage-tokenstable-cell-token">
                      <div className="statspage-tokenstable-logo">
                        <img
                          src={tokenImages[token.symbol]}
                          className="statspage-tokenstable-token"
                          alt={token.symbol}
                        />
                      </div>
                      <span className="statspage-tokenstable-tokenname">
                        {token.name}
                      </span>
                    </div>

                    <div className="statspage-tokenstable-cell statspage-tokenstable-cell-symbol">
                      <span className="statspage-tokenstable-cell-value">
                        {token.symbol}
                      </span>
                    </div>

                    <div className="statspage-tokenstable-cell statspage-tokenstable-cell-address">
                      <span className="statspage-tokenstable-cell-value">
                        {token.canister_id}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <img
          src={kongImage}
          className="stats-page-kong-image-container"
          alt=""
        />
      </section>
      <FooterSocials />
    </main>
  );
}

export default StatsPage;
