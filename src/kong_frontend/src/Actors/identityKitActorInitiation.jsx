import { createActorProvider } from './identityKitActorProvider.jsx';
import { idlFactory as ckbtcIdlFactory, canisterId as ckbtcCanisterId } from '../../../declarations/ckbtc_ledger/index.js';
import { idlFactory as ckethIdlFactory, canisterId as ckethCanisterId } from '../../../declarations/cketh_ledger/index.js';
import { idlFactory as ckusdcIdlFactory, canisterId as ckusdcCanisterId } from '../../../declarations/ckusdc_ledger/index.js';
import { idlFactory as icpIdlFactory, canisterId as icpCanisterId } from '../../../declarations/icp_ledger/index.js';
import { idlFactory as kingKongIdlFactory, canisterId as kingKongCanisterId } from '../../../declarations/kong_backend/index.js';
import { idlFactory as kingKongFaucetIdlFactory, canisterId as kingKongFaucetCanisterId } from '../../../declarations/kong_faucet/index.js';
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
  ActorProvider: CkbtcActorProvider,
  useActors: useCkbtcActor
} = createActorProvider(ckbtcIdlFactory, ckbtcCanisterId);

export const {
  ActorProvider: CkethActorProvider,
  useActors: useCkethActor
} = createActorProvider(ckethIdlFactory, ckethCanisterId);

export const {
  ActorProvider: CkusdcActorProvider,
  useActors: useCkusdcActor
} = createActorProvider(ckusdcIdlFactory, ckusdcCanisterId);

export const {
  ActorProvider: IcpActorProvider,
  useActors: useIcpActor
} = createActorProvider(icpIdlFactory, icpCanisterId);

export const {
  ActorProvider: KingKongActorProvider,
  useActors: useKingKongActor
} = createActorProvider(kingKongIdlFactory, kingKongCanisterId);

export const {
  ActorProvider: KingKongFaucetActorProvider,
  useActors: useKingKongFaucetActor
} = createActorProvider(kingKongFaucetIdlFactory, kingKongFaucetCanisterId);

export const {
  ActorProvider: CkusdtActorProvider,
  useActors: useCkusdtActor
} = createActorProvider(ckusdtIdlFactory, ckusdtCanisterId);

export const {
  ActorProvider: NICPActorProvider,
  useActors: useNICPActor
} = createActorProvider(NICPIdlFactory, NICPCanisterId);

export const {
  ActorProvider: WtnActorProvider,
  useActors: useWtnActor
} = createActorProvider(wtnIdlFactory, wtnCanisterId);

export const {
  ActorProvider: YugeActorProvider,
  useActors: useYugeActor
} = createActorProvider(yugeIdlFactory, yugeCanisterId);

export const {
  ActorProvider: ChatActorProvider,
  useActors: useChatActor
} = createActorProvider(chatIdlFactory, chatCanisterId);

export const {
  ActorProvider: DkpActorProvider,
  useActors: useDkpActor
} = createActorProvider(dkpIdlFactory, dkpCanisterId);

export const {
  ActorProvider: NanasActorProvider,
  useActors: useNanasActor
} = createActorProvider(nanasIdlFactory, nanasCanisterId);

export const {
  ActorProvider: Nd64ActorProvider,
  useActors: useNd64Actor
} = createActorProvider(nd64IdlFactory, nd64CanisterId);

export const {
  ActorProvider: BitsActorProvider,
  useActors: useBitsActor
} = createActorProvider(bitsIdlFactory, bitsCanisterId);

export const {
  ActorProvider: AlpacalbActorProvider,
  useActors: useAlpacalbActor
} = createActorProvider(alpacalbIdlFactory, alpacalbCanisterId);

export const {
  ActorProvider: PartyActorProvider,
  useActors: usePartyActor
} = createActorProvider(partyIdlFactory, partyCanisterId);

export const {
  ActorProvider: SneedActorProvider,
  useActors: useSneedActor
} = createActorProvider(sneedIdlFactory, sneedCanisterId);

export const {
  ActorProvider: ClownActorProvider,
  useActors: useClownActor
} = createActorProvider(clownIdlFactory, clownCanisterId);

export const {
  ActorProvider: ExeActorProvider,
  useActors: useExeActor
} = createActorProvider(exeIdlFactory, exeCanisterId);

export const {
  ActorProvider: WumboActorProvider,
  useActors: useWumboActor
} = createActorProvider(wumboIdlFactory, wumboCanisterId);

export const {
  ActorProvider: McsActorProvider,
  useActors: useMcsActor
} = createActorProvider(mcsIdlFactory, mcsCanisterId);

export const {
  ActorProvider: DamonicActorProvider,
  useActors: useDamonicActor,
} = createActorProvider(damonicIdlFactory, damonicCanisterId);

export const {
  ActorProvider: BobActorProvider,
  useActors: useBobActor,
} = createActorProvider(bobIdlFactory, bobCanisterId);

export const {
  ActorProvider: BurnActorProvider,
  useActors: useBurnActor,
} = createActorProvider(burnIdlFactory, burnCanisterId);

export const {
  ActorProvider: DcdActorProvider,
  useActors: useDcdActor,
} = createActorProvider(dcdIdlFactory, dcdCanisterId);

export const {
  ActorProvider: DittoActorProvider,
  useActors: useDittoActor,
} = createActorProvider(dittoIdlFactory, dittoCanisterId);

export const {
  ActorProvider: FplActorProvider,
  useActors: useFplActor,
} = createActorProvider(fplIdlFactory, fplCanisterId);

export const {
  ActorProvider: GldgovActorProvider,
  useActors: useGldgovActor,
} = createActorProvider(gldgovIdlFactory, gldgovCanisterId);

export const {
  ActorProvider: IcvcActorProvider,
  useActors: useIcvcActor,
} = createActorProvider(icvcIdlFactory, icvcCanisterId);

export const {
  ActorProvider: NtnActorProvider,
  useActors: useNtnActor,
} = createActorProvider(ntnIdlFactory, ntnCanisterId);

export const {
  ActorProvider: OgyActorProvider,
  useActors: useOgyActor,
} = createActorProvider(ogyIdlFactory, ogyCanisterId);

export const {
  ActorProvider: OwlActorProvider,
  useActors: useOwlActor,
} = createActorProvider(owlIdlFactory, owlCanisterId);