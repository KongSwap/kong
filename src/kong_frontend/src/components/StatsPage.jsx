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
      const decimalPart = (parts[1] || "").padEnd(maxDecimals, '0').substring(0, maxDecimals);
      return `${integerPart}.${decimalPart}`;
    } else {
      return integerPart;
    }
  };

  const getTokenDecimals = (tokenSymbol) => {
    if (!tokenDetails) return null;
  
    // Remove the chain part (like 'IC.') from the token symbol you're passing
    const cleanedSymbol = tokenSymbol.includes(".") ? tokenSymbol.split(".")[1] : tokenSymbol;
  
    // Loop through each token object in the tokenDetails array
    for (const tokenObj of tokenDetails) {
      // Get the first key of the object to access the token details
      const tokenKey = Object.keys(tokenObj)[0];
      const token = tokenObj[tokenKey];
  
      // Remove the chain part from token.symbol
      const cleanedTokenSymbol = token.symbol.includes(".") ? token.symbol.split(".")[1] : token.symbol;
  
      // Check if the cleaned symbols match
      if (cleanedTokenSymbol === cleanedSymbol) {
        return token.decimals;
      }
    }
  
    return 8; // Default to 8 if the token is not found, adjust if necessary
  };


  useEffect(() => {
    if (poolInfo && tokenDetails.length > 0) {
      const updatedPools = poolInfo.map((pool) => {
        const balance = Number(pool.balance || 0);
        const decimals1 = getTokenDecimals(pool.symbol_1);

        const apy = formatNumberCustom(Number(pool.rolling_24h_apy || 0), 2);
        const roll24hVolume = formatNumberCustom(Number(pool.rolling_24h_volume || 0) / 10 ** decimals1, 0);
        const tvl = formatNumberCustom(balance / 10 ** decimals1, 0);

        return {
          ...pool,
          apy,
          roll24hVolume,
          tvl,
        };
      });
      setPools(updatedPools);
    }
  }, [poolInfo, tokenDetails]);

  return (
    <main className="stats-page-main">
      <span className="stats-page-title-as-image"></span>
      <section className="stats-page-section">
      
      <div className="stats-page-kong-panel-container-mobile">
          <img src={cloud2} className="stats-page-kong-panel-cloud-behind" alt="" />
          <img src={panelGroundBgMobile} className="stats-page-kong-panel-ground-bg-mobile" alt="" />
          <img src={cloud1} className="stats-page-kong-panel-cloud-left" alt="" />
          <img src={cloud2} className="stats-page-kong-panel-cloud-right" alt="" />
          
          <svg className="stats-page-kong-panel-ground-text-mobile" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
            viewBox="0 0 320 125" style={{ enableBackground: "new 0 0 320 125" }}>
            <text x="10%" y="50" dominant-baseline="left" text-anchor="start">TOTAL TVL</text> 
            <text x="90%" y="50" dominant-baseline="right" text-anchor="end">${formatNumberCustom(poolsTotals.totalTvl, 0)}</text> 
            <text x="10%" y="66" dominant-baseline="left" text-anchor="start">24H VOLUME</text> 
            <text x="90%" y="66" dominant-baseline="right" text-anchor="end">${formatNumberCustom(poolsTotals.totalVolume, 0)}</text> 
            <text x="10%" y="83" dominant-baseline="left" text-anchor="start">24H FEES</text> 
            <text x="90%" y="83" dominant-baseline="right" text-anchor="end">${formatNumberCustom(poolsTotals.totalFees, 0)}</text> 
          </svg>
        </div>
        
        {/* Desktop Total Stats */}
        <div className="stats-page-leftcolumn">
          <div className="stats-page-tabs">
            <span
              className={`stats-page-tab button-blue button-blue--stats ${viewTab === "stats" ? "button-blue--selected" : ""}`}
              onClick={() => setViewTab("stats")}
            >
              <span className="button-blue__pressed">
                <span className="button-blue__pressed__l"></span>
                <span className="button-blue__pressed__mid"></span>
                <span className="button-blue__pressed__r"></span>
              </span>
              <span className="button-blue__selected">
                <span className="button-blue__selected__l"></span>
                <span className="button-blue__selected__mid"></span>
                <span className="button-blue__selected__r"></span>
              </span>
              <span className="button-blue__default">
                <span className="button-blue__default__l"></span>
                <span className="button-blue__default__mid"></span>
                <span className="button-blue__default__r"></span>
              </span>
              <span className="button-blue__text">STATS</span>
            </span>
            <span
              className={`stats-page-tab button-blue button-blue--tokens ${viewTab === "tokens" ? "button-blue--selected" : ""}`}
              onClick={() => setViewTab("tokens")}
            >
              <span className="button-blue__pressed">
                <span className="button-blue__pressed__l"></span>
                <span className="button-blue__pressed__mid"></span>
                <span className="button-blue__pressed__r"></span>
              </span>
              <span className="button-blue__selected">
                <span className="button-blue__selected__l"></span>
                <span className="button-blue__selected__mid"></span>
                <span className="button-blue__selected__r"></span>
              </span>
              <span className="button-blue__default">
                <span className="button-blue__default__l"></span>
                <span className="button-blue__default__mid"></span>
                <span className="button-blue__default__r"></span>
              </span>
              <span className="button-blue__text">TOKENS</span>
            </span>
          </div>
          <div className="stats-page-kong-panel-container">
            <img src={panelGroundBg} className="stats-page-kong-panel-ground-bg" alt="" />

            <svg className="stats-page-kong-panel-ground-text" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
              viewBox="0 0 320 375" style={{ enableBackground: "new 0 0 320 375" }}>
              <text x="10%" y="65" dominant-baseline="left" text-anchor="start">TOTAL TVL</text> 
              <text x="90%" y="65" dominant-baseline="right" text-anchor="end">${formatNumberCustom(poolsTotals.totalTvl, 0)}</text> 
              <text x="10%" y="107" dominant-baseline="left" text-anchor="start">24H VOLUME</text> 
              <text x="90%" y="107" dominant-baseline="right" text-anchor="end">${formatNumberCustom(poolsTotals.totalVolume, 0)}</text> 
              <text x="10%" y="150" dominant-baseline="left" text-anchor="start">24H FEES</text> 
              <text x="90%" y="150" dominant-baseline="right" text-anchor="end">${formatNumberCustom(poolsTotals.totalFees, 0)}</text> 
            </svg>
          </div>
        </div>

        {viewTab === "stats" ? (
        <div className="stats-table">
          <div className="stats-table-twrap">
            <span>*** </span>
            <h2>Overview of Kong Pools</h2>
            <span> ***</span>
          </div>
          <div className="stats-table-head">    
            <div className="stats-table-head__content">
              <div className="stats-table-head-pool">POOL</div>
              <div className="stats-table-head-tvl">TVL</div>
              <div className="stats-table-head-totalvol">24H VOLUME</div>
              <div className="stats-table-head-apr">APY</div>
              <div className="stats-table-head-controls"></div>
            </div>
          </div>
          <div className="stats-table-body">    
            <div className="stats-table-body__content">
              {pools.map((pool, index) => (
                <div className="stats-table-row" key={index}>
                  <div className="stats-table-cell stats-table-cell-pool">
                    <div className="stats-table-logos">
                      <img
                        src={tokenImages[pool.symbol_0]}
                        className="stats-table-token stats-table-token-behind"
                        alt={pool.symbol_0}
                      />
                      <img
                        src={tokenImages[pool.symbol_1]}
                        className="stats-table-token"
                        alt={pool.symbol_1}
                      />
                    </div>
                    <span className="stats-table-tokenname">{pool.symbol_0} / {pool.symbol_1}</span>
                  </div>
                  <div className="stats-table-cell stats-table-cell-tvl">
                    <span className="stats-table-cell-label">TVL:</span>
                    <span className="stats-table-cell-value">${pool.tvl}</span>
                    
                  </div>
                  <div className="stats-table-cell stats-table-cell-totalvol">
                    <span className="stats-table-cell-label">Total Volume:</span>
                    <span className="stats-table-cell-value">${pool.roll24hVolume}</span>
                    
                  </div>
                  <div className="stats-table-cell stats-table-cell-apr">
                    <span className="stats-table-cell-label">APY:</span>
                    <span className="stats-table-cell-value">
                      {pool.apy}
                      <span className="percentage-symbol">%</span>
                      
                    </span>
                    
                  </div>
                  <div className="stats-table-cell stats-table-cell-controls">
                    <span
                      onClick={() => onTabClick('swap', pool.lp_token_symbol)}
                      className="buttonsmall-green stats-table-controlbtn"
                    >
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
                      <span className="buttonsmall-green__text">Swap</span>
                    </span>
                    <span
                      onClick={() => onTabClick('pools', pool.lp_token_symbol)} 
                      className="buttonsmall-green stats-table-controlbtn"
                    >
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
                      <span className="buttonsmall-green__text">Add Liquidity</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
                {poolInfo.map((pool, index) => {
                  const tokenName = tokenFullNames[pool.symbol_0] || pool.symbol_0; // Default to symbol if full name not found
                  return (
                    <div className="statspage-tokenstable-row" key={index}>
                      <div className="statspage-tokenstable-cell statspage-tokenstable-cell-token">
                        <div className="statspage-tokenstable-logo">
                          <img
                            src={tokenImages[pool.symbol_0]}
                            className="statspage-tokenstable-token"
                            alt={pool.symbol_0}
                          />
                        </div>
                        <span className="statspage-tokenstable-tokenname">{tokenName}</span>
                      </div>

                      <div className="statspage-tokenstable-cell statspage-tokenstable-cell-symbol">
                        <span className="statspage-tokenstable-cell-value">{pool.symbol_0}</span>
                      </div>

                      <div className="statspage-tokenstable-cell statspage-tokenstable-cell-address">
                        <span className="statspage-tokenstable-cell-value">{pool.address_0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
        </div>
        ) : null}
        <img src={kongImage} className="stats-page-kong-image-container" alt="" />
      </section>
      <FooterSocials />
    </main>
  );
}

export default StatsPage;
