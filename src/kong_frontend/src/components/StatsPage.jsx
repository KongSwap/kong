import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import kongImage from "../../../assets/kong.png";
import cloud1 from "../../../assets/cloud-1.png";
import cloud2 from "../../../assets/cloud-2.png";
import panelGroundBg from "../../../assets/panel-ground-bg.png";
import panelGroundBgMobile from "../../../assets/panel-ground-bg-mobile.png";
import FooterSocials from "./FooterSocials";
import tokenFullNames from "../constants/tokenFullNames";

function StatsPage({ poolInfo, tokenDetails, tokenImages, poolsTotals }) {
  const [pools, setPools] = useState([]);
  const [expandedToken, setExpandedToken] = useState(null);
  const [viewTab, setViewTab] = useState("stats");
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
    const groupedPools = {};

    // First pass: collect all direct price information
    poolsData.forEach((pool) => {
      [pool.symbol_0, pool.symbol_1].forEach((symbol) => {
        if (!groupedPools[symbol]) {
          groupedPools[symbol] = {
            symbol,
            pools: [],
            totalTvl: 0,
            total24hVolume: 0,
            prices: [],
            weightedApy: 0,
            priceInCkUSDT: null,
          };
        }
        groupedPools[symbol].pools.push(pool);

        const tvl = Number(pool.tvl.replace(/,/g, ""));
        const volume = Number(pool.roll24hVolume.replace(/,/g, ""));
        const apy = Number(pool.apy);

        groupedPools[symbol].totalTvl += tvl;
        groupedPools[symbol].total24hVolume += volume;
        groupedPools[symbol].weightedApy += tvl * apy;

        // Calculate price in terms of ckUSDT
        if (pool.symbol_0 === symbol && pool.symbol_1 === "ckUSDT") {
          groupedPools[symbol].priceInCkUSDT = Number(pool.price);
        } else if (pool.symbol_1 === symbol && pool.symbol_0 === "ckUSDT") {
          groupedPools[symbol].priceInCkUSDT = 1 / Number(pool.price);
        }
      });
    });

    // Second pass: calculate indirect prices through intermediary pairs
    Object.values(groupedPools).forEach((group) => {
      if (!group.priceInCkUSDT) {
        // Look for indirect price routes through other tokens
        group.pools.forEach((pool) => {
          const otherSymbol = pool.symbol_0 === group.symbol ? pool.symbol_1 : pool.symbol_0;
          const otherGroup = groupedPools[otherSymbol];
          
          if (otherGroup?.priceInCkUSDT) {
            const priceInOther = pool.symbol_0 === group.symbol ? Number(pool.price) : 1 / Number(pool.price);
            group.priceInCkUSDT = priceInOther * otherGroup.priceInCkUSDT;
          }
        });
      }
      
      // Calculate weighted price
      group.weightedPrice = group.priceInCkUSDT 
        ? formatNumberCustom(group.priceInCkUSDT, 2)
        : "0.00";

      group.weightedApy = group.totalTvl > 0
        ? (group.weightedApy / group.totalTvl).toFixed(2)
        : "0.00";

      group.totalTvl = formatNumberCustom(group.totalTvl, 0);
      group.total24hVolume = formatNumberCustom(group.total24hVolume, 0);

      delete group.prices;
      delete group.priceInCkUSDT;
    });

    return groupedPools;
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
            <text x="10%" y="50" dominant-baseline="left" text-anchor="start">
              TOTAL TVL
            </text>
            <text x="90%" y="50" dominant-baseline="right" text-anchor="end">
              ${formatNumberCustom(poolsTotals.totalTvl, 0)}
            </text>
            <text x="10%" y="66" dominant-baseline="left" text-anchor="start">
              24H VOLUME
            </text>
            <text x="90%" y="66" dominant-baseline="right" text-anchor="end">
              ${formatNumberCustom(poolsTotals.totalVolume, 0)}
            </text>
            <text x="10%" y="83" dominant-baseline="left" text-anchor="start">
              24H FEES
            </text>
            <text x="90%" y="83" dominant-baseline="right" text-anchor="end">
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
              <text x="10%" y="65" dominant-baseline="left" text-anchor="start">
                TOTAL TVL
              </text>
              <text x="90%" y="65" dominant-baseline="right" text-anchor="end">
                ${formatNumberCustom(poolsTotals.totalTvl, 0)}
              </text>
              <text
                x="10%"
                y="107"
                dominant-baseline="left"
                text-anchor="start">
                24H VOLUME
              </text>
              <text x="90%" y="107" dominant-baseline="right" text-anchor="end">
                ${formatNumberCustom(poolsTotals.totalVolume, 0)}
              </text>
              <text
                x="10%"
                y="150"
                dominant-baseline="left"
                text-anchor="start">
                24H FEES
              </text>
              <text x="90%" y="150" dominant-baseline="right" text-anchor="end">
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
                <div className="stats-table-head-pool">TOKEN</div>
                <div className="stats-table-head-price">PRICE</div>
                <div className="stats-table-head-tvl">TOTAL TVL</div>
                <div className="stats-table-head-totalvol">24H VOLUME</div>
                <div className="stats-table-head-apr">AVG APY</div>
                <div className="stats-table-head-apr">Expand</div>
              </div>
            </div>
            <div className="stats-table-body">
              {Object.values(pools).map((tokenGroup) => (
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
                        ${tokenGroup.weightedPrice}
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
                          stroke-width="1.5"
                          stroke="currentColor"
                          style={{ width: "12px", height: "12px" }}>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m4.5 15.75 7.5-7.5 7.5 7.5"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          style={{ width: "12px", height: "12px" }}>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
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
                            <span>${formatNumberCustom(pool.price, 2)}</span>
                          </div>
                          <div className="stats-table-cell">
                            <span>${formatNumberCustom(pool.tvl, 0)}</span>
                          </div>
                          <div className="stats-table-cell">
                            <span>
                              ${formatNumberCustom(pool.roll24hVolume, 0)}
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
