import React from "react";
import PropTypes from "prop-types";

const Modal = ({ isOpen, onClose, children, headTitle, customHead }) => {
  if (!isOpen) return null;

  // const handleSelectToken = (token) => {
  //   onSelectToken(token);
  //   onClose();
  // };

  return (
    <section className="modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-container panel-green-main panel-green-main--modalcontainer" onClick={(e) => e.stopPropagation()}>
        <div className="panel-green-main__tl"></div>
        <div className="panel-green-main__tm"></div>
        <div className="panel-green-main__tr"></div>

        <div className="panel-green-main__ml"></div>
        <div className="panel-green-main__mr"></div>

        <div className="panel-green-main__bl"></div>
        <div className="panel-green-main__bm"></div>
        <div className="panel-green-main__br"></div>

        <div className="panel-green-main__content">

          <div className="modal-panel">
            {customHead ? (customHead) : (
            <div className="modal-head">
            <h3 className="modal-head-title">{headTitle}</h3>
            <div className="modal-close" onClick={onClose}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                className="modal-close-icon"
              >
                <path
                  d="M1.4 14L0 12.6L5.6 7L0 1.4L1.4 0L7 5.6L12.6 0L14 1.4L8.4 7L14 12.6L12.6 14L7 8.4L1.4 14Z"
                />
              </svg>
            </div>
          </div>
            )}
            <div className="modal-content">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
};

export default Modal;
