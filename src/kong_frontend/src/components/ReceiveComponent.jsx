import React, { useState, useCallback } from "react";
import {QRCodeCanvas} from 'qrcode.react';
import Tippy from "@tippyjs/react";

const ReceiveComponent = ({ accountId, principal }) => {

  const [isCopiedPrincipal, setIsCopiedPrincipal] = useState(false);
  const [isCopiedAccountId, setIsCopiedAccountId] = useState(false);
  const [isQrOpenedAccount, setIsQrOpenedAccount] = useState(false);
  const [isQrOpenedPrincipal, setIsQrOpenedPrincipal] = useState(false);

  const copyToClipboard = useCallback(async (text, type) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        if (type === "principal") {
          setIsCopiedPrincipal(true);
        } else {
          setIsCopiedAccountId(true);
        }

        // Hide tooltip after 1.5 seconds
        setTimeout(() => {
          if (type === "principal") {
            setIsCopiedPrincipal(false);
          } else {
            setIsCopiedAccountId(false);
          }
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);


    return (
        <>
        <div className="panel-green-main panel-green-main--receive">
          <div className="panel-green-main__tl"></div>
          <div className="panel-green-main__tm"></div>
          <div className="panel-green-main__tr"></div>
  
          <div className="panel-green-main__ml"></div>
          <div className="panel-green-main__mr"></div>
  
          <div className="panel-green-main__bl"></div>
          <div className="panel-green-main__bm"></div>
          <div className="panel-green-main__br"></div>
  
          <div className="panel-green-main__content">
            {(isQrOpenedPrincipal || isQrOpenedAccount) ?             (
            <div className="receive-container">
              <div className="receive-container-label-wraper">
                <h3 className="receive-container-label">Receive</h3>
                <div
                  onClick={() => {
                    setIsQrOpenedPrincipal(false);
                    setIsQrOpenedAccount(false);
                  }}
                  className="receive-container-close"
                >
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
              <div className="receive-section receive-section--top">
                <h4 className="receive-container-title">Wallet {isQrOpenedAccount ? "Account" : "Principal"} Address:</h4>
                <p  className="receive-container-address">{isQrOpenedAccount ? accountId : principal}</p>
                <div className="receive-qr-section">
                  <div 
                    className="receive-qr-area"
                  >
                    <div 
                      className="receive-qr-image"
                    >
                    <QRCodeCanvas 
                    imageSettings={
                      {
                        height: 320,
                        width: 320,
                      }
                    } 
                    value={isQrOpenedAccount ? accountId : principal} />
                    </div>
                  
                  </div>
                </div>
              </div>
            </div>
            ) : (
              <div className="receive-container">
              <div className="receive-container-label-wraper">
                <h3 className="receive-container-label">Receive</h3>
              </div>
              <div className="receive-section receive-section--top">
                <h4 className="receive-container-title">Wallet Principal Address</h4>
                <p  className="receive-container-text">Use for all tokens when receiving from wallets, users, or other apps that support this address format.</p>
                <p  className="receive-container-address">{principal}</p>
                <div className="receive-controls">
                  <button
                  className="receive-control receive-control-qr"
                  onClick={() => setIsQrOpenedPrincipal(true)}
                  >
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.00001 20.384V9.61601C8.00001 9.15868 8.15467 8.77467 8.46401 8.46401C8.77334 8.15334 9.15734 7.99868 9.61601 8.00001H20.384C20.8413 8.00001 21.2253 8.15467 21.536 8.46401C21.8467 8.77334 22.0013 9.15734 22 9.61601V20.384C22 20.8427 21.8453 21.2267 21.536 21.536C21.2267 21.8453 20.8427 22 20.384 22H9.61601C9.15868 22 8.77467 21.8453 8.46401 21.536C8.15334 21.2267 7.99868 20.8427 8.00001 20.384ZM10 20H20V10H10V20ZM8.00001 38.384V27.616C8.00001 27.1573 8.15467 26.7733 8.46401 26.464C8.77334 26.1547 9.15734 26 9.61601 26H20.384C20.8413 26 21.2253 26.1547 21.536 26.464C21.8467 26.7733 22.0013 27.1573 22 27.616V38.384C22 38.8413 21.8453 39.2253 21.536 39.536C21.2267 39.8467 20.8427 40.0013 20.384 40H9.61601C9.15868 40 8.77467 39.8453 8.46401 39.536C8.15334 39.2267 7.99868 38.8427 8.00001 38.384ZM10 38H20V28H10V38ZM26 20.384V9.61601C26 9.15868 26.1547 8.77467 26.464 8.46401C26.7733 8.15334 27.1573 7.99868 27.616 8.00001H38.384C38.8427 8.00001 39.2267 8.15467 39.536 8.46401C39.8453 8.77334 40 9.15734 40 9.61601V20.384C40 20.8427 39.8453 21.2267 39.536 21.536C39.2267 21.8453 38.8427 22 38.384 22H27.616C27.1573 22 26.7733 21.8453 26.464 21.536C26.1547 21.2267 26 20.8427 26 20.384ZM28 20H38V10H28V20ZM36.5 40V36.5H40V40H36.5ZM26 29.5V26H29.5V29.5H26ZM29.5 33V29.5H33V33H29.5ZM26 36.5V33H29.5V36.5H26ZM29.5 40V36.5H33V40H29.5ZM33 36.5V33H36.5V36.5H33ZM33 29.5V26H36.5V29.5H33ZM36.5 33V29.5H40V33H36.5Z" fill="white"/>
                    </svg>
                  </button>
                  <Tippy content="Copied!" visible={isCopiedPrincipal}>
                  <button
                  className="receive-control receive-control-copy"
                  onClick={() => copyToClipboard(principal || "", "principal")}
                  >
                    {!isCopiedPrincipal ? (
                      <svg className="copy-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.25 3.1875H8.25C8.10082 3.1875 7.95774 3.24676 7.85225 3.35225C7.74676 3.45774 7.6875 3.60082 7.6875 3.75V7.6875H3.75C3.60082 7.6875 3.45774 7.74676 3.35225 7.85225C3.24676 7.95774 3.1875 8.10082 3.1875 8.25V20.25C3.1875 20.3992 3.24676 20.5423 3.35225 20.6477C3.45774 20.7532 3.60082 20.8125 3.75 20.8125H15.75C15.8992 20.8125 16.0423 20.7532 16.1477 20.6477C16.2532 20.5423 16.3125 20.3992 16.3125 20.25V16.3125H20.25C20.3992 16.3125 20.5423 16.2532 20.6477 16.1477C20.7532 16.0423 20.8125 15.8992 20.8125 15.75V3.75C20.8125 3.60082 20.7532 3.45774 20.6477 3.35225C20.5423 3.24676 20.3992 3.1875 20.25 3.1875ZM15.1875 19.6875H4.3125V8.8125H15.1875V19.6875ZM19.6875 15.1875H16.3125V8.25C16.3125 8.10082 16.2532 7.95774 16.1477 7.85225C16.0423 7.74676 15.8992 7.6875 15.75 7.6875H8.8125V4.3125H19.6875V15.1875Z" fill="white"/>
                      </svg>

                    ) : (
                      <svg className="copy-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.25 3.1875H8.25C8.10082 3.1875 7.95774 3.24676 7.85225 3.35225C7.74676 3.45774 7.6875 3.60082 7.6875 3.75V7.6875H3.75C3.60082 7.6875 3.45774 7.74676 3.35225 7.85225C3.24676 7.95774 3.1875 8.10082 3.1875 8.25V20.25C3.1875 20.3992 3.24676 20.5423 3.35225 20.6477C3.45774 20.7532 3.60082 20.8125 3.75 20.8125H15.75C15.8992 20.8125 16.0423 20.7532 16.1477 20.6477C16.2532 20.5423 16.3125 20.3992 16.3125 20.25V16.3125H20.25C20.3992 16.3125 20.5423 16.2532 20.6477 16.1477C20.7532 16.0423 20.8125 15.8992 20.8125 15.75V3.75C20.8125 3.60082 20.7532 3.45774 20.6477 3.35225C20.5423 3.24676 20.3992 3.1875 20.25 3.1875ZM15.1875 19.6875H4.3125V8.8125H15.1875V19.6875ZM19.6875 15.1875H16.3125V8.25C16.3125 8.10082 16.2532 7.95774 16.1477 7.85225C16.0423 7.74676 15.8992 7.6875 15.75 7.6875H8.8125V4.3125H19.6875V15.1875Z" fill="white"/>
                        <path d="M6.5 15L8.5 17L13 12" stroke="white" stroke-width="1.25" stroke-linecap="round"/>
                      </svg>
                    )}
                  </button>
                  </Tippy>
                </div>
              </div>
              <div className="receive-section receive-section--second">
                <h4 className="receive-container-title">ICP Account ID: </h4>
                <p  className="receive-container-text">Use for ICP deposits from exchanges or other wallets that only support Account IDs.</p>
                <p  className="receive-container-address">{accountId}</p>
                <div className="receive-controls">
                  <button
                  className="receive-control receive-control-qr"
                  onClick={() => setIsQrOpenedAccount(true)}
                  >
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.00001 20.384V9.61601C8.00001 9.15868 8.15467 8.77467 8.46401 8.46401C8.77334 8.15334 9.15734 7.99868 9.61601 8.00001H20.384C20.8413 8.00001 21.2253 8.15467 21.536 8.46401C21.8467 8.77334 22.0013 9.15734 22 9.61601V20.384C22 20.8427 21.8453 21.2267 21.536 21.536C21.2267 21.8453 20.8427 22 20.384 22H9.61601C9.15868 22 8.77467 21.8453 8.46401 21.536C8.15334 21.2267 7.99868 20.8427 8.00001 20.384ZM10 20H20V10H10V20ZM8.00001 38.384V27.616C8.00001 27.1573 8.15467 26.7733 8.46401 26.464C8.77334 26.1547 9.15734 26 9.61601 26H20.384C20.8413 26 21.2253 26.1547 21.536 26.464C21.8467 26.7733 22.0013 27.1573 22 27.616V38.384C22 38.8413 21.8453 39.2253 21.536 39.536C21.2267 39.8467 20.8427 40.0013 20.384 40H9.61601C9.15868 40 8.77467 39.8453 8.46401 39.536C8.15334 39.2267 7.99868 38.8427 8.00001 38.384ZM10 38H20V28H10V38ZM26 20.384V9.61601C26 9.15868 26.1547 8.77467 26.464 8.46401C26.7733 8.15334 27.1573 7.99868 27.616 8.00001H38.384C38.8427 8.00001 39.2267 8.15467 39.536 8.46401C39.8453 8.77334 40 9.15734 40 9.61601V20.384C40 20.8427 39.8453 21.2267 39.536 21.536C39.2267 21.8453 38.8427 22 38.384 22H27.616C27.1573 22 26.7733 21.8453 26.464 21.536C26.1547 21.2267 26 20.8427 26 20.384ZM28 20H38V10H28V20ZM36.5 40V36.5H40V40H36.5ZM26 29.5V26H29.5V29.5H26ZM29.5 33V29.5H33V33H29.5ZM26 36.5V33H29.5V36.5H26ZM29.5 40V36.5H33V40H29.5ZM33 36.5V33H36.5V36.5H33ZM33 29.5V26H36.5V29.5H33ZM36.5 33V29.5H40V33H36.5Z" fill="white"/>
                    </svg>
                  </button>
                  <Tippy content="Copied!" visible={isCopiedAccountId}>
                  <button
                  className="receive-control receive-control-copy"
                  onClick={() => copyToClipboard(accountId || "", "accountId")}
                  >
                    {!isCopiedAccountId ? (
                      <svg className="copy-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.25 3.1875H8.25C8.10082 3.1875 7.95774 3.24676 7.85225 3.35225C7.74676 3.45774 7.6875 3.60082 7.6875 3.75V7.6875H3.75C3.60082 7.6875 3.45774 7.74676 3.35225 7.85225C3.24676 7.95774 3.1875 8.10082 3.1875 8.25V20.25C3.1875 20.3992 3.24676 20.5423 3.35225 20.6477C3.45774 20.7532 3.60082 20.8125 3.75 20.8125H15.75C15.8992 20.8125 16.0423 20.7532 16.1477 20.6477C16.2532 20.5423 16.3125 20.3992 16.3125 20.25V16.3125H20.25C20.3992 16.3125 20.5423 16.2532 20.6477 16.1477C20.7532 16.0423 20.8125 15.8992 20.8125 15.75V3.75C20.8125 3.60082 20.7532 3.45774 20.6477 3.35225C20.5423 3.24676 20.3992 3.1875 20.25 3.1875ZM15.1875 19.6875H4.3125V8.8125H15.1875V19.6875ZM19.6875 15.1875H16.3125V8.25C16.3125 8.10082 16.2532 7.95774 16.1477 7.85225C16.0423 7.74676 15.8992 7.6875 15.75 7.6875H8.8125V4.3125H19.6875V15.1875Z" fill="white"/>
                      </svg>
                    ) : (
                      <svg className="copy-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.25 3.1875H8.25C8.10082 3.1875 7.95774 3.24676 7.85225 3.35225C7.74676 3.45774 7.6875 3.60082 7.6875 3.75V7.6875H3.75C3.60082 7.6875 3.45774 7.74676 3.35225 7.85225C3.24676 7.95774 3.1875 8.10082 3.1875 8.25V20.25C3.1875 20.3992 3.24676 20.5423 3.35225 20.6477C3.45774 20.7532 3.60082 20.8125 3.75 20.8125H15.75C15.8992 20.8125 16.0423 20.7532 16.1477 20.6477C16.2532 20.5423 16.3125 20.3992 16.3125 20.25V16.3125H20.25C20.3992 16.3125 20.5423 16.2532 20.6477 16.1477C20.7532 16.0423 20.8125 15.8992 20.8125 15.75V3.75C20.8125 3.60082 20.7532 3.45774 20.6477 3.35225C20.5423 3.24676 20.3992 3.1875 20.25 3.1875ZM15.1875 19.6875H4.3125V8.8125H15.1875V19.6875ZM19.6875 15.1875H16.3125V8.25C16.3125 8.10082 16.2532 7.95774 16.1477 7.85225C16.0423 7.74676 15.8992 7.6875 15.75 7.6875H8.8125V4.3125H19.6875V15.1875Z" fill="white"/>
                        <path d="M6.5 15L8.5 17L13 12" stroke="white" stroke-width="1.25" stroke-linecap="round"/>
                      </svg>
                    )}
                  </button>
                  </Tippy>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
        </>
    );
}

export default ReceiveComponent;
