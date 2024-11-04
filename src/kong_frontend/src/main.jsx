import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.scss";
import "tippy.js/dist/tippy.css"; // optional
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { InternetIdentityProvider } from "ic-use-internet-identity";
import KongBackendActor from "./Actors/KONG-BACKEND-ACTOR";
import KongFaucetActor from "./Actors/KONG-FAUCET-ACTOR";
import CkbtcActor from "./Actors/CKBTC-ACTOR";
import CkethActor from "./Actors/CKETH-ACTOR";
import CkusdcActor from "./Actors/CKUSDC-ACTOR";
import IcpActor from "./Actors/ICP-ACTOR";
import CkusdtActor from "./Actors/CKUSDT-ACTOR";
import BITSActor from "./Actors/BITSActor";
import YUGEActor from "./Actors/YUGEActor";
import CHATActor from "./Actors/CHATActor";
import DKPActor from "./Actors/DKPActor";
import NANASActor from "./Actors/NANASActor";
import ND64Actor from "./Actors/ND64Actor";
import ALPACALBActor from "./Actors/ALPACALBActor";
import PARTYActor from "./Actors/PARTYActor";
import SNEEDActor from "./Actors/SNEEDActor";
import CLOWNActor from "./Actors/CLOWNActor";
import EXEActor from "./Actors/EXEActor";
import WUMBOActor from "./Actors/WUMBOActor";
import MCSActor from "./Actors/MCSActor";
import DAMONICActor from "./Actors/DAMONICActor";
import BOBActor from "./Actors/BOBActor";
import BURNActor from "./Actors/BURNActor";
import DCDActor from "./Actors/DCDActor";
import DITTOActor from "./Actors/DITTOActor";
import FPLActor from "./Actors/FPLActor";
import GLDGovActor from "./Actors/GLDGovActor";
import ICVCActor from "./Actors/ICVCActor";
import NTNActor from "./Actors/NTNActor";
import OGYActor from "./Actors/OGYActor";
import OWLActor from "./Actors/OWLActor";
import GLDTActor from "./Actors/GLDTActor";
import GHOSTActor from "./Actors/GHOSTActor";
import CTZActor from "./Actors/CTZActor";
import ELNAActor from "./Actors/ELNAActor";
import DOGMIActor from "./Actors/DOGMIActor";
import ESTActor from "./Actors/ESTActor";
import PANDAActor from "./Actors/PANDAActor";
import KINICActor from "./Actors/KINICActor";
import DOLRActor from "./Actors/DOLRActor";
import TRAXActor from "./Actors/TRAXActor";
import MOTOKOActor from "./Actors/MOTOKOActor";
import CKPEPEActor from "./Actors/CKPEPEActor";
import CKSHIBActor from "./Actors/CKSHIBActor";
import DODActor from "./Actors/DODActor";
import KONGActor from "./Actors/KONGActor";
import { PlugWalletProvider } from "./components/PlugWalletContext";
import { FRONTEND_URL } from "./constants/config";
import {
  CkbtcActorProviderPlug,
  CkethActorProviderPlug,
  CkusdcActorProviderPlug,
  IcpActorProviderPlug,
  KingKongActorProviderPlug,
  KingKongFaucetActorProviderPlug,
  CkusdtActorProviderPlug,
  NICPActorProviderPlug,
  WTNActorProviderPlug,
  YUGEActorProviderPlug,
  CHATActorProviderPlug,
  DKPActorProviderPlug,
  NANASActorProviderPlug,
  ND64ActorProviderPlug,
  BITSActorProviderPlug,
  AlpacaLBActorProviderPlug,
  PartyActorProviderPlug,
  SneedActorProviderPlug,
  ClownActorProviderPlug,
  ExeActorProviderPlug,
  WumboActorProviderPlug,
  McsActorProviderPlug,
  DamonicActorProviderPlug,
  BobActorProviderPlug,
  BurnActorProviderPlug,
  DCDActorProviderPlug,
  DITTOActorProviderPlug,
  FPLActorProviderPlug,
  GLDGovActorProviderPlug,
  ICVCActorProviderPlug,
  NTNActorProviderPlug,
  OGYActorProviderPlug,
  OWLActorProviderPlug,
  GLDTActorProviderPlug,
  GHOSTActorProviderPlug,
  CTZActorProviderPlug,
  ELNAActorProviderPlug,
  DOGMIActorProviderPlug,
  ESTActorProviderPlug,
  PANDAActorProviderPlug,
  KINICActorProviderPlug,
  DOLRActorProviderPlug,
  TRAXActorProviderPlug,
  MOTOKOActorProviderPlug,
  CKPEPEActorProviderPlug,
  CKSHIBActorProviderPlug,
  DODActorProviderPlug,
  KONGActorProviderPlug,
} from "./Actors/plugActorProviders";
import NICPActor from "./Actors/NICPActor";
import WTNActor from "./Actors/WTNActor";
import NotFoundPage from "./components/NotFoundPage";

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
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InternetIdentityProvider
      loginOptions={{
        maxTimeToLive: BigInt(1) * BigInt(3_600_000_000_000), // 1 hours
        derivationOrigin:
          process.env.DFX_NETWORK === "local"
            ? "http://oaq4p-2iaaa-aaaar-qahqa-cai.localhost:4943"
            : "https://" + FRONTEND_URL + ".icp0.io",
      }}
    >
      <PlugWalletProvider>
        <KingKongActorProviderPlug>
          <KingKongFaucetActorProviderPlug>
            <CkbtcActorProviderPlug>
              <CkethActorProviderPlug>
                <CkusdcActorProviderPlug>
                  <IcpActorProviderPlug>
                    <CkusdtActorProviderPlug>
                      <KongBackendActor>
                        <KongFaucetActor>
                          <CkbtcActor>
                            <CkethActor>
                              <CkusdcActor>
                                <IcpActor>
                                  <CkusdtActor>
                                    <BITSActor>
                                      <YUGEActor>
                                        <CHATActor>
                                          <DKPActor>
                                            <NANASActor>
                                              <ND64Actor>
                                                <WTNActor>
                                                  <NICPActor>
                                                    <NANASActorProviderPlug>
                                                      <ND64ActorProviderPlug>
                                                        <BITSActorProviderPlug>
                                                          <WTNActorProviderPlug>
                                                            <NICPActorProviderPlug>
                                                              <YUGEActorProviderPlug>
                                                                <CHATActorProviderPlug>
                                                                  <DKPActorProviderPlug>
                                                                    <CLOWNActor>
                                                                      <SNEEDActor>
                                                                        <PARTYActor>
                                                                          <ALPACALBActor>
                                                                            <EXEActor>
                                                                              <WUMBOActor>
                                                                                <MCSActor>
                                                                                  <DAMONICActor>
                                                                                    <BOBActor>
                                                                                      <BobActorProviderPlug>
                                                                                        <DamonicActorProviderPlug>
                                                                                          <McsActorProviderPlug>
                                                                                            <WumboActorProviderPlug>
                                                                                              <ExeActorProviderPlug>
                                                                                                <AlpacaLBActorProviderPlug>
                                                                                                  <PartyActorProviderPlug>
                                                                                                    <SneedActorProviderPlug>
                                                                                                      <ClownActorProviderPlug>
                                                                                                        <BURNActor>
                                                                                                          <BurnActorProviderPlug>
                                                                                                            <OWLActor>
                                                                                                              <OGYActor>
                                                                                                                <NTNActor>
                                                                                                                  <ICVCActor>
                                                                                                                    <GLDGovActor>
                                                                                                                      <FPLActor>
                                                                                                                        <DITTOActor>
                                                                                                                          <DCDActor>
                                                                                                                            <DCDActorProviderPlug>
                                                                                                                              <DITTOActorProviderPlug>
                                                                                                                                <FPLActorProviderPlug>
                                                                                                                                  <GLDGovActorProviderPlug>
                                                                                                                                    <ICVCActorProviderPlug>
                                                                                                                                      <NTNActorProviderPlug>
                                                                                                                                        <OGYActorProviderPlug>
                                                                                                                                          <OWLActorProviderPlug>
                                                                                                                                            <CKSHIBActorProviderPlug>
                                                                                                                                              <CKPEPEActorProviderPlug>
                                                                                                                                                <MOTOKOActorProviderPlug>
                                                                                                                                                  <TRAXActorProviderPlug>
                                                                                                                                                    <DOLRActorProviderPlug>
                                                                                                                                                      <KINICActorProviderPlug>
                                                                                                                                                        <PANDAActorProviderPlug>
                                                                                                                                                          <ESTActorProviderPlug>
                                                                                                                                                            <DOGMIActorProviderPlug>
                                                                                                                                                              <ELNAActorProviderPlug>
                                                                                                                                                                <CTZActorProviderPlug>
                                                                                                                                                                  <GHOSTActorProviderPlug>
                                                                                                                                                                    <GLDTActorProviderPlug>
                                                                                                                                                                      <DODActorProviderPlug>
                                                                                                                                                                        <CKSHIBActor>
                                                                                                                                                                          <CKPEPEActor>
                                                                                                                                                                            <MOTOKOActor>
                                                                                                                                                                              <TRAXActor>
                                                                                                                                                                                <DOLRActor>
                                                                                                                                                                                  <KINICActor>
                                                                                                                                                                                    <PANDAActor>
                                                                                                                                                                                      <ESTActor>
                                                                                                                                                                                        <DOGMIActor>
                                                                                                                                                                                          <ELNAActor>
                                                                                                                                                                                            <CTZActor>
                                                                                                                                                                                              <GHOSTActor>
                                                                                                                                                                                                <GLDTActor>
                                                                                                                                                                                                  <DODActor>
                                                                                                                                                                                                    <KONGActorProviderPlug>
                                                                                                                                                                                                        <KONGActor>
                                                                                                                                                                                                            <RouterProvider
                                                                                                                                                                                                              router={
                                                                                                                                                                                                                router
                                                                                                                                                                                                              }
                                                                                                                                                                                                            ></RouterProvider>
                                                                                                                                                                                                        </KONGActor>
                                                                                                                                                                                                    </KONGActorProviderPlug>
                                                                                                                                                                                                  </DODActor>
                                                                                                                                                                                                </GLDTActor>
                                                                                                                                                                                              </GHOSTActor>
                                                                                                                                                                                            </CTZActor>
                                                                                                                                                                                          </ELNAActor>
                                                                                                                                                                                        </DOGMIActor>
                                                                                                                                                                                      </ESTActor>
                                                                                                                                                                                    </PANDAActor>
                                                                                                                                                                                  </KINICActor>
                                                                                                                                                                                </DOLRActor>
                                                                                                                                                                              </TRAXActor>
                                                                                                                                                                            </MOTOKOActor>
                                                                                                                                                                          </CKPEPEActor>
                                                                                                                                                                        </CKSHIBActor>
                                                                                                                                                                      </DODActorProviderPlug>
                                                                                                                                                                    </GLDTActorProviderPlug>
                                                                                                                                                                  </GHOSTActorProviderPlug>
                                                                                                                                                                </CTZActorProviderPlug>
                                                                                                                                                              </ELNAActorProviderPlug>
                                                                                                                                                            </DOGMIActorProviderPlug>
                                                                                                                                                          </ESTActorProviderPlug>
                                                                                                                                                        </PANDAActorProviderPlug>
                                                                                                                                                      </KINICActorProviderPlug>
                                                                                                                                                    </DOLRActorProviderPlug>
                                                                                                                                                  </TRAXActorProviderPlug>
                                                                                                                                                </MOTOKOActorProviderPlug>
                                                                                                                                              </CKPEPEActorProviderPlug>
                                                                                                                                            </CKSHIBActorProviderPlug>
                                                                                                                                          </OWLActorProviderPlug>
                                                                                                                                        </OGYActorProviderPlug>
                                                                                                                                      </NTNActorProviderPlug>
                                                                                                                                    </ICVCActorProviderPlug>
                                                                                                                                  </GLDGovActorProviderPlug>
                                                                                                                                </FPLActorProviderPlug>
                                                                                                                              </DITTOActorProviderPlug>
                                                                                                                            </DCDActorProviderPlug>
                                                                                                                          </DCDActor>
                                                                                                                        </DITTOActor>
                                                                                                                      </FPLActor>
                                                                                                                    </GLDGovActor>
                                                                                                                  </ICVCActor>
                                                                                                                </NTNActor>
                                                                                                              </OGYActor>
                                                                                                            </OWLActor>
                                                                                                          </BurnActorProviderPlug>
                                                                                                        </BURNActor>
                                                                                                      </ClownActorProviderPlug>
                                                                                                    </SneedActorProviderPlug>
                                                                                                  </PartyActorProviderPlug>
                                                                                                </AlpacaLBActorProviderPlug>
                                                                                              </ExeActorProviderPlug>
                                                                                            </WumboActorProviderPlug>
                                                                                          </McsActorProviderPlug>
                                                                                        </DamonicActorProviderPlug>
                                                                                      </BobActorProviderPlug>
                                                                                    </BOBActor>
                                                                                  </DAMONICActor>
                                                                                </MCSActor>
                                                                              </WUMBOActor>
                                                                            </EXEActor>
                                                                          </ALPACALBActor>
                                                                        </PARTYActor>
                                                                      </SNEEDActor>
                                                                    </CLOWNActor>
                                                                  </DKPActorProviderPlug>
                                                                </CHATActorProviderPlug>
                                                              </YUGEActorProviderPlug>
                                                            </NICPActorProviderPlug>
                                                          </WTNActorProviderPlug>
                                                        </BITSActorProviderPlug>
                                                      </ND64ActorProviderPlug>
                                                    </NANASActorProviderPlug>
                                                  </NICPActor>
                                                </WTNActor>
                                              </ND64Actor>
                                            </NANASActor>
                                          </DKPActor>
                                        </CHATActor>
                                      </YUGEActor>
                                    </BITSActor>
                                  </CkusdtActor>
                                </IcpActor>
                              </CkusdcActor>
                            </CkethActor>
                          </CkbtcActor>
                        </KongFaucetActor>
                      </KongBackendActor>
                    </CkusdtActorProviderPlug>
                  </IcpActorProviderPlug>
                </CkusdcActorProviderPlug>
              </CkethActorProviderPlug>
            </CkbtcActorProviderPlug>
          </KingKongFaucetActorProviderPlug>
        </KingKongActorProviderPlug>
      </PlugWalletProvider>
    </InternetIdentityProvider>
  </React.StrictMode>
);
