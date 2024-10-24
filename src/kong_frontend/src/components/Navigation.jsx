import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { Principal } from "@dfinity/principal";
import { ThreeDots } from "react-loader-spinner";
import SideDrawer from "./SideDrawer";
import iconPlugImage from "../../../assets/icons/plug.png";
import { toast } from "react-toastify";
import TransactionList from "./TransactionList";
import { FRONTEND_URL } from "../constants/config"; 
import { useIdentityKit } from "@nfid/identitykit/react";
import { useKingKongActor } from "../Actors/identityKitActorInitiation";

export const KONG_FRONTEND =
  "http://" + process.env.CANISTER_ID_KONG_FRONTEND + ".localhost:4943";
export const KONG_BACKEND_PRINCIPAL = Principal.fromText(
  process.env.CANISTER_ID_KONG_BACKEND
);

export function extractParts(str) {
  console.log('extract parts', str)
  const parts = str.split("-");
  const firstPart = `${parts[0]}-${parts[1].slice(0, 3)}`; // First segment + first 3 chars of second segment
  const lastPart = `${parts[parts.length - 2].slice(-3)}-${parts[parts.length - 1]}`; // Last 3 chars of second to last + last segment
  const newString = `${firstPart}...${lastPart}`;
  return newString;
}

export function formatPoolName(name) {
  return name.replace("_", "/");
}

const Navigation = React.memo(
  ({
    getTokens,
    updatePoolBalances,
    updateUserBalances,
    principal,
    isFetchingTokens,
    poolBalances,
    onTabClick,
    setIsDrawerOpen,
    changeDrawerContent,
    isDrawerOpen,
    showDrowerTokens,
    showDrowerPools,
    showDrawerClaims,
    tokenDetails,
    sortedTokens,
    tokenPrices,
    tokenImages,
  }) => {
    const location = useLocation();
    const { connect, disconnect, delegationType } = useIdentityKit();

    // const {
    //   login,
    //   clear,
    //   identityType,
    //   connectPlugWallet,
    //   activeIdentity,
    //   disconnectPlugWallet,
    //   actors: { backendKingKong },
    //   isInitialized
    // } = useIdentity();
    const backendKingKong = useKingKongActor();
    const initializationRef = useRef(false);
    const previousPrincipalRef = useRef();
    const [transactions, setTransactions] = useState([]);
    const [isCopied, setIsCopied] = useState(false);

    const smallerPrincipal = useMemo(() => {
      if (principal) {
        return extractParts(principal);
      }
      return "";
    }, [principal]);

    const fetchAndSetTransactions = useCallback(async () => {
      if (!principal) return;
      try {
        const result = await backendKingKong.txs([true]);
        if (result.Ok) {
          setTransactions(result.Ok);
        } else {
          toast(result.Err || "Failed to fetch transactions");
        }
      } catch (error) {
        toast("Error fetching transactions");
      }
    }, [backendKingKong, principal]);

    const loginWithPlugWallet = useCallback(() => {
      connect("Plug");
      setIsDrawerOpen(false);
    }, [connect, setIsDrawerOpen]);

    const loginWithInternetIdentity = useCallback(() => {
      connect("InternetIdentity");
      setIsDrawerOpen(false);
    }, [connect, setIsDrawerOpen]);

    const toggleDrawer = useCallback(
      (specificState) => {
        setIsDrawerOpen(specificState ? specificState : !isDrawerOpen);
      },
      [setIsDrawerOpen, isDrawerOpen]
    );

    const copyToClipboard = useCallback(async (text) => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
        }
      } catch (err) {
        console.error(err);
      }
    }, []);

    const handleDisconnect = useCallback(async () => {
      await disconnect();
    }, [disconnect]);

    // useEffect(() => {
    //   if (principal && isInitialized) {
    //     if (principal !== previousPrincipalRef.current) {
    //       // Principal has changed, reinitialize
    //       previousPrincipalRef.current = principal;
    //       const initialize = async () => {
    //         await getUserProfile();
    //         await updatePoolBalances();
    //         await updateUserBalances();
    //       };
    //       initialize();
    //     }
    //   } else if (!principal) {
    //     // Principal is null, reset the ref
    //     previousPrincipalRef.current = null;
    //   }
    // }, [
    //   principal,
    //   getUserProfile,
    //   updateUserBalances,
    //   updatePoolBalances,
    //   isInitialized,
    // ]);

    useEffect(() => {
      console.log('navigation', delegationType)
      if (principal && delegationType) {
        if (principal !== previousPrincipalRef.current) {
          // Principal has changed, reinitialize
          previousPrincipalRef.current = principal;
          // add 3 seconds before initializing
          setTimeout(() => {
          const initialize = async () => {
            // await getUserProfile();
            await updatePoolBalances();
            await updateUserBalances();
          };

          initialize();

          }, 3000)
        }
      } else if (!principal) {
        // Principal is null, reset the ref
        previousPrincipalRef.current = null;
      }
    }, [
      principal,
      // getUserProfile,
      updateUserBalances,
      updatePoolBalances,
      delegationType
    ]);

    useEffect(() => {
      if (principal && isDrawerOpen) fetchAndSetTransactions();
    }, [principal, isDrawerOpen, fetchAndSetTransactions]);

    return (
      <header className="header">
        <nav className="main-nav">
          <Link
            to="/?viewtab=swap&pool=ICP_ckUSDT"
            className={`button-blue button-blue--aslink button-blue--stats ${
              location.pathname === "/" ? "button-blue--selected" : ""
            }`}
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
            <span className="button-blue__text">Swap</span>
          </Link>
          <Link
            to="/stats"
            className={`button-blue button-blue--aslink button-blue--stats ${
              location.pathname === "/stats" ? "button-blue--selected" : ""
            }`}
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
            <span className="button-blue__text">Stats</span>
          </Link>
        </nav>
        <div className="second-nav">
          {!principal ? (
            <span
              onClick={toggleDrawer}
              className="button-blue button-blue--connect"
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
              <span className="button-blue__text">Connect Wallet</span>
            </span>
          ) : (
            <>
            {!FRONTEND_URL.includes("3ldz4-aiaaa-aaaar-qaina-cai") && (
              <span
                onClick={() => getTokens()}
                disabled={isFetchingTokens}
                className="button-blue button-blue--claim"
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
                <span className="button-blue__text">
                  {isFetchingTokens ? (
                    <>
                      Claiming tokens
                      <div className="loader">
                        <ThreeDots
                          visible={true}
                          height="40"
                          width="40"
                          color="#000000"
                          radius="9"
                          ariaLabel="three-dots-loading"
                        />
                      </div>
                    </>
                  ) : (
                    "Claim Free Tokens"
                  )}
                </span>
              </span> )}
              <span
                onClick={toggleDrawer}
                className="button-blue button-blue--connect"
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
                <span className="button-blue__text">{smallerPrincipal}</span>
              </span>
            </>
          )}
        </div>
        {principal ? (
          <SideDrawer
            isOpen={isDrawerOpen}
            onClose={() => toggleDrawer(false)}
            headTitle={"Connect a wallet"}
            customHead={
              <div className="side-drawer-head">
                <h3 className="side-drawer-head-title">{smallerPrincipal}</h3>
                <button
                  className="sidebar-copy-button"
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
                <span onClick={handleDisconnect} className="disconnect">
                  <span className="disconnect-icon">
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 30 30"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M13.5938 15V5.625C13.5938 5.25204 13.7419 4.89435 14.0056 4.63063C14.2694 4.36691 14.627 4.21875 15 4.21875C15.373 4.21875 15.7306 4.36691 15.9944 4.63063C16.2581 4.89435 16.4062 5.25204 16.4062 5.625V15C16.4062 15.373 16.2581 15.7306 15.9944 15.9944C15.7306 16.2581 15.373 16.4062 15 16.4062C14.627 16.4062 14.2694 16.2581 14.0056 15.9944C13.7419 15.7306 13.5938 15.373 13.5938 15ZM21.3926 5.39062C21.0803 5.19836 20.7053 5.13567 20.3475 5.21592C19.9897 5.29618 19.6774 5.51303 19.4771 5.82025C19.2769 6.12747 19.2046 6.50075 19.2757 6.8605C19.3467 7.22026 19.5554 7.53804 19.8574 7.74609C22.4309 9.41836 23.9062 12.0703 23.9062 15C23.9062 17.3621 22.9679 19.6274 21.2977 21.2977C19.6274 22.9679 17.3621 23.9062 15 23.9062C12.6379 23.9062 10.3726 22.9679 8.70233 21.2977C7.03208 19.6274 6.09375 17.3621 6.09375 15C6.09375 12.0703 7.56914 9.41836 10.1426 7.74023C10.4285 7.52596 10.6221 7.21089 10.6841 6.85902C10.7461 6.50716 10.6719 6.14488 10.4765 5.84578C10.281 5.54667 9.97908 5.33317 9.63194 5.24863C9.28479 5.16409 8.91849 5.21486 8.60742 5.39062C5.22187 7.59141 3.28125 11.0965 3.28125 15C3.28125 18.108 4.5159 21.0887 6.71359 23.2864C8.91128 25.4841 11.892 26.7188 15 26.7188C18.108 26.7188 21.0887 25.4841 23.2864 23.2864C25.4841 21.0887 26.7188 18.108 26.7188 15C26.7188 11.0965 24.7781 7.59141 21.3926 5.39062Z"
                        fill="white"
                      />
                    </svg>
                  </span>
                  <span className="disconnect-text">Disconnect</span>
                </span>
              </div>
            }
          >
            <>
              <div className="tabs">
                <span
                  onClick={() => changeDrawerContent("tokens")}
                  className={`tab ${showDrowerTokens && "tab-active"}`}
                >
                  Tokens
                </span>
                <span
                  onClick={() => changeDrawerContent("pools")}
                  className={`tab ${showDrowerPools && "tab-active"}`}
                >
                  Pools
                </span>
                <span
                  onClick={() => changeDrawerContent("claims")}
                  className={`tab ${showDrawerClaims && "tab-active"}`}
                >
                  Transactions
                </span>
              </div>
              <div className="tokens-list">
                {showDrowerPools ? (
                  poolBalances.length > 0 ? (
                  poolBalances.map((pool) => (
                    <div className="tokens-item" key={pool.name}>
                      <span className="tokens-logo-wrapper">
                        <img
                          src={tokenImages[pool.name.split("/")[0]]}
                          className="tokens-logo-under"
                        />
                        <img
                          src={tokenImages[pool.name.split("/")[1]]}
                          className="tokens-logo"
                        />
                      </span>
                      <span className="tokens-details">
                        <span className="tokens-toprow">
                          <span className="tokens-name">
                            {formatPoolName(pool.name)} LP
                          </span>
                        </span>
                        <span className="tokenlist-amount">{pool.balance}</span>
                      </span>
                      <div className="token-controls-for-pools">
                        <span
                          onClick={() => {
                            onTabClick("pools", pool.name);
                            toggleDrawer(false);
                          }}
                          className="token-control"
                        >
                          Add
                        </span>
                        <span
                          onClick={() => {
                            onTabClick("remove", pool.name);
                            toggleDrawer(false);
                          }}
                          className="token-control"
                        >
                          Remove
                        </span>
                      </div>
                    </div>
                  ))) : (
                    <div className="no-pools">
                      <p>No pools available</p>
                    </div>
                  )
                ) : showDrawerClaims ? (
                  <TransactionList
                    transactions={transactions}
                    tokenDetails={tokenDetails}
                    tokenImages={tokenImages}
                    tokenPrices={tokenPrices}
                  />
                ) : (
                  sortedTokens.map((token) => (
                    <div className="tokens-item" key={token.symbol}>
                      <span className="tokens-logo-wrapper">
                        <img src={token.image} className="tokens-logo" />
                      </span>
                      <span className="tokens-details">
                        <span className="tokens-toprow">
                          <span className="tokens-name">{token.symbol}</span>
                        </span>
                        <span className="tokenlist-amount">
                          {token.balance || "-"} {token.symbol}
                        </span>
                        <span className="tokenlist-usd-value">
                          (${token.usdBalance || "0.00"})
                        </span>
                      </span>
                      <div className="token-controls-for-pools">
                        <span
                          onClick={() => {
                            onTabClick("swap", `${token.symbol}_ckUSDC`);
                            toggleDrawer(false);
                          }}
                          className="token-control"
                        >
                          Swap
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          </SideDrawer>
        ) : (
          <SideDrawer
            isOpen={isDrawerOpen}
            onClose={() => toggleDrawer(false)}
            headTitle={"Connect a wallet"}
          >
            <>
              <div className="wallets">
                <span
                  onClick={loginWithInternetIdentity}
                  className="wallet-button"
                >
                  <span className="wallet-button-thumb">
                    <img src={tokenImages['ICP']} className="wallet-button-logo" />
                  </span>
                  <span className="wallet-button-text">Internet Identity</span>
                </span>
                <span onClick={loginWithPlugWallet} className="wallet-button">
                  <span className="wallet-button-thumb">
                    <img src={iconPlugImage} className="wallet-button-logo" />
                  </span>
                  <span className="wallet-button-text">Plug Wallet</span>
                </span>
                <span className="wallet-button" onClick={() => connect("NFIDW")}>
                  <span className="wallet-button-thumb">
                    <img src={iconPlugImage} className="wallet-button-logo" />
                  </span>
                  <span className="wallet-button-text">NFID Wallet</span>
                </span>
              </div>
              <div className="side-drawer-terms">
                <p className="side-drawer-terms-message">
                  By connecting a wallet, you agree to King Kong Swaps’ terms of
                  service and consent to its PRIVACY POLICY.
                </p>
              </div>
            </>
          </SideDrawer>
        )}
      </header>
    );
  }
);

export default Navigation;
