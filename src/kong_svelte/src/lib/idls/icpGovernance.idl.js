export const idlFactory = ({ IDL }) => {
  const ProposalId = IDL.Record({ 'id': IDL.Nat64 });
  const NeuronId = IDL.Record({ 'id': IDL.Nat64 });
  const Proposal = IDL.Record({
    'title': IDL.Text,
    'summary': IDL.Text,
    'url': IDL.Text,
  });
  const Tally = IDL.Record({
    'no': IDL.Nat64,
    'yes': IDL.Nat64,
    'total': IDL.Nat64,
    'timestamp_seconds': IDL.Nat64,
  });
  const ProposalInfo = IDL.Record({
    'id': ProposalId,
    'status': IDL.Int32,
    'topic': IDL.Int32,
    'proposer': IDL.Opt(NeuronId),
    'proposal': IDL.Opt(Proposal),
    'proposal_timestamp_seconds': IDL.Nat64,
    'deadline_timestamp_seconds': IDL.Opt(IDL.Nat64),
    'latest_tally': IDL.Opt(Tally),
    'reward_event_round': IDL.Nat64,
    'decided_timestamp_seconds': IDL.Nat64,
    'executed_timestamp_seconds': IDL.Nat64,
    'failed_timestamp_seconds': IDL.Nat64,
  });
  const ListProposalInfo = IDL.Record({
    'include_reward_status': IDL.Vec(IDL.Int32),
    'before_proposal': IDL.Opt(ProposalId),
    'limit': IDL.Nat32,
    'exclude_topic': IDL.Vec(IDL.Int32),
    'include_status': IDL.Vec(IDL.Int32),
  });
  const ListProposalInfoResponse = IDL.Record({
    'proposal_info': IDL.Vec(ProposalInfo),
  });

  return IDL.Service({
    'list_proposals': IDL.Func(
      [ListProposalInfo],
      [ListProposalInfoResponse],
      ['query']
    ),
  });
}; 