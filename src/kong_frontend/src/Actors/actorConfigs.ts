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



export const actorConfigs = {
  ckBtcActor: { canisterId: ckbtcCanisterId, idlFactory: ckbtcIdlFactory },
  ckEthActor: { canisterId: ckethCanisterId, idlFactory: ckethIdlFactory },
  icpActor: { canisterId: icpCanisterId, idlFactory: icpIdlFactory },
  kingKongActor: { canisterId: kingKongCanisterId, idlFactory: kingKongIdlFactory },
  kingKongFaucetActor: { canisterId: kingKongFaucetCanisterId, idlFactory: kingKongFaucetIdlFactory },
  ckUsdcActor: { canisterId: ckusdcCanisterId, idlFactory: ckusdcIdlFactory },
  ckUsdtActor: { canisterId: ckusdtCanisterId, idlFactory: ckusdtIdlFactory },
  nicpActor: { canisterId: NICPCanisterId, idlFactory: NICPIdlFactory },
  wtnActor: { canisterId: wtnCanisterId, idlFactory: wtnIdlFactory },
  yugeActor: { canisterId: yugeCanisterId, idlFactory: yugeIdlFactory },
  chatActor: { canisterId: chatCanisterId, idlFactory: chatIdlFactory },
  dkpActor: { canisterId: dkpCanisterId, idlFactory: dkpIdlFactory },
  nanasActor: { canisterId: nanasCanisterId, idlFactory: nanasIdlFactory },
  nd64Actor: { canisterId: nd64CanisterId, idlFactory: nd64IdlFactory },
  bitsActor: { canisterId: bitsCanisterId, idlFactory: bitsIdlFactory },
  alpacalbActor: { canisterId: alpacalbCanisterId, idlFactory: alpacalbIdlFactory },
  partyActor: { canisterId: partyCanisterId, idlFactory: partyIdlFactory },
  sneedActor: { canisterId: sneedCanisterId, idlFactory: sneedIdlFactory },
  clownActor: { canisterId: clownCanisterId, idlFactory: clownIdlFactory },
  exeActor: { canisterId: exeCanisterId, idlFactory: exeIdlFactory },
  wumboActor: { canisterId: wumboCanisterId, idlFactory: wumboIdlFactory },
  mcsActor: { canisterId: mcsCanisterId, idlFactory: mcsIdlFactory },
  damonicActor: { canisterId: damonicCanisterId, idlFactory: damonicIdlFactory },
  bobActor: { canisterId: bobCanisterId, idlFactory: bobIdlFactory },
  burnActor: { canisterId: burnCanisterId, idlFactory: burnIdlFactory },
  dcdActor: { canisterId: dcdCanisterId, idlFactory: dcdIdlFactory },
  dittoActor: { canisterId: dittoCanisterId, idlFactory: dittoIdlFactory },
  fplActor: { canisterId: fplCanisterId, idlFactory: fplIdlFactory },
  gldgovActor: { canisterId: gldgovCanisterId, idlFactory: gldgovIdlFactory },
  icvcActor: { canisterId: icvcCanisterId, idlFactory: icvcIdlFactory },
  ntnActor: { canisterId: ntnCanisterId, idlFactory: ntnIdlFactory },
  ogyActor: { canisterId: ogyCanisterId, idlFactory: ogyIdlFactory },
  owlActor: { canisterId: owlCanisterId, idlFactory: owlIdlFactory },
};
