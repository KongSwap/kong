// plugActorProviders.js
import { createPlugWalletActorProvider } from './createPlugWalletActorProvider.jsx';
import { idlFactory as ckbtcIdlFactory, canisterId as ckbtcCanisterId } from '../../../declarations/ckbtc_ledger/index.js';
import { idlFactory as ckethIdlFactory, canisterId as ckethCanisterId } from '../../../declarations/cketh_ledger/index.js';
import { idlFactory as ckusdcIdlFactory, canisterId as ckusdcCanisterId } from '../../../declarations/ckusdc_ledger/index.js';
import { idlFactory as icpIdlFactory, canisterId as icpCanisterId } from '../../../declarations/icp_ledger/index.js';
import { idlFactory as kingKongIdlFactory, canisterId as kingKongCanisterId } from '../../../declarations/kong_backend/index.js';
import { idlFactory as kingKongFaucetIdlFactory, canisterId as kingKongFaucetCanisterId } from '../../../declarations/kong_faucet/index.js';
// import { idlFactory as kongIdlFactory, canisterId as kongCanisterId } from '../../../declarations/kong_ledger/index.js';
import { idlFactory as ckusdtIdlFactory, canisterId as ckusdtCanisterId } from '../../../declarations/ckusdt_ledger/index.js';
import { idlFactory as NICPIdlFactory, canisterId as NICPCanisterId } from '../../../declarations/nicp_ledger/index.js';
import { idlFactory as wtnIdlFactory, canisterId as wtnCanisterId } from '../../../declarations/wtn_ledger/index.js';
import { idlFactory as yugeIdlFactory, canisterId as yugeCanisterId } from '../../../declarations/yuge_ledger/index.js';
import { idlFactory as chatIdlFactory, canisterId as chatCanisterId } from '../../../declarations/chat_ledger/index.js';
import { idlFactory as dkpIdlFactory, canisterId as dkpCanisterId } from '../../../declarations/dkp_ledger/index.js';
import { idlFactory as nanasIdlFactory, canisterId as nanasCanisterId } from '../../../declarations/nanas_ledger/index.js';
import { idlFactory as nd64IdlFactory, canisterId as nd64CanisterId } from '../../../declarations/nd64_ledger/index.js';
import { idlFactory as bitsIdlFactory, canisterId as bitsCanisterId } from '../../../declarations/bits_ledger/index.js';
import { idlFactory as alpacalbIdlFactory, canisterId as alpacalbCanisterId } from '../../../declarations/alpacalb_ledger/index.js';
import { idlFactory as partyIdlFactory, canisterId as partyCanisterId } from '../../../declarations/party_ledger/index.js';
import { idlFactory as sneedIdlFactory, canisterId as sneedCanisterId } from '../../../declarations/sneed_ledger/index.js';
import { idlFactory as clownIdlFactory, canisterId as clownCanisterId } from '../../../declarations/clown_ledger/index.js';
import { idlFactory as exeIdlFactory, canisterId as exeCanisterId } from '../../../declarations/exe_ledger/index.js';
import { idlFactory as wumboIdlFactory, canisterId as wumboCanisterId } from '../../../declarations/wumbo_ledger/index.js';
import { idlFactory as mcsIdlFactory, canisterId as mcsCanisterId } from '../../../declarations/mcs_ledger/index.js';
import { idlFactory as damonicIdlFactory, canisterId as damonicCanisterId } from '../../../declarations/damonic_ledger/index.js';
import { idlFactory as bobIdlFactory, canisterId as bobCanisterId } from '../../../declarations/bob_ledger/index.js';
import { idlFactory as burnIdlFactory, canisterId as burnCanisterId } from '../../../declarations/burn_ledger/index.js';
import { idlFactory as dcdIdlFactory, canisterId as dcdCanisterId } from '../../../declarations/dcd_ledger/index.js';
import { idlFactory as dittoIdlFactory, canisterId as dittoCanisterId } from '../../../declarations/ditto_ledger/index.js';
import { idlFactory as fplIdlFactory, canisterId as fplCanisterId } from '../../../declarations/fpl_ledger/index.js';
import { idlFactory as gldgovIdlFactory, canisterId as gldgovCanisterId } from '../../../declarations/gldgov_ledger/index.js';
import { idlFactory as icvcIdlFactory, canisterId as icvcCanisterId } from '../../../declarations/icvc_ledger/index.js';
import { idlFactory as ntnIdlFactory, canisterId as ntnCanisterId } from '../../../declarations/ntn_ledger/index.js';
import { idlFactory as ogyIdlFactory, canisterId as ogyCanisterId } from '../../../declarations/ogy_ledger/index.js';
import { idlFactory as owlIdlFactory, canisterId as owlCanisterId } from '../../../declarations/owl_ledger/index.js';
import { idlFactory as gldtIdlFactory, canisterId as gldtCanisterId } from '../../../declarations/gldt_ledger/index.js';
import { idlFactory as ghostIdlFactory, canisterId as ghostCanisterId } from '../../../declarations/ghost_ledger/index.js';
import { idlFactory as ctzIdlFactory, canisterId as ctzCanisterId } from '../../../declarations/ctz_ledger/index.js';
import { idlFactory as elnaIdlFactory, canisterId as elnaCanisterId } from '../../../declarations/elna_ledger/index.js';
import { idlFactory as dogmiIdlFactory, canisterId as dogmiCanisterId } from '../../../declarations/dogmi_ledger/index.js';
import { idlFactory as estIdlFactory, canisterId as estCanisterId } from '../../../declarations/est_ledger/index.js';
import { idlFactory as pandaIdlFactory, canisterId as pandaCanisterId } from '../../../declarations/panda_ledger/index.js';
import { idlFactory as kinicIdlFactory, canisterId as kinicCanisterId } from '../../../declarations/kinic_ledger/index.js';
import { idlFactory as dolrIdlFactory, canisterId as dolrCanisterId } from '../../../declarations/dolr_ledger/index.js';
import { idlFactory as traxIdlFactory, canisterId as traxCanisterId } from '../../../declarations/trax_ledger/index.js';
import { idlFactory as motokoIdlFactory, canisterId as motokoCanisterId } from '../../../declarations/motoko_ledger/index.js';
import { idlFactory as ckpepeIdlFactory, canisterId as ckpepeCanisterId } from '../../../declarations/ckpepe_ledger/index.js';
import { idlFactory as ckshibIdlFactory, canisterId as ckshibCanisterId } from '../../../declarations/ckshib_ledger/index.js';
import { idlFactory as dodIdlFactory, canisterId as dodCanisterId } from '../../../declarations/dod_ledger/index.js';
import { idlFactory as kongIdlFactory, canisterId as kongCanisterId } from '../../../declarations/kong_ledger/index.js';
import { idlFactory as kong1IdlFactory, canisterId as kong1CanisterId } from '../../../declarations/kong1_ledger/index.js';
import { idlFactory as kong2IdlFactory, canisterId as kong2CanisterId } from '../../../declarations/kong2_ledger/index.js';



export const {
  PlugWalletActorProvider: CkbtcActorProviderPlug,
  usePlugWalletActor: useCkbtcBackendPlug,
} = createPlugWalletActorProvider(ckbtcIdlFactory, ckbtcCanisterId);

export const {
  PlugWalletActorProvider: CkethActorProviderPlug,
  usePlugWalletActor: useCkethBackendPlug,
} = createPlugWalletActorProvider(ckethIdlFactory, ckethCanisterId);

export const {
  PlugWalletActorProvider: CkusdcActorProviderPlug,
  usePlugWalletActor: useCkusdcBackendPlug,
} = createPlugWalletActorProvider(ckusdcIdlFactory, ckusdcCanisterId);

export const {
  PlugWalletActorProvider: IcpActorProviderPlug,
  usePlugWalletActor: useIcpBackendPlug,
} = createPlugWalletActorProvider(icpIdlFactory, icpCanisterId);

export const {
  PlugWalletActorProvider: KingKongActorProviderPlug,
  usePlugWalletActor: useKingKongBackendPlug,
} = createPlugWalletActorProvider(kingKongIdlFactory, kingKongCanisterId);

export const {
  PlugWalletActorProvider: KingKongFaucetActorProviderPlug,
  usePlugWalletActor: useKingKongFaucetBackendPlug,
} = createPlugWalletActorProvider(kingKongFaucetIdlFactory, kingKongFaucetCanisterId);

export const {
  PlugWalletActorProvider: CkusdtActorProviderPlug,
  usePlugWalletActor: useCkusdtBackendPlug,
} = createPlugWalletActorProvider(ckusdtIdlFactory, ckusdtCanisterId);

export const {
  PlugWalletActorProvider: NICPActorProviderPlug,
  usePlugWalletActor: useNICPBackendPlug,
} = createPlugWalletActorProvider(NICPIdlFactory, NICPCanisterId);

export const {
  PlugWalletActorProvider: WTNActorProviderPlug,
  usePlugWalletActor: useWTNBackendPlug,
} = createPlugWalletActorProvider(wtnIdlFactory, wtnCanisterId);

export const {
  PlugWalletActorProvider: YUGEActorProviderPlug,
  usePlugWalletActor: useYUGEBackendPlug,
} = createPlugWalletActorProvider(yugeIdlFactory, yugeCanisterId);

export const {
  PlugWalletActorProvider: CHATActorProviderPlug,
  usePlugWalletActor: useCHATBackendPlug,
} = createPlugWalletActorProvider(chatIdlFactory, chatCanisterId);

export const {
  PlugWalletActorProvider: DKPActorProviderPlug,
  usePlugWalletActor: useDKPBackendPlug,
} = createPlugWalletActorProvider(dkpIdlFactory, dkpCanisterId);

export const {
  PlugWalletActorProvider: NANASActorProviderPlug,
  usePlugWalletActor: useNANASBackendPlug,
} = createPlugWalletActorProvider(nanasIdlFactory, nanasCanisterId);

export const {
  PlugWalletActorProvider: ND64ActorProviderPlug,
  usePlugWalletActor: useND64BackendPlug,
} = createPlugWalletActorProvider(nd64IdlFactory, nd64CanisterId);

export const {
  PlugWalletActorProvider: BITSActorProviderPlug,
  usePlugWalletActor: useBITSBackendPlug,
} = createPlugWalletActorProvider(bitsIdlFactory, bitsCanisterId);

export const {
  PlugWalletActorProvider: AlpacaLBActorProviderPlug,
  usePlugWalletActor: useAlpacaLBBackendPlug,
} = createPlugWalletActorProvider(alpacalbIdlFactory, alpacalbCanisterId);

export const {
  PlugWalletActorProvider: PartyActorProviderPlug,
  usePlugWalletActor: usePartyBackendPlug,
} = createPlugWalletActorProvider(partyIdlFactory, partyCanisterId);

export const {
  PlugWalletActorProvider: SneedActorProviderPlug,
  usePlugWalletActor: useSneedBackendPlug,
} = createPlugWalletActorProvider(sneedIdlFactory, sneedCanisterId);

export const {
  PlugWalletActorProvider: ClownActorProviderPlug,
  usePlugWalletActor: useClownBackendPlug,
} = createPlugWalletActorProvider(clownIdlFactory, clownCanisterId);

export const {
  PlugWalletActorProvider: ExeActorProviderPlug,
  usePlugWalletActor: useExeBackendPlug,
} = createPlugWalletActorProvider(exeIdlFactory, exeCanisterId);

export const {
  PlugWalletActorProvider: WumboActorProviderPlug,
  usePlugWalletActor: useWumboBackendPlug,
} = createPlugWalletActorProvider(wumboIdlFactory, wumboCanisterId);

export const {
  PlugWalletActorProvider: McsActorProviderPlug,
  usePlugWalletActor: useMcsBackendPlug,
} = createPlugWalletActorProvider(mcsIdlFactory, mcsCanisterId);

export const {
  PlugWalletActorProvider: DamonicActorProviderPlug,
  usePlugWalletActor: useDamonicBackendPlug,
} = createPlugWalletActorProvider(damonicIdlFactory, damonicCanisterId);

export const {
  PlugWalletActorProvider: BobActorProviderPlug,
  usePlugWalletActor: useBobBackendPlug,
} = createPlugWalletActorProvider(bobIdlFactory, bobCanisterId);

export const {
  PlugWalletActorProvider: BurnActorProviderPlug,
  usePlugWalletActor: useBurnBackendPlug,
} = createPlugWalletActorProvider(burnIdlFactory, burnCanisterId);

export const {
  PlugWalletActorProvider: DCDActorProviderPlug,
  usePlugWalletActor: useDCDBackendPlug,
} = createPlugWalletActorProvider(dcdIdlFactory, dcdCanisterId);

export const {
  PlugWalletActorProvider: DITTOActorProviderPlug,
  usePlugWalletActor: useDITTOBackendPlug,
} = createPlugWalletActorProvider(dittoIdlFactory, dittoCanisterId);

export const {
  PlugWalletActorProvider: FPLActorProviderPlug,
  usePlugWalletActor: useFPLBackendPlug,
} = createPlugWalletActorProvider(fplIdlFactory, fplCanisterId);

export const {
  PlugWalletActorProvider: GLDGovActorProviderPlug,
  usePlugWalletActor: useGLDGovBackendPlug,
} = createPlugWalletActorProvider(gldgovIdlFactory, gldgovCanisterId);

export const {
  PlugWalletActorProvider: ICVCActorProviderPlug,
  usePlugWalletActor: useICVCBackendPlug,
} = createPlugWalletActorProvider(icvcIdlFactory, icvcCanisterId);

export const {
  PlugWalletActorProvider: NTNActorProviderPlug,
  usePlugWalletActor: useNTNBackendPlug,
} = createPlugWalletActorProvider(ntnIdlFactory, ntnCanisterId);

export const {
  PlugWalletActorProvider: OGYActorProviderPlug,
  usePlugWalletActor: useOGYBackendPlug,
} = createPlugWalletActorProvider(ogyIdlFactory, ogyCanisterId);

export const {
  PlugWalletActorProvider: OWLActorProviderPlug,
  usePlugWalletActor: useOWLBackendPlug,
} = createPlugWalletActorProvider(owlIdlFactory, owlCanisterId);

export const {
  PlugWalletActorProvider: GLDTActorProviderPlug,
  usePlugWalletActor: useGLDTBackendPlug,
} = createPlugWalletActorProvider(gldtIdlFactory, gldtCanisterId);

export const {
  PlugWalletActorProvider: GHOSTActorProviderPlug,
  usePlugWalletActor: useGHOSTBackendPlug,
} = createPlugWalletActorProvider(ghostIdlFactory, ghostCanisterId);

export const {
  PlugWalletActorProvider: CTZActorProviderPlug,
  usePlugWalletActor: useCTZBackendPlug,
} = createPlugWalletActorProvider(ctzIdlFactory, ctzCanisterId);

export const {
  PlugWalletActorProvider: ELNAActorProviderPlug,
  usePlugWalletActor: useELNABackendPlug,
} = createPlugWalletActorProvider(elnaIdlFactory, elnaCanisterId);

export const {
  PlugWalletActorProvider: DOGMIActorProviderPlug,
  usePlugWalletActor: useDOGMIBackendPlug,
} = createPlugWalletActorProvider(dogmiIdlFactory, dogmiCanisterId);

export const {
  PlugWalletActorProvider: ESTActorProviderPlug,
  usePlugWalletActor: useESTBackendPlug,
} = createPlugWalletActorProvider(estIdlFactory, estCanisterId);

export const {
  PlugWalletActorProvider: PANDAActorProviderPlug,
  usePlugWalletActor: usePANDABackendPlug,
} = createPlugWalletActorProvider(pandaIdlFactory, pandaCanisterId);

export const {
  PlugWalletActorProvider: KINICActorProviderPlug,
  usePlugWalletActor: useKINICBackendPlug,
} = createPlugWalletActorProvider(kinicIdlFactory, kinicCanisterId);

export const {
  PlugWalletActorProvider: DOLRActorProviderPlug,
  usePlugWalletActor: useDOLRBackendPlug,
} = createPlugWalletActorProvider(dolrIdlFactory, dolrCanisterId);

export const {
  PlugWalletActorProvider: TRAXActorProviderPlug,
  usePlugWalletActor: useTRAXBackendPlug,
} = createPlugWalletActorProvider(traxIdlFactory, traxCanisterId);

export const {
  PlugWalletActorProvider: MOTOKOActorProviderPlug,
  usePlugWalletActor: useMOTOKOBackendPlug,
} = createPlugWalletActorProvider(motokoIdlFactory, motokoCanisterId);

export const {
  PlugWalletActorProvider: CKPEPEActorProviderPlug,
  usePlugWalletActor: useCKPEPEBackendPlug,
} = createPlugWalletActorProvider(ckpepeIdlFactory, ckpepeCanisterId);

export const {
  PlugWalletActorProvider: CKSHIBActorProviderPlug,
  usePlugWalletActor: useCKSHIBBackendPlug,
} = createPlugWalletActorProvider(ckshibIdlFactory, ckshibCanisterId);

export const {
  PlugWalletActorProvider: DODActorProviderPlug,
  usePlugWalletActor: useDODBackendPlug,
} = createPlugWalletActorProvider(dodIdlFactory, dodCanisterId);

export const {
  PlugWalletActorProvider: KONGActorProviderPlug,
  usePlugWalletActor: useKONGBackendPlug,
} = createPlugWalletActorProvider(kongIdlFactory, kongCanisterId);

export const {
  PlugWalletActorProvider: KONG1ActorProviderPlug,
  usePlugWalletActor: useKONG1BackendPlug,
} = createPlugWalletActorProvider(kong1IdlFactory, kong1CanisterId);

export const {
  PlugWalletActorProvider: KONG2ActorProviderPlug,
  usePlugWalletActor: useKONG2BackendPlug,
} = createPlugWalletActorProvider(kong2IdlFactory, kong2CanisterId);