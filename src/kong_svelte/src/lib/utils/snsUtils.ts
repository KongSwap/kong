import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as snsIdlFactory } from '$lib/idls/snsGovernance.idl.js';
import { idlFactory as icpIdlFactory } from '$lib/idls/icpGovernance.idl.js';
import { createAnonymousActorHelper } from '$lib/utils/actorUtils';

export interface GovernanceProposal {
  id: bigint;
  title: string;
  summary: string;
  url: string;
  status: 'open' | 'accepted' | 'rejected' | 'executing' | 'executed' | 'failed';
  proposer?: string;
  created: bigint;
  deadline: bigint;
  reward_event_round: bigint;
  tally: {
    yes: bigint | undefined;
    no: bigint | undefined;
    total: bigint | undefined;
    timestamp_seconds: bigint | undefined;
  };
  decided_timestamp_seconds: bigint;
  executed_timestamp_seconds: bigint;
  failed_timestamp_seconds: bigint;
  is_eligible_for_rewards: boolean;
}

export interface ProposalResponse {
  proposals: GovernanceProposal[];
  hasMore: boolean;
}

// move to api at some point
export const GOVERNANCE_CANISTER_IDS: { [key: string]: string } = {
  "ryjl3-tyaaa-aaaaa-aaaba-cai": "rrkah-fqaaa-aaaaa-aaaaq-cai",
  "o7oak-iyaaa-aaaaq-aadzq-cai": "oypg6-faaaa-aaaaq-aadza-cai",
  "vtrom-gqaaa-aaaaq-aabia-cai": "xomae-vyaaa-aaaaq-aabhq-cai",
  "2ouva-viaaa-aaaaq-aaamq-cai": "2jvtu-yqaaa-aaaaq-aaama-cai",
  "zfcdd-tqaaa-aaaaq-aaaga-cai": "zqfso-syaaa-aaaaq-aaafq-cai",
  "tyyy3-4aaaa-aaaaq-aab7a-cai": "tr3th-kiaaa-aaaaq-aab6q-cai",
  "oj6if-riaaa-aaaaq-aaeha-cai": "oa5dz-haaaa-aaaaq-aaegq-cai",
  "f54if-eqaaa-aaaaq-aacea-cai": "eqsml-lyaaa-aaaaq-aacdq-cai",
  "druyg-tyaaa-aaaaq-aactq-cai": "dwv6s-6aaaa-aaaaq-aacta-cai",
  "ddsp7-7iaaa-aaaaq-aacqq-cai": "detjl-sqaaa-aaaaq-aacqa-cai",
  "o4zzi-qaaaa-aaaaq-aaeeq-cai": "o3y74-5yaaa-aaaaq-aaeea-cai",
  "lkwrt-vyaaa-aaaaq-aadhq-cai": "lnxxh-yaaaa-aaaaq-aadha-cai",
  "jcmow-hyaaa-aaaaq-aadlq-cai": "jfnic-kaaaa-aaaaq-aadla-cai",
  "6rdgd-kyaaa-aaaaq-aaavq-cai": "6wcax-haaaa-aaaaq-aaava-cai",
  "lrtnw-paaaa-aaaaq-aadfa-cai": "lyqgk-ziaaa-aaaaq-aadeq-cai",
  "emww2-4yaaa-aaaaq-aacbq-cai": "elxqo-raaaa-aaaaq-aacba-cai",
  "hvgxa-wqaaa-aaaaq-aacia-cai": "fi3zi-fyaaa-aaaaq-aachq-cai",
  "mih44-vaaaa-aaaaq-aaekq-cai": "mpg2i-yyaaa-aaaaq-aaeka-cai",
  "k45jy-aiaaa-aaaaq-aadcq-cai": "k34pm-nqaaa-aaaaq-aadca-cai",
  "uf2wh-taaaa-aaaaq-aabna-cai": "umz53-fiaaa-aaaaq-aabmq-cai"
}

export class SNSService {
  private agent: HttpAgent;

  constructor() {
    this.agent = new HttpAgent();
  }

  async getProposals(
    governanceCanisterId: string, 
    limit: number = 10,
    beforeProposal?: bigint
  ): Promise<ProposalResponse> {
    try {
      console.log('Fetching SNS proposals for canister:', governanceCanisterId);
      const governanceActor = createAnonymousActorHelper(governanceCanisterId, snsIdlFactory);

      const result = await governanceActor.list_proposals({
        limit: BigInt(limit),
        before_proposal: beforeProposal ? [{ id: beforeProposal }] : [],
        exclude_type: [],
        include_reward_status: [] as number[],
        include_status: [] as number[]
      });

      console.log('Raw SNS proposals response:', result);

      function determineStatus(proposal: any): GovernanceProposal['status'] {
        if (proposal.failed_timestamp_seconds > 0n) return 'failed';
        if (proposal.executed_timestamp_seconds > 0n) return 'executed';
        if (proposal.decided_timestamp_seconds > 0n) return 'accepted';
        return 'open';
      }

      const mappedProposals = result.proposals.map(proposal => ({
        id: proposal.id[0]?.id || BigInt(0),
        title: proposal.proposal[0]?.title || "",
        summary: proposal.proposal[0]?.summary || "",
        url: proposal.proposal[0]?.url || "",
        status: determineStatus(proposal),
        proposer: proposal.proposer[0]?.id.toString(),
        created: proposal.proposal_creation_timestamp_seconds,
        deadline: proposal.wait_for_quiet_deadline_increase_seconds,
        reward_event_round: proposal.reward_event_round,
        tally: {
          yes: proposal.latest_tally[0]?.yes,
          no: proposal.latest_tally[0]?.no,
          total: proposal.latest_tally[0]?.total,
          timestamp_seconds: proposal.latest_tally[0]?.timestamp_seconds
        },
        decided_timestamp_seconds: proposal.decided_timestamp_seconds,
        executed_timestamp_seconds: proposal.executed_timestamp_seconds,
        failed_timestamp_seconds: proposal.failed_timestamp_seconds,
        is_eligible_for_rewards: proposal.is_eligible_for_rewards
      }));

      console.log('Mapped SNS proposals:', mappedProposals);

      return {
        proposals: mappedProposals,
        hasMore: result.proposals.length >= limit
      };
    } catch (error) {
      console.error('Error fetching SNS proposals:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      return { proposals: [], hasMore: false };
    }
  }
}

export class ICPGovernanceService {
  private agent: HttpAgent;

  constructor() {
    this.agent = new HttpAgent();
  }

  async getProposals(
    governanceCanisterId: string, 
    limit: number = 10,
    beforeProposal?: bigint
  ): Promise<ProposalResponse> {
    try {
      console.log('Fetching ICP proposals for canister:', governanceCanisterId);
      const governanceActor = createAnonymousActorHelper(governanceCanisterId, icpIdlFactory);
      console.log('ICP governance actor methods:', Object.keys(governanceActor));
      
      const requestParams = {
        limit: BigInt(limit),
        before_proposal: beforeProposal ? [{ id: beforeProposal }] : [],
        exclude_topic: [] as number[],
        include_reward_status: [] as number[],
        include_status: [] as number[],
        include_all_manage_neuron_proposals: [],
        omit_large_fields: []
      };
      
      console.log('ICP API request params:', requestParams);
      
      const result = await governanceActor.list_proposals(requestParams);

      console.log('Raw ICP proposals response:', result);
      console.log('ICP proposals count:', result.proposal_info?.length || 0);

      // ICP status mapping - these are the integer values from the IDL
      function determineStatus(statusInt: number): GovernanceProposal['status'] {
        switch (statusInt) {
          case 1: return 'open';
          case 2: return 'rejected';
          case 3: return 'accepted';
          case 4: return 'executed';
          case 5: return 'failed';
          default: return 'open';
        }
      }

      // Access the correct field name: proposal_info instead of proposals
      const mappedProposals = result.proposal_info.map(proposal => ({
        id: proposal.id[0]?.id || BigInt(0),
        title: proposal.proposal[0]?.title || proposal.proposal[0]?.action?.Motion?.motion_text || "Untitled Proposal",
        summary: proposal.proposal[0]?.summary || "",
        url: proposal.proposal[0]?.url || "",
        status: determineStatus(proposal.status),
        proposer: proposal.proposer[0]?.id.toString(),
        created: proposal.proposal_timestamp_seconds,
        deadline: proposal.deadline_timestamp_seconds || BigInt(0),
        reward_event_round: proposal.reward_event_round,
        tally: {
          yes: proposal.latest_tally[0]?.yes,
          no: proposal.latest_tally[0]?.no,
          total: proposal.latest_tally[0]?.total,
          timestamp_seconds: proposal.latest_tally[0]?.timestamp_seconds
        },
        decided_timestamp_seconds: proposal.decided_timestamp_seconds,
        executed_timestamp_seconds: proposal.executed_timestamp_seconds,
        failed_timestamp_seconds: proposal.failed_timestamp_seconds,
        is_eligible_for_rewards: proposal.reward_status === 1 // 1 means eligible for rewards
      }));

      console.log('Mapped ICP proposals:', mappedProposals);

      return {
        proposals: mappedProposals,
        hasMore: result.proposal_info.length >= limit
      };
    } catch (error) {
      console.error('Error fetching ICP proposals:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      return { proposals: [], hasMore: false };
    }
  }
}

export const snsService = new SNSService();
export const icpGovernanceService = new ICPGovernanceService(); 