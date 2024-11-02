import React from "react";
import PropTypes from "prop-types";

const SideDrawer = ({ isOpen, onClose, children, headTitle, customHead }) => {
  if (!isOpen) return null;

  // const handleSelectToken = (token) => {
  //   onSelectToken(token);
  //   onClose();
  // };

  return (
    <section className="side-drawer">
      <div className="side-drawer-overlay" onClick={onClose} />
      <div className="side-drawer-container" onClick={(e) => e.stopPropagation()}>
        <div class="side-drawer-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 10.5V13.5H22.4444V15H20.8889V16.5H19.3333V18H17.7778V19.5H16.2222V21H14.6667V22.5H13.1111V24H11.5556V22.5H10V21H11.5556V19.5H13.1111V18H14.6667V16.5H16.2222V15H17.7778V13.5H19.3333V10.5H17.7778V9H16.2222V7.5H14.6667V6H13.1111V4.5H11.5556V3H10V1.5H11.5556V0H13.1111V1.5H14.6667V3H16.2222V4.5H17.7778V6H19.3333V7.5H20.8889V9H22.4444V10.5H24Z" fill="white"/>
            <path d="M14 10.5V13.5H12.4444V15H10.8889V16.5H9.33333V18H7.77778V19.5H6.22222V21H4.66667V22.5H3.11111V24H1.55556V22.5H0V21H1.55556V19.5H3.11111V18H4.66667V16.5H6.22222V15H7.77778V13.5H9.33333V10.5H7.77778V9H6.22222V7.5H4.66667V6H3.11111V4.5H1.55556V3H0V1.5H1.55556V0H3.11111V1.5H4.66667V3H6.22222V4.5H7.77778V6H9.33333V7.5H10.8889V9H12.4444V10.5H14Z" fill="white"/>
          </svg>
        </div>
          <div className="side-drawer-panel">
            {customHead ? (customHead) : (
            <div className="side-drawer-head">
                <h3 className="side-drawer-head-title">{headTitle}</h3>
            </div>
            )}
            {children}
          </div>
        </div>
    </section>
  );
};

export default SideDrawer;