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