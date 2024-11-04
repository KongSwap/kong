import { useState, useEffect, useCallback, useRef } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { 
  useKingKongBackendPlug,
  useKingKongFaucetBackendPlug,
  useIcpBackendPlug,
  useCkbtcBackendPlug,
  useCkethBackendPlug,
  useCkusdcBackendPlug,
  useCkusdtBackendPlug,
  useDKPBackendPlug,
  useBITSBackendPlug,
  useCHATBackendPlug,
  useNANASBackendPlug,
  useND64BackendPlug,
  useWTNBackendPlug,
  useYUGEBackendPlug,
  useNICPBackendPlug,
  useAlpacaLBBackendPlug,
  usePartyBackendPlug,
  useSneedBackendPlug,
  useClownBackendPlug,
  useExeBackendPlug,
  useWumboBackendPlug,
  useMcsBackendPlug,
  useDamonicBackendPlug,
  useBobBackendPlug,
  useBurnBackendPlug,
  useNTNBackendPlug,
  useDCDBackendPlug,
  useGLDGovBackendPlug,
  useOWLBackendPlug,
  useOGYBackendPlug,
  useFPLBackendPlug,
  useDITTOBackendPlug,
  useICVCBackendPlug,
  useGLDTBackendPlug,
  useGHOSTBackendPlug,
  useCTZBackendPlug,
  useELNABackendPlug,
  useDOGMIBackendPlug,
  useESTBackendPlug,
  usePANDABackendPlug,
  useKINICBackendPlug,
  useDOLRBackendPlug,
  useTRAXBackendPlug,
  useMOTOKOBackendPlug,
  useCKPEPEBackendPlug,
  useCKSHIBBackendPlug,
  useDODBackendPlug,
  useKONGBackendPlug,
} from '../Actors/plugActorProviders';
import { useCkbtcBackend } from '../Actors/CKBTC-ACTOR';
import { useKingKongFaucetBackend } from '../Actors/KONG-FAUCET-ACTOR';
import { useIcpBackend } from '../Actors/ICP-ACTOR';
import { useCkethBackend } from '../Actors/CKETH-ACTOR';
import { useCkusdcBackend } from '../Actors/CKUSDC-ACTOR';
import { useKingKongBackend } from "../Actors/KONG-BACKEND-ACTOR";
import { useCkusdtBackend } from '../Actors/CKUSDT-ACTOR';
import { useDKPBackend } from '../Actors/DKPActor';
import { useBITSBackend } from '../Actors/BITSActor';
import { useCHATBackend } from '../Actors/CHATActor';
import { useNANASBackend } from '../Actors/NANASActor';
import { useND64Backend } from '../Actors/ND64Actor';
import { useWTNBackend } from '../Actors/WTNActor';
import { useYUGEBackend } from '../Actors/YUGEActor';
import { usePlugWallet } from './PlugWalletContext';
import { useNICPBackend } from '../Actors/NICPActor';
import { useEXEBackend } from '../Actors/EXEActor';
import { useALPACALBBackend } from '../Actors/ALPACALBActor';
import { usePARTYBackend } from '../Actors/PARTYActor';
import { useSNEEDBackend } from '../Actors/SNEEDActor';
import { useCLOWNBackend } from '../Actors/CLOWNActor';
import { useWUMBOBackend } from '../Actors/WUMBOActor';
import { useMCSBackend } from '../Actors/MCSActor';
import { useDAMONICBackend } from '../Actors/DAMONICActor';
import { useBOBBackend } from '../Actors/BOBActor';
import { useBURNBackend } from '../Actors/BURNActor';
import { useNTNBackend } from '../Actors/NTNActor';
import { useDCDBackend } from '../Actors/DCDActor';
import { useGLDGovBackend } from '../Actors/GLDGovActor';
import { useOWLBackend } from '../Actors/OWLActor';
import { useOGYBackend } from '../Actors/OGYActor';
import { useFPLBackend } from '../Actors/FPLActor';
import { useDITTOBackend } from '../Actors/DITTOActor';
import { useICVCBackend } from '../Actors/ICVCActor';
import { useGLDTBackend } from '../Actors/GLDTActor';
import { useGHOSTBackend } from '../Actors/GHOSTActor';
import { useCTZBackend } from '../Actors/CTZActor';
import { useELNABackend } from '../Actors/ELNAActor';
import { useDOGMIBackend } from '../Actors/DOGMIActor';
import { useESTBackend } from '../Actors/ESTActor';
import { usePANDABackend } from '../Actors/PANDAActor';
import { useKINICBackend } from '../Actors/KINICActor';
import { useDOLRBackend } from '../Actors/DOLRActor';
import { useTRAXBackend } from '../Actors/TRAXActor';
import { useMOTOKOBackend } from '../Actors/MOTOKOActor';
import { useCKPEPEBackend } from '../Actors/CKPEPEActor';
import { useCKSHIBBackend } from '../Actors/CKSHIBActor';
import { useDODBackend } from '../Actors/DODActor';
import { useKONGBackend } from '../Actors/KONGActor';

import {
  getActor as kong_backend
} from "../lib/kong_backend";


const useIdentity = () => {
  const { isLoggingIn, login, clear, identity: iiIdentity } = useInternetIdentity();
  const { isConnected, principal: plugPrincipal, connectPlugWallet, disconnectPlugWallet } = usePlugWallet();
  
  const [activeIdentity, setActiveIdentity] = useState(null);
  const [identityType, setIdentityType] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [expiredSession, setExpiredSession] = useState(false); // New state to track session expiration

  const sessionTimeoutSet = useRef(false); // Track if session timeout is already set

  const { actor: backendKingKong } = useKingKongBackend();
  const { actor: backendKingKongFaucet } = useKingKongFaucetBackend();
  const { actor: icp_ledger_backend } = useIcpBackend();
  const { actor: ckbtc_ledger_backend } = useCkbtcBackend();
  const { actor: cketh_ledger_backend } = useCkethBackend();
  const { actor: ckusdc_ledger_backend } = useCkusdcBackend();
  const { actor: ckusdt_ledger_backend } = useCkusdtBackend();
  const { actor: dkp_ledger_backend } = useDKPBackend();
  const { actor: bits_ledger_backend } = useBITSBackend();
  const { actor: chat_ledger_backend } = useCHATBackend();
  const { actor: nanas_ledger_backend } = useNANASBackend();
  const { actor: nd64_ledger_backend } = useND64Backend();
  const { actor: wtn_ledger_backend } = useWTNBackend();
  const { actor: yuge_ledger_backend } = useYUGEBackend();
  const { actor: NICP_ledger_backend } = useNICPBackend();
  const { actor: alpacalb_backend } = useALPACALBBackend();
  const { actor: party_backend } = usePARTYBackend();
  const { actor: sneed_backend } = useSNEEDBackend();
  const { actor: clown_backend } = useCLOWNBackend();
  const { actor: exe_backend } = useEXEBackend();
  const { actor: wumbo_backend } = useWUMBOBackend();
  const { actor: mcs_backend } = useMCSBackend();
  const { actor: damonic_backend } = useDAMONICBackend();
  const { actor: bob_backend } = useBOBBackend();
  const { actor: burn_backend } = useBURNBackend();
  const { actor: ntn_backend } = useNTNBackend();
  const { actor: dcd_backend } = useDCDBackend();
  const { actor: gldgov_backend } = useGLDGovBackend();
  const { actor: owl_backend } = useOWLBackend();
  const { actor: ogy_backend } = useOGYBackend();
  const { actor: fpl_backend } = useFPLBackend();
  const { actor: ditto_backend } = useDITTOBackend();
  const { actor: icvc_backend } = useICVCBackend();
  const { actor: gldt_backend } = useGLDTBackend();
  const { actor: ghost_backend } = useGHOSTBackend();
  const { actor: ctz_backend } = useCTZBackend();
  const { actor: elna_backend } = useELNABackend();
  const { actor: dogmi_backend } = useDOGMIBackend();
  const { actor: est_backend } = useESTBackend();
  const { actor: panda_backend } = usePANDABackend();
  const { actor: kinic_backend } = useKINICBackend();
  const { actor: dolr_backend } = useDOLRBackend();
  const { actor: trax_backend } = useTRAXBackend();
  const { actor: motoko_backend } = useMOTOKOBackend();
  const { actor: ckpepe_backend } = useCKPEPEBackend();
  const { actor: ckshib_backend } = useCKSHIBBackend();
  const { actor: dod_backend } = useDODBackend();
  const { actor: kong_ledger_backend } = useKONGBackend();

  const { plugActor: backendKingKongPlug, isInitialized: isInitializedKingKongPlug } = useKingKongBackendPlug();
  const { plugActor: backendKingKongFaucetPlug, isInitialized: isInitializedKingKongFaucetPlug } = useKingKongFaucetBackendPlug();
  const { plugActor: icp_ledger_backendPlug, isInitialized: isInitializedIcpPlug } = useIcpBackendPlug();
  const { plugActor: ckbtc_ledger_backendPlug, isInitialized: isInitializedCkbtcPlug } = useCkbtcBackendPlug();
  const { plugActor: cketh_ledger_backendPlug, isInitialized: isInitializedCkethPlug } = useCkethBackendPlug();
  const { plugActor: ckusdc_ledger_backendPlug, isInitialized: isInitializedCkusdcPlug } = useCkusdcBackendPlug();
  const { plugActor: ckusdt_ledger_backendPlug, isInitialized: isInitializedCkusdtPlug } = useCkusdtBackendPlug();
  const { plugActor: dkp_backend_plug, isInitialized: isInitializedDKPlug } = useDKPBackendPlug();
  const { plugActor: bits_backend_plug, isInitialized: isInitializedBITSPlug } = useBITSBackendPlug();
  const { plugActor: chat_backend_plug, isInitialized: isInitializedCHATPlug } = useCHATBackendPlug();
  const { plugActor: nanas_backend_plug, isInitialized: isInitializedNANASPlug } = useNANASBackendPlug();
  const { plugActor: nd64_backend_plug, isInitialized: isInitializedND64Plug } = useND64BackendPlug();
  const { plugActor: wtn_backend_plug, isInitialized: isInitializedWTNPlug } = useWTNBackendPlug();
  const { plugActor: yuge_backend_plug, isInitialized: isInitializedYUGEPlug } = useYUGEBackendPlug();
  const { plugActor: NICP_backend_plug, isInitialized: isInitializedNICPPlug } = useNICPBackendPlug();
  const { plugActor: alpacalb_backendPlug, isInitialized: isInitializedAlpacaLBPlug } = useAlpacaLBBackendPlug();
  const { plugActor: party_backendPlug, isInitialized: isInitializedPartyPlug } = usePartyBackendPlug();
  const { plugActor: sneed_backendPlug, isInitialized: isInitializedSneedPlug } = useSneedBackendPlug();
  const { plugActor: clown_backendPlug, isInitialized: isInitializedClownPlug } = useClownBackendPlug();
  const { plugActor: exe_backendPlug, isInitialized: isInitializedExePlug } = useExeBackendPlug();
  const { plugActor: wumbo_backendPlug, isInitialized: isInitializedWumboPlug } = useWumboBackendPlug();
  const { plugActor: mcs_backendPlug, isInitialized: isInitializedMcsPlug } = useMcsBackendPlug();
  const { plugActor: damonic_backendPlug, isInitialized: isInitializedDamonicPlug } = useDamonicBackendPlug();
  const { plugActor: bob_backendPlug, isInitialized: isInitializedBobPlug } = useBobBackendPlug();
  const { plugActor: burn_backendPlug, isInitialized: isInitializedBurnPlug } = useBurnBackendPlug();
  const { plugActor: ntn_backendPlug, isInitialized: isInitializedNtnPlug } = useNTNBackendPlug();
  const { plugActor: dcd_backendPlug, isInitialized: isInitializedDcdPlug } = useDCDBackendPlug();
  const { plugActor: gldgov_backendPlug, isInitialized: isInitializedGldGovPlug } = useGLDGovBackendPlug();
  const { plugActor: owl_backendPlug, isInitialized: isInitializedOwlPlug } = useOWLBackendPlug();
  const { plugActor: ogy_backendPlug, isInitialized: isInitializedOgyPlug } = useOGYBackendPlug();
  const { plugActor: fpl_backendPlug, isInitialized: isInitializedFplPlug } = useFPLBackendPlug();
  const { plugActor: ditto_backendPlug, isInitialized: isInitializedDittoPlug } = useDITTOBackendPlug();
  const { plugActor: icvc_backendPlug, isInitialized: isInitializedIcvcPlug } = useICVCBackendPlug();
  const { plugActor: gldt_backendPlug, isInitialized: isInitializedGldtPlug } = useGLDTBackendPlug();
  const { plugActor: ghost_backendPlug, isInitialized: isInitializedGhostPlug } = useGHOSTBackendPlug();
  const { plugActor: ctz_backendPlug, isInitialized: isInitializedCtzPlug } = useCTZBackendPlug();
  const { plugActor: elna_backendPlug, isInitialized: isInitializedElnaPlug } = useELNABackendPlug();
  const { plugActor: dogmi_backendPlug, isInitialized: isInitializedDogmiPlug } = useDOGMIBackendPlug();
  const { plugActor: est_backendPlug, isInitialized: isInitializedEstPlug } = useESTBackendPlug();
  const { plugActor: panda_backendPlug, isInitialized: isInitializedPandaPlug } = usePANDABackendPlug();
  const { plugActor: kinic_backendPlug, isInitialized: isInitializedKinicPlug } = useKINICBackendPlug();
  const { plugActor: dolr_backendPlug, isInitialized: isInitializedDolrPlug } = useDOLRBackendPlug();
  const { plugActor: trax_backendPlug, isInitialized: isInitializedTraxPlug } = useTRAXBackendPlug();
  const { plugActor: motoko_backendPlug, isInitialized: isInitializedMotokoPlug } = useMOTOKOBackendPlug();
  const { plugActor: ckpepe_backendPlug, isInitialized: isInitializedCkpepePlug } = useCKPEPEBackendPlug();
  const { plugActor: ckshib_backendPlug, isInitialized: isInitializedCkshibPlug } = useCKSHIBBackendPlug();
  const { plugActor: dod_backendPlug, isInitialized: isInitializedDodPlug } = useDODBackendPlug();
  const { plugActor: kong_backendPlug, isInitialized: isInitializedKongPlug } = useKONGBackendPlug();

  useEffect(() => {
    // Handle identity changes and session expiration in one effect
    if (!isConnected && !iiIdentity && !plugPrincipal) {
      setActiveIdentity(null);
      setIdentityType(null);
    }
    if (iiIdentity && identityType !== 'ii') {
      setIsAuthenticated(true);
      setActiveIdentity(iiIdentity);
      setIdentityType('ii');
    } else if (plugPrincipal && identityType !== 'plug') {
      setIsAuthenticated(true);
      setActiveIdentity(plugPrincipal);
      setIdentityType('plug');
    } else if (!iiIdentity && !plugPrincipal && isAuthenticated) {
      // Handle disconnection
      setIsAuthenticated(false);
      setIdentityType(null);
    }

    if (iiIdentity && !sessionTimeoutSet.current) {
      const delegationArray = iiIdentity.getDelegation().delegations;

      if (delegationArray && delegationArray.length > 0 && delegationArray[0].delegation.expiration) {
        const expirationTime = delegationArray[0].delegation.expiration; // BigInt (nanoseconds)
        const nowInMilliseconds = Date.now(); // Regular number (milliseconds)
        const nowInNanoseconds = BigInt(nowInMilliseconds) * BigInt(1_000_000); // Convert current time to nanoseconds

        // Calculate the remaining time in nanoseconds (BigInt)
        const remainingTime = expirationTime - nowInNanoseconds;

        // Convert the remaining time to milliseconds (regular number)
        const remainingTimeInMilliseconds = Number(remainingTime / BigInt(1_000_000)); // nanoseconds to milliseconds

        if (remainingTimeInMilliseconds > 0) {
          sessionTimeoutSet.current = true; // Prevent multiple timeouts

          const timeoutId = setTimeout(() => {
            setExpiredSession(true); // Set expiredSession to true when session expires
          }, remainingTimeInMilliseconds);

          return () => {
            clearTimeout(timeoutId);
            sessionTimeoutSet.current = false; // Reset if the component unmounts or effect is cleaned up
          };
        }
      } else {
        console.log('Delegation or expiration time is undefined.');
      }
    }
  }, [iiIdentity, plugPrincipal, identityType, isAuthenticated, clear, isConnected]); // Combined dependencies


  return {
    activeIdentity,
    identityType,
    isLoggingIn,
    login,
    clear,
    isConnected,
    connectPlugWallet,
    disconnectPlugWallet,
    isAuthenticated,
    expiredSession, // Return expiredSession to be used in the app
    plugPrincipal,
    actors: {
      backendKingKong: !identityType ? kong_backend() : identityType === 'ii' ? backendKingKong : backendKingKongPlug,
      backendKingKongFaucet: identityType === 'ii' ? backendKingKongFaucet : backendKingKongFaucetPlug,
      icp_ledger_backend: identityType === 'ii' ? icp_ledger_backend : icp_ledger_backendPlug,
      ckbtc_ledger_backend: identityType === 'ii' ? ckbtc_ledger_backend : ckbtc_ledger_backendPlug,
      cketh_ledger_backend: identityType === 'ii' ? cketh_ledger_backend : cketh_ledger_backendPlug,
      ckusdc_ledger_backend: identityType === 'ii' ? ckusdc_ledger_backend : ckusdc_ledger_backendPlug,
      ckusdt_ledger_backend: identityType === 'ii' ? ckusdt_ledger_backend : ckusdt_ledger_backendPlug,
      dkp_ledger_backend: identityType === 'ii' ? dkp_ledger_backend : dkp_backend_plug,
      bits_ledger_backend: identityType === 'ii' ? bits_ledger_backend : bits_backend_plug,
      chat_ledger_backend: identityType === 'ii' ? chat_ledger_backend : chat_backend_plug,
      nanas_ledger_backend: identityType === 'ii' ? nanas_ledger_backend : nanas_backend_plug,
      nd64_ledger_backend: identityType === 'ii' ? nd64_ledger_backend : nd64_backend_plug,
      wtn_ledger_backend: identityType === 'ii' ? wtn_ledger_backend : wtn_backend_plug,
      yuge_ledger_backend: identityType === 'ii' ? yuge_ledger_backend : yuge_backend_plug,
      NICP_ledger_backend: identityType === 'ii' ? NICP_ledger_backend : NICP_backend_plug,
      alpacalb_backend: identityType === 'ii' ? alpacalb_backend : alpacalb_backendPlug,
      party_backend: identityType === 'ii' ? party_backend : party_backendPlug,
      sneed_backend: identityType === 'ii' ? sneed_backend : sneed_backendPlug,
      clown_backend: identityType === 'ii' ? clown_backend : clown_backendPlug,
      exe_backend: identityType === 'ii' ? exe_backend : exe_backendPlug,
      wumbo_backend: identityType === 'ii' ? wumbo_backend : wumbo_backendPlug,
      mcs_backend: identityType === 'ii' ? mcs_backend : mcs_backendPlug,
      damonic_backend: identityType === 'ii' ? damonic_backend : damonic_backendPlug,
      bob_backend: identityType === 'ii' ? bob_backend : bob_backendPlug,
      burn_backend: identityType === 'ii' ? burn_backend : burn_backendPlug,
      ntn_backend: identityType === 'ii' ? ntn_backend : ntn_backendPlug,
      dcd_backend: identityType === 'ii' ? dcd_backend : dcd_backendPlug,
      gldgov_backend: identityType === 'ii' ? gldgov_backend : gldgov_backendPlug,
      owl_backend: identityType === 'ii' ? owl_backend : owl_backendPlug,
      ogy_backend: identityType === 'ii' ? ogy_backend : ogy_backendPlug,
      fpl_backend: identityType === 'ii' ? fpl_backend : fpl_backendPlug,
      ditto_backend: identityType === 'ii' ? ditto_backend : ditto_backendPlug,
      icvc_backend: identityType === 'ii' ? icvc_backend : icvc_backendPlug,
      gldt_backend: identityType === 'ii' ? gldt_backend : gldt_backendPlug,
      ghost_backend: identityType === 'ii' ? ghost_backend : ghost_backendPlug,
      ctz_backend: identityType === 'ii' ? ctz_backend : ctz_backendPlug,
      elna_backend: identityType === 'ii' ? elna_backend : elna_backendPlug,
      dogmi_backend: identityType === 'ii' ? dogmi_backend : dogmi_backendPlug,
      est_backend: identityType === 'ii' ? est_backend : est_backendPlug,
      panda_backend: identityType === 'ii' ? panda_backend : panda_backendPlug,
      kinic_backend: identityType === 'ii' ? kinic_backend : kinic_backendPlug,
      dolr_backend: identityType === 'ii' ? dolr_backend : dolr_backendPlug,
      trax_backend: identityType === 'ii' ? trax_backend : trax_backendPlug,
      motoko_backend: identityType === 'ii' ? motoko_backend : motoko_backendPlug,
      ckpepe_backend: identityType === 'ii' ? ckpepe_backend : ckpepe_backendPlug,
      ckshib_backend: identityType === 'ii' ? ckshib_backend : ckshib_backendPlug,
      dod_backend: identityType === 'ii' ? dod_backend : dod_backendPlug,
      kong_ledger_backend: identityType === 'ii' ? kong_ledger_backend : kong_backendPlug,
    },
    isInitialized: identityType === 'ii'
    ? !!backendKingKong
    : identityType === 'plug'
    ? isInitializedKingKongPlug
    : false, //
  };
};

export default useIdentity;