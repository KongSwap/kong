import React from "react";
import kongImage from "../../../assets/kong.png";
import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div className="p404SecondBody">
      <main className="p404-page-main">
        <span className="p404-page-title-as-image"></span>
        <section className="p404-page-section">
          <div className="p404-page-left-container"></div>

          <div className="p404-page-center-container">
            <h1 className="p404-pagecontent-title">
              <span className="p404-pagecontent-title__first">404</span>
              <span className="p404-pagecontent-title__second">
                Oops Kong took a wrong turn!
              </span>
            </h1>
            <p className="p404-pagecontent-subtitle">
              Looks like Kong swung to the wrong page. Don’t worry, you’re still
              in the jungle of DeFi! Swing back to the homepage
            </p>
            <div className="p404-pagecontent-btncontainer">
              <Link
                to="/?viewtab=swap&pool=ICP_ckUSDT"
                className="p404-pagecontent-returnbutton buttonbig-yellow buttonbig-yellow--asbutton buttonbig-yellow--return"
              >
                <span className="buttonbig-yellow__pressed">
                  <span className="buttonbig-yellow__pressed__l"></span>
                  <span className="buttonbig-yellow__pressed__mid"></span>
                  <span className="buttonbig-yellow__pressed__r"></span>
                </span>
                <span className="buttonbig-yellow__selected">
                  <span className="buttonbig-yellow__selected__l"></span>
                  <span className="buttonbig-yellow__selected__mid"></span>
                  <span className="buttonbig-yellow__selected__r"></span>
                </span>
                <span className="buttonbig-yellow__default">
                  <span className="buttonbig-yellow__default__l"></span>
                  <span className="buttonbig-yellow__default__mid"></span>
                  <span className="buttonbig-yellow__default__r"></span>
                </span>
                <span className="buttonbig-yellow__text">Return Home</span>
              </Link>
            </div>
          </div>
          <div className="p404-page-kong-image-container">
            <img src={kongImage} className="p404-page-kong-image" alt="" />
            {/* {currentMessage.length > 0 && (
              <span className="bubble bubble--swappage-kong bubble--text1">
                <span className="bubble__top"></span>
                <span className="bubble__mid"></span>
                <span className="bubble__bottom"></span>
                <span className="bubble__content">{currentMessage}</span>
              </span>
            )} */}
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFoundPage;
