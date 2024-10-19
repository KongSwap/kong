import React, { useState } from "react";
import bananaButtonShow from "../../../assets/bananas-show.png";
import bananaButtonHide from "../../../assets/bananas-hide.png";
import SwapComponent from "../components/SwapComponent";
import { ToastContainer } from "react-toastify";
import PoolsComponent from "../components/PoolsComponent";
import RemoveLiquidityComponent from "../components/RemoveLiquidityComponent";
import SendComponent from "../components/SendComponent";
import Modal from "../components/Modal";
import { FRONTEND_URL } from "../constants/config";
import ReceiveComponent from "../components/ReceiveComponent";
import Tippy from "@tippyjs/react";
import FooterSocials from "../components/FooterSocials";
import GorillaText from "../components/GorillaText";

const defaultSlippage = 2;

function SwapPage({
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
  poolInfo,
  sortedTokens,
  tokenPrices,
  tokenImages,
  accountId,
}) {
  const [walletContentView, setWalletContentView] = useState("tokens-table");
  const [slippageDefaultView, setSlippageDefaultView] = useState(true);

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
                    <div className="wallet-head">
                      <span className="wallet-headlabel">Address</span>
                      <span className="wallet-address-wrapper">
                        <input
                          type="text"
                          className="wallet-address-input"
                          readOnly
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
                                className="copy-icon"
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
                                  fillRule="evenodd"
                                  clipRule="evenodd"
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
                        <div className="tokenwallet-table-head">
                          <span className="tokenwallet-table-head__itemtokens">
                            Tokens
                          </span>
                          <span className="tokenwallet-table-head__itemprice">
                            Price
                          </span>
                          <span className="tokenwallet-table-head__itemamount">
                            Amount
                          </span>
                        </div>
                        <div className="tokenwallet-table-container">
                          <ul className="tokenwallet-table-list">
                            {sortedTokens.map((token) => (
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
                        <div className="wallet-table-head">
                          <span>Pools</span>
                          <span>Liquidity</span>
                        </div>
                        <div className="wallet-table-container">
                          <ul className="wallet-table-list">
                            {poolBalances.length > 0 ? (
                              poolBalances.map((pool) => (
                                <li className="wallet-table-item" key={pool.name}>
                                  <span className="wallet-token-logos-2">
                                    <img
                                      src={tokenImages[pool.name.split("/")[0]]}
                                      className="wallet-token-logo wallet-token-logo-primary"
                                    />
                                    <img
                                      src={tokenImages[pool.name.split("/")[1]]}
                                      className="wallet-token-logo wallet-token-logo-secondary"
                                    />
                                  </span>

                                  <span className="wallet-token-name-for-pools">
                                    {pool.name} LP
                                  </span>

                                  <div className="wallet-token-amount-container">
                                    <span className="wallet-token-amount-highlight">
                                      {pool.balance} LP
                                    </span>
                                    <span className="wallet-token-amount-small">
                                      {pool.amount_0} {pool.symbol_0} /{" "}
                                      {pool.amount_1} {pool.symbol_1}
                                    </span>
                                  </div>

                                  <div className="wallet-token-controls-for-pools">
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
                                          fillRule="evenodd"
                                          clipRule="evenodd"
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
                                          fillRule="evenodd"
                                          clipRule="evenodd"
                                          d="M12 42V40H8V38H6V36H4V34H2V30H0V12H2V8H4V6H6V4H8V2H12V0H30V2H34V4H36V6H38V8H40V12H42V30H40V34H38V36H36V38H34V40H30V42H12ZM35 19H7V23H35V19Z"
                                          fill="white"
                                        />
                                      </svg>
                                    </span>
                                  </div>
                                </li>
                              ))
                            ) : (
                              <span className="no-pools">No pools found</span>
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
                      strokeMiterlimit="10"
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
        <GorillaText tokenDetails={tokenDetails} poolInfo={poolInfo} />
          {/* <img src={kongImage} className="swap-page-kong-image-container" alt="" /> */}
        </section>
        {isSlippageModalOpen && (
          <Modal
            isOpen={isSlippageModalOpen}
            onClose={() => toggleSlippageModal()}
            headTitle={"Max Slippage"}
            customHead={
              <div className="modal-head">
                <div className="modal-head-title">Max Slippage</div>
                <div onClick={() => toggleSlippageModal()} className="modal-close">
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

export default SwapPage;
