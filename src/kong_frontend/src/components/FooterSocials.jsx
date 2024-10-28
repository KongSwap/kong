// FooterSocials.jsx
import React, { useState } from "react";
import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, IconButton } from "@mui/material";
import TwitterIcon from "@mui/icons-material/Twitter";
import ChatIcon from "@mui/icons-material/Chat";
import TelegramIcon from "@mui/icons-material/Telegram";
import CloseIcon from "@mui/icons-material/Close"; // Close button icon

const socials = [
  { label: "X", 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.753 4.659C19.8395 4.56011 19.9056 4.44516 19.9477 4.32071C19.9897 4.19626 20.0069 4.06475 19.9981 3.93368C19.9893 3.80261 19.9548 3.67455 19.8965 3.55682C19.8383 3.43908 19.7574 3.33398 19.6585 3.2475C19.5596 3.16102 19.4447 3.09487 19.3202 3.05282C19.1958 3.01077 19.0642 2.99364 18.9332 3.00242C18.8021 3.01119 18.6741 3.0457 18.5563 3.10396C18.4386 3.16223 18.3335 3.24311 18.247 3.342L13.137 9.182L8.8 3.4C8.70685 3.2758 8.58607 3.175 8.44721 3.10557C8.30836 3.03614 8.15525 3 8 3H4C3.81429 3 3.63225 3.05171 3.47427 3.14935C3.31629 3.24698 3.18863 3.38668 3.10557 3.55279C3.02252 3.71889 2.98736 3.90484 3.00404 4.08981C3.02072 4.27477 3.08857 4.45143 3.2 4.6L9.637 13.182L4.247 19.342C4.16053 19.4409 4.09437 19.5558 4.05232 19.6803C4.01027 19.8047 3.99314 19.9363 4.00192 20.0673C4.01069 20.1984 4.0452 20.3264 4.10347 20.4442C4.16173 20.5619 4.24261 20.667 4.3415 20.7535C4.44039 20.84 4.55534 20.9061 4.67979 20.9482C4.80424 20.9902 4.93575 21.0074 5.06682 20.9986C5.19789 20.9898 5.32595 20.9553 5.44368 20.897C5.56142 20.8388 5.66652 20.7579 5.753 20.659L10.863 14.818L15.2 20.6C15.2931 20.7242 15.4139 20.825 15.5528 20.8944C15.6916 20.9639 15.8448 21 16 21H20C20.1857 21 20.3678 20.9483 20.5257 20.8507C20.6837 20.753 20.8114 20.6133 20.8944 20.4472C20.9775 20.2811 21.0126 20.0952 20.996 19.9102C20.9793 19.7252 20.9114 19.5486 20.8 19.4L14.363 10.818L19.753 4.659Z"/>
    </svg>, 
    link: "https://x.com/kongswap" 
  },
  { label: "Telegram", 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M19.7767 4.42997C20.0238 4.32596 20.2943 4.29008 20.5599 4.32608C20.8256 4.36208 21.0768 4.46863 21.2873 4.63465C21.4979 4.80067 21.6601 5.02008 21.757 5.27005C21.854 5.52002 21.8822 5.79141 21.8387 6.05597L19.5707 19.813C19.3507 21.14 17.8947 21.901 16.6777 21.24C15.6597 20.687 14.1477 19.835 12.7877 18.946C12.1077 18.501 10.0247 17.076 10.2807 16.062C10.5007 15.195 14.0007 11.937 16.0007 9.99997C16.7857 9.23897 16.4277 8.79997 15.5007 9.49997C13.1987 11.238 9.50265 13.881 8.28065 14.625C7.20265 15.281 6.64065 15.393 5.96865 15.281C4.74265 15.077 3.60565 14.761 2.67765 14.376C1.42365 13.856 1.48465 12.132 2.67665 11.63L19.7767 4.42997Z" />
    </svg>, 
    link: "https://t.me/kong_swap" 
  },
  { label: "Open Chat", 
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path opacity="0.5" d="M17.7862 3L15 6.4677C17.0099 7.60534 18.3514 9.6573 18.3514 12C18.3514 14.3427 17.0099 16.3947 15 17.5323L17.7862 21C20.9288 19.0702 23 15.7584 23 12C23 8.24157 20.9276 4.92978 17.7862 3Z" />
    <path d="M1 12C1 5.92422 5.90652 1 11.9559 1C14.1893 1 16.2675 1.67031 18 2.82188L15.3728 6.3582C14.3776 5.74805 13.208 5.4 11.9581 5.4C8.32714 5.4 5.38323 8.35625 5.38323 12C5.38323 15.6438 8.32714 18.6 11.9581 18.6C13.208 18.6 14.3776 18.252 15.3728 17.6418L18 21.1781C16.2675 22.3297 14.1893 23 11.9559 23C5.90331 23 1 18.0801 1 12Z" />
    </svg>, 
    link: "https://oc.app/community/maceh-niaaa-aaaaf-bm37q-cai/channel/143833652212619352659918759629305427896" 
  },
];

const FooterSocials = () => {
  const [showSocials, setShowSocials] = useState(false);

  const toggleSocials = () => setShowSocials((prev) => !prev);

  return (
    <div 
      className="Socials"
    >
      <div className="panel-s-green-main panel-s-green-main--socials">
        <div className="panel-s-green-main__tl"></div>
        <div className="panel-s-green-main__tm"></div>
        <div className="panel-s-green-main__tr"></div>

        <div className="panel-s-green-main__bl"></div>
        <div className="panel-s-green-main__bm"></div>
        <div className="panel-s-green-main__br"></div>
        <div className="panel-s-green-main__content">

          <div className="Socials__Heading">
            <h3 
              className="Socials__HeadingText"
            >
              Follow Us
              <span
                onClick={toggleSocials}
                className="Socials__FakeButton"
              >
              </span>
            </h3>
            {showSocials && (
              <span 
                onClick={toggleSocials}
                className="Socials__Close"
              >
                <CloseIcon />
              </span>
            )}
          </div>
          {showSocials && (
            <div
              className="Socials__List"
            >
              {socials.map((social, index) => (
                <a
                  className="Socials__Anchor"
                  key={index}
                  href={social.link}
                  target="_blank" // Opens link in a new tab
                  rel="noopener noreferrer" // Security attribute for new tab links
                >
                  {social.icon}
                  <span className="Socials__AnchorText">{social.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FooterSocials;
