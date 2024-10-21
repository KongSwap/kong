import React from "react";
import ReactDOM from "react-dom/client";
import "./index.scss";
import "tippy.js/dist/tippy.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { InternetIdentityProvider } from "ic-use-internet-identity";
import { PlugWalletProvider } from "./contexts/PlugWalletContext";
import { FRONTEND_URL } from "./constants/config";
import WrapWithProviders from "./components/WrapWithProviders";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InternetIdentityProvider
      loginOptions={{
        maxTimeToLive: BigInt(1) * BigInt(3_600_000_000_000),
        derivationOrigin:
          process.env.DFX_NETWORK === "local"
            ? "http://localhost:3000"
            : `https://${FRONTEND_URL}.icp0.io`,
      }}>
      <PlugWalletProvider>
        <WrapWithProviders>
          <RouterProvider router={router} />
        </WrapWithProviders>
      </PlugWalletProvider>
    </InternetIdentityProvider>
  </React.StrictMode>
);
