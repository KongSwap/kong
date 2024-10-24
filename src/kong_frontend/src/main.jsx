import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.scss";
import "tippy.js/dist/tippy.css"; // optional
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { FRONTEND_URL } from "./constants/config";
import NotFoundPage from "./components/NotFoundPage";
import {
  CkbtcActorProvider,
  CkethActorProvider,
  CkusdcActorProvider,
  IcpActorProvider,
  KingKongActorProvider,
  KingKongFaucetActorProvider,
  CkusdtActorProvider,
  NICPActorProvider,
  WtnActorProvider,
  YugeActorProvider,
  ChatActorProvider,
  DkpActorProvider,
  NanasActorProvider,
  Nd64ActorProvider,
  BitsActorProvider,
  AlpacalbActorProvider,
  PartyActorProvider,
  SneedActorProvider,
  ClownActorProvider,
  ExeActorProvider,
  WumboActorProvider,
  McsActorProvider,
  DamonicActorProvider,
  BobActorProvider,
  BurnActorProvider,
  DcdActorProvider,
  DittoActorProvider,
  FplActorProvider,
  GldgovActorProvider,
  IcvcActorProvider,
  NtnActorProvider,
  OgyActorProvider,
  OwlActorProvider,
} from "./Actors/identityKitActorInitiation";
import "@nfid/identitykit/react/styles.css";
import {
  IdentityKitProvider,
  IdentityKitTheme,
  ConnectWalletButton,
} from "@nfid/identitykit/react";
import {
  NFIDW,
  Plug,
  InternetIdentity,
  Stoic,
  IdentityKitAuthType
} from "@nfid/identitykit";

const router = createBrowserRouter([
  {
    path: "/", // Root route, this handles "/" only
    element: <App />,
    errorElement: <NotFoundPage />, // Catch all errors
    children: [
      {
        path: "", // This matches the root URL "/"
        element: <></>, // MainPage (or swap page) handled by App itself
      },
      {
        path: "stats", // This matches "/stats"
        element: <></>, // StatsPage handled by App itself
      },
    ],
  },
  {
    path: "*", // Catch-all route outside of the main App component for any other invalid routes
    element: <NotFoundPage />,
  },
]);

console.log('derivationOrigin local', process.env.DFX_NETWORK === "local")

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IdentityKitProvider
      theme={IdentityKitTheme.LIGHT}
      signerClientOptions={{
        derivationOrigin:
          process.env.DFX_NETWORK === "local"
            ? "http://oaq4p-2iaaa-aaaar-qahqa-cai.localhost:4943"
            : "https://" + FRONTEND_URL + ".icp0.io",
        targets: ['l4lgk-raaaa-aaaar-qahpq-cai'],
      }}
      authType={IdentityKitAuthType.DELEGATION}
      signers={[NFIDW, Plug, InternetIdentity, Stoic]}
      onConnectFailure={(e) => {
        console.log("Connect failed", e);
      }}
      onConnectSuccess={(s) => {
        console.log("Connect success", s);
      }}
      onDisconnect={(e) => {
        console.log("Disconnect", e);
        window.location.reload()
      }}
    >
      <CkbtcActorProvider>
        <CkethActorProvider>
          <CkusdcActorProvider>
            <IcpActorProvider>
              <KingKongActorProvider>
                <KingKongFaucetActorProvider>
                  <CkusdtActorProvider>
                    <NICPActorProvider>
                      <WtnActorProvider>
                        <YugeActorProvider>
                          <ChatActorProvider>
                            <DkpActorProvider>
                              <NanasActorProvider>
                                <Nd64ActorProvider>
                                  <BitsActorProvider>
                                    <AlpacalbActorProvider>
                                      <PartyActorProvider>
                                        <SneedActorProvider>
                                          <ClownActorProvider>
                                            <ExeActorProvider>
                                              <WumboActorProvider>
                                                <McsActorProvider>
                                                  <DamonicActorProvider>
                                                    <BobActorProvider>
                                                      <BurnActorProvider>
                                                        <DcdActorProvider>
                                                          <DittoActorProvider>
                                                            <FplActorProvider>
                                                              <GldgovActorProvider>
                                                                <IcvcActorProvider>
                                                                  <NtnActorProvider>
                                                                    <OgyActorProvider>
                                                                      <OwlActorProvider>
                                                                        <RouterProvider
                                                                          router={
                                                                            router
                                                                          }
                                                                        ></RouterProvider>
                                                                      </OwlActorProvider>
                                                                    </OgyActorProvider>
                                                                  </NtnActorProvider>
                                                                </IcvcActorProvider>
                                                              </GldgovActorProvider>
                                                            </FplActorProvider>
                                                          </DittoActorProvider>
                                                        </DcdActorProvider>
                                                      </BurnActorProvider>
                                                    </BobActorProvider>
                                                  </DamonicActorProvider>
                                                </McsActorProvider>
                                              </WumboActorProvider>
                                            </ExeActorProvider>
                                          </ClownActorProvider>
                                        </SneedActorProvider>
                                      </PartyActorProvider>
                                    </AlpacalbActorProvider>
                                  </BitsActorProvider>
                                </Nd64ActorProvider>
                              </NanasActorProvider>
                            </DkpActorProvider>
                          </ChatActorProvider>
                        </YugeActorProvider>
                      </WtnActorProvider>
                    </NICPActorProvider>
                  </CkusdtActorProvider>
                </KingKongFaucetActorProvider>
              </KingKongActorProvider>
            </IcpActorProvider>
          </CkusdcActorProvider>
        </CkethActorProvider>
      </CkbtcActorProvider>
    </IdentityKitProvider>
  </React.StrictMode>
);