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
  const [sortConfig, setSortConfig] = useState({ key: "symbol", direction: "ascending" });
  const queryParams = new URLSearchParams(location.search);
  const navigate = useNavigate();

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
    // Pre-calculate decimals map to avoid repeated calls
    const decimalsMap = new Map();
    const groupedPools = {};
    // Find the ckUSDC/ckUSDT pool
    const ckusdtCkusdcPool = poolsData.find(
      (pool) => pool.symbol_1 === "ckUSDT" && pool.symbol_0 === "ckUSDC"
    );

    // Get decimals for both tokens
    const ckusdcDecimals = getTokenDecimals("ckUSDC");
    const ckusdtDecimals = getTokenDecimals("ckUSDT");

    // Adjust balances for decimals
    const ckusdcBalance = new BigNumber(ckusdtCkusdcPool.balance_0).dividedBy(
      new BigNumber(10).pow(ckusdcDecimals)
    );
    const ckusdtBalance = new BigNumber(ckusdtCkusdcPool.balance_1).dividedBy(
      new BigNumber(10).pow(ckusdtDecimals)
    );

    // Calculate ckUSDT price (ckUSDC/ckUSDT)
    const ckusdtPrice = ckusdcBalance.dividedBy(ckusdtBalance);

    // Initialize price map (ckUSDC is pegged to 1 USD)
    const tokenUsdPrices = new Map([
      ["ckUSDC", new BigNumber(1)],
      ["ckUSDT", ckusdtPrice],
    ]);

    // Pre-calculate common BigNumber values
    const TEN = new BigNumber(10);
    const USD_DECIMALS = TEN.pow(6);

    // Helper function to get/cache decimals
    const getDecimalsCached = (symbol) => {
      if (!decimalsMap.has(symbol)) {
        decimalsMap.set(symbol, getTokenDecimals(symbol));
      }
      return decimalsMap.get(symbol);
    };

    // Helper function to calculate adjusted balance
    const getAdjustedBalance = (balance, decimals) => {
      return new BigNumber(balance.toString()).dividedBy(TEN.pow(decimals));
    };

    // First pass: Calculate USD prices
    let foundNewPrice;
    do {
      foundNewPrice = false;
      for (const pool of poolsData) {
        const { symbol_0, symbol_1, balance_0, balance_1 } = pool;

        // Skip if both prices are known
        if (tokenUsdPrices.has(symbol_0) && tokenUsdPrices.has(symbol_1))
          continue;

        // Get cached decimals
        const decimals0 = getDecimalsCached(symbol_0);
        const decimals1 = getDecimalsCached(symbol_1);

        // Calculate price once
        const balance0Adjusted = getAdjustedBalance(balance_0, decimals0);
        const balance1Adjusted = getAdjustedBalance(balance_1, decimals1);
        const price = balance1Adjusted.dividedBy(balance0Adjusted);

        // Update prices if possible
        if (!tokenUsdPrices.has(symbol_0) && tokenUsdPrices.has(symbol_1)) {
          tokenUsdPrices.set(
            symbol_0,
            tokenUsdPrices.get(symbol_1).multipliedBy(price)
          );
          foundNewPrice = true;
        } else if (
          tokenUsdPrices.has(symbol_0) &&
          !tokenUsdPrices.has(symbol_1)
        ) {
          tokenUsdPrices.set(
            symbol_1,
            tokenUsdPrices.get(symbol_0).dividedBy(price)
          );
          foundNewPrice = true;
        }
      }
    } while (foundNewPrice);

    // Second pass: Build grouped pools
    for (const pool of poolsData) {
      const poolWithUsdPrice = { ...pool };
      const decimals0 = getDecimalsCached(pool.symbol_0);
      const decimals1 = getDecimalsCached(pool.symbol_1);

      // Calculate adjusted balances and price once
      const balance0Adjusted = getAdjustedBalance(pool.balance_0, decimals0);
      const balance1Adjusted = getAdjustedBalance(pool.balance_1, decimals1);
      const price = balance1Adjusted.dividedBy(balance0Adjusted);
      poolWithUsdPrice.price = price.toString();

      // Calculate volume once
      const volume24h = new BigNumber(pool.rolling_24h_volume)
        .dividedBy(USD_DECIMALS)
        .toNumber();
      poolWithUsdPrice.rolling_24h_volume_calc = volume24h;

      // Add USD prices if available
      if (
        tokenUsdPrices.has(pool.symbol_0) &&
        tokenUsdPrices.has(pool.symbol_1)
      ) {
        poolWithUsdPrice.priceUsd0 = tokenUsdPrices
          .get(pool.symbol_0)
          .toString();
        poolWithUsdPrice.priceUsd1 = tokenUsdPrices
          .get(pool.symbol_1)
          .toString();
      }

      // Process both tokens
      [pool.symbol_0, pool.symbol_1].forEach((symbol) => {
        if (!groupedPools[symbol]) {
          groupedPools[symbol] = {
            symbol,
            pools: [],
            totalTvl: new BigNumber(0),
            total24hVolume: new BigNumber(0),
            weightedApy: new BigNumber(0),
            priceInUSD: tokenUsdPrices.get(symbol) || null,
          };
        }

        const tvl = new BigNumber(pool.tvl.replace(/,/g, ""));
        const apy = new BigNumber(pool.apy);

        groupedPools[symbol].pools.push(poolWithUsdPrice);
        groupedPools[symbol].totalTvl = groupedPools[symbol].totalTvl.plus(tvl);
        groupedPools[symbol].weightedApy = groupedPools[
          symbol
        ].weightedApy.plus(tvl.multipliedBy(apy));
        groupedPools[symbol].total24hVolume =
          groupedPools[symbol].total24hVolume.plus(volume24h);
      });
    }

    // Final calculations
    Object.values(groupedPools).forEach((group) => {
      group.weightedPrice = group.priceInUSD
        ? formatNumberCustom(group.priceInUSD.toNumber(), 6)
        : "N/A";
      group.weightedApy = group.totalTvl.isGreaterThan(0)
        ? group.weightedApy.dividedBy(group.totalTvl).toFixed(2)
        : "0.00";
      group.totalTvl = formatNumberCustom(group.totalTvl.toNumber(), 0);
      group.total24hVolume = formatNumberCustom(
        group.total24hVolume.toNumber(),
        2
      );
    });

    return groupedPools;
  };

  const firstNonZeroDecimals = (number, maxDecimals) => {
    if (!number) return "0.00";

    // Convert to string once and handle integer part
    const numStr = number.toString();
    const [integerPart, decimalPart = ""] = numStr.split(".");
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Early return for no decimals
    if (!decimalPart) return `${formattedInteger}.00`;

    // Use regex to find first non-zero and the digit after it
    const nonZeroMatch = decimalPart.match(/^0*([1-9]\d?)/);

    if (!nonZeroMatch) {
      // No non-zero digits found
      return `${formattedInteger}.00`;
    }

    return `${formattedInteger}.${nonZeroMatch[0]}`;
  };

  // Sorting function
  const sortedPools = useMemo(() => {
    if (!sortConfig.key) return Object.values(pools);

    const valueGetters = {
      symbol: ({ symbol }) => symbol,
      price: ({ priceInUSD }) => new BigNumber(priceInUSD),
      tvl: ({ totalTvl }) => new BigNumber(totalTvl.replace(/,/g, "")),
      volume: ({ total24hVolume }) => new BigNumber(total24hVolume.replace(/,/g, "")),
      apy: ({ weightedApy }) => new BigNumber(weightedApy)
    };

    const getValue = valueGetters[sortConfig.key] || (() => 0);
    const direction = sortConfig.direction === "ascending" ? 1 : -1;
    
    return Object.values(pools).sort((a, b) => {
      const [aVal, bVal] = [getValue(a), getValue(b)];
      return (aVal instanceof BigNumber ? aVal.comparedTo(bVal) : aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * direction;
    });
  }, [pools, sortConfig.key, sortConfig.direction]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
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
        const tvl = formatNumberCustom(balance / 10 ** decimals1, 0);

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
              <text
                x="10%"
                y="107"
                dominantBaseline="left"
                textAnchor="start">
                24H VOLUME
              </text>
              <text x="90%" y="107" dominantBaseline="right" textAnchor="end">
                ${formatNumberCustom(poolsTotals.totalVolume, 0)}
              </text>
              <text
                x="10%"
                y="150"
                dominantBaseline="left"
                textAnchor="start">
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
            <div className="stats-table-head">
              <div className="stats-table-head__content">
                <div
                  className="stats-table-head-pool clickable"
                  onClick={() => requestSort("symbol")}
                >
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
                  onClick={() => requestSort("price")}
                >
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
                  onClick={() => requestSort("tvl")}
                >
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
                  onClick={() => requestSort("volume")}
                >
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
                  onClick={() => requestSort("apy")}
                >
                  AVG APY
                  {sortConfig.key === "apy" ? (
                    sortConfig.direction === "ascending" ? (
                      <span className="sort-direction"> ▲</span>
                    ) : (
                      <span className="sort-direction"> ▼</span>
                    )
                  ) : null}
                </div>
                <div className="stats-table-head-apr">Expand</div>
              </div>
            </div>
            <div className="stats-table-body">
              {sortedPools.map((tokenGroup) => (
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
                        ${firstNonZeroDecimals(tokenGroup.weightedPrice, 6)}
                      </span>
                    </div>
                    <div className="stats-table-cell stats-table-cell-tvl">
                      <span className="stats-table-cell-value">
                        ${tokenGroup.totalTvl}
                      </span>
                    </div>
                    <div className="stats-table-cell stats-table-cell-totalvol">
                      <span className="stats-table-cell-value">
                        ${tokenGroup.total24hVolume}
                      </span>
                    </div>
                    <div className="stats-table-cell stats-table-cell-apr">
                      <span className="stats-table-cell-value">
                        {tokenGroup.weightedApy}
                        <span className="percentage-symbol">%</span>
                      </span>
                    </div>
                    <div className="stats-table-cell stats-table-cell-controls">
                      {expandedToken === tokenGroup.symbol ? (
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
                  </div>

                  {expandedToken === tokenGroup.symbol && (
                    <div className="stats-table-expanded">
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
                            {(() => {
                              let displayPriceUsd;
                              if (pool.symbol_0 === "ckUSDT") {
                                displayPriceUsd = pool.priceUsd1; // Price of symbol_1 (the other token)
                              } else if (pool.symbol_1 === "ckUSDT") {
                                displayPriceUsd = pool.priceUsd0; // Price of symbol_0 (the other token)
                              } else {
                                // If neither token is ckUSDT, display the price of the token that matches the token group symbol
                                displayPriceUsd =
                                  tokenGroup.symbol === pool.symbol_0
                                    ? pool.priceUsd0
                                    : pool.priceUsd1;
                              }

                              return (
                                <span>
                                  ${firstNonZeroDecimals(displayPriceUsd, 6)}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="stats-table-cell">
                            <span>${formatNumberCustom(pool.tvl, 0)}</span>
                          </div>
                          <div className="stats-table-cell">
                            <span>
                              ${pool.rolling_24h_volume_calc.toFixed(2)}
                            </span>
                          </div>
                          <div className="stats-table-cell">
                            <span>{formatNumberCustom(pool.apy, 2)}%</span>
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
