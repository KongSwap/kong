import KongBackendActor from "../Actors/KONG-BACKEND-ACTOR";
import KongFaucetActor from "../Actors/KONG-FAUCET-ACTOR";
import CkbtcActor from "../Actors/CKBTC-ACTOR";
import CkethActor from "../Actors/CKETH-ACTOR";
import CkusdcActor from "../Actors/CKUSDC-ACTOR";
import IcpActor from "../Actors/ICP-ACTOR";
import CkusdtActor from "../Actors/CKUSDT-ACTOR";
import BITSActor from "../Actors/BITSActor";
import YUGEActor from "../Actors/YUGEActor";
import CHATActor from "../Actors/CHATActor";
import DKPActor from "../Actors/DKPActor";
import NANASActor from "../Actors/NANASActor";
import ND64Actor from "../Actors/ND64Actor";
import ALPACALBActor from "../Actors/ALPACALBActor";
import PARTYActor from "../Actors/PARTYActor";
import SNEEDActor from "../Actors/SNEEDActor";
import CLOWNActor from "../Actors/CLOWNActor";
import EXEActor from "../Actors/EXEActor";
import WUMBOActor from "../Actors/WUMBOActor";
import MCSActor from "../Actors/MCSActor";
import DAMONICActor from "../Actors/DAMONICActor";
import BOBActor from "../Actors/BOBActor";
import BURNActor from "../Actors/BURNActor";
import DCDActor from "../Actors/DCDActor";
import DITTOActor from "../Actors/DITTOActor";
import FPLActor from "../Actors/FPLActor";
import GLDGovActor from "../Actors/GLDGovActor";
import ICVCActor from "../Actors/ICVCActor";
import NTNActor from "../Actors/NTNActor";
import OGYActor from "../Actors/OGYActor";
import OWLActor from "../Actors/OWLActor";
import NICPActor from "../Actors/NICPActor";
import WTNActor from "../Actors/WTNActor";
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
} from "../Actors/plugActorProviders";

const WrapWithProviders = ({ children }) => {
  const Actors = [
    KongBackendActor,
    KongFaucetActor,
    CkbtcActor,
    CkethActor,
    CkusdcActor,
    IcpActor,
    CkusdtActor,
    BITSActor,
    YUGEActor,
    CHATActor,
    DKPActor,
    NANASActor,
    ND64Actor,
    ALPACALBActor,
    PARTYActor,
    SNEEDActor,
    CLOWNActor,
    EXEActor,
    WUMBOActor,
    MCSActor,
    DAMONICActor,
    BOBActor,
    BURNActor,
    DCDActor,
    DITTOActor,
    FPLActor,
    GLDGovActor,
    ICVCActor,
    NTNActor,
    OGYActor,
    OWLActor,
    NICPActor,
    WTNActor
  ];

  const PlugProviders = [
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
    OWLActorProviderPlug
  ];

  return Actors.reduce((accumulator, Actor) => (
    <Actor>{accumulator}</Actor>
  ), PlugProviders.reduce((accumulator, Provider) => (
    <Provider>{accumulator}</Provider>
  ), children));
};

export default WrapWithProviders;