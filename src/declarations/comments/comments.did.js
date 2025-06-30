export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const CreateCommentRequest = IDL.Record({
    'context_id' : IDL.Text,
    'content' : IDL.Text,
    'parent_id' : IDL.Opt(IDL.Nat64),
  });
  const CommentResponse = IDL.Record({
    'id' : IDL.Nat64,
    'context_id' : IDL.Text,
    'content' : IDL.Text,
    'created_at' : IDL.Nat64,
    'edited_at' : IDL.Opt(IDL.Nat64),
    'author' : IDL.Principal,
    'likes' : IDL.Nat32,
    'has_liked' : IDL.Bool,
    'parent_id' : IDL.Opt(IDL.Nat64),
    'is_edited' : IDL.Bool,
  });
  const Result_1 = IDL.Variant({ 'Ok' : CommentResponse, 'Err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Nat32, 'Err' : IDL.Text });
  const EditCommentRequest = IDL.Record({
    'content' : IDL.Text,
    'comment_id' : IDL.Nat64,
  });
  const BatchCommentCountRequest = IDL.Record({
    'context_ids' : IDL.Vec(IDL.Text),
  });
  const ContextCommentCount = IDL.Record({
    'context_id' : IDL.Text,
    'count' : IDL.Nat32,
  });
  const Comment = IDL.Record({
    'id' : IDL.Nat64,
    'context_id' : IDL.Text,
    'content' : IDL.Text,
    'created_at' : IDL.Nat64,
    'edited_at' : IDL.Opt(IDL.Nat64),
    'author' : IDL.Principal,
    'likes' : IDL.Nat32,
    'parent_id' : IDL.Opt(IDL.Nat64),
    'is_edited' : IDL.Bool,
  });
  const PaginationParams = IDL.Record({
    'cursor' : IDL.Opt(IDL.Nat64),
    'limit' : IDL.Opt(IDL.Nat64),
  });
  const GetCommentsRequest = IDL.Record({
    'context_id' : IDL.Text,
    'pagination' : IDL.Opt(PaginationParams),
    'check_likes_for' : IDL.Opt(IDL.Principal),
  });
  const CommentsPage = IDL.Record({
    'next_cursor' : IDL.Opt(IDL.Nat64),
    'comments' : IDL.Vec(CommentResponse),
  });
  const ConsentMessageMetadata = IDL.Record({
    'utc_offset_minutes' : IDL.Opt(IDL.Int16),
    'language' : IDL.Text,
  });
  const DisplayMessageType = IDL.Variant({
    'GenericDisplay' : IDL.Null,
    'LineDisplay' : IDL.Record({
      'characters_per_line' : IDL.Nat16,
      'lines_per_page' : IDL.Nat16,
    }),
  });
  const ConsentMessageSpec = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'device_spec' : IDL.Opt(DisplayMessageType),
  });
  const ConsentMessageRequest = IDL.Record({
    'arg' : IDL.Vec(IDL.Nat8),
    'method' : IDL.Text,
    'user_preferences' : ConsentMessageSpec,
  });
  const LineDisplayPage = IDL.Record({ 'lines' : IDL.Vec(IDL.Text) });
  const ConsentMessage = IDL.Variant({
    'LineDisplayMessage' : IDL.Record({ 'pages' : IDL.Vec(LineDisplayPage) }),
    'GenericDisplayMessage' : IDL.Text,
  });
  const ConsentInfo = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'consent_message' : ConsentMessage,
  });
  const ErrorInfo = IDL.Record({ 'description' : IDL.Text });
  const Result_3 = IDL.Variant({ 'Ok' : ConsentInfo, 'Err' : ErrorInfo });
  const Icrc28TrustedOriginsResponse = IDL.Record({
    'trusted_origins' : IDL.Vec(IDL.Text),
  });
  const DelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
    'expiration' : IDL.Opt(IDL.Nat64),
  });
  const Delegation = IDL.Record({
    'created' : IDL.Nat64,
    'targets_list_hash' : IDL.Vec(IDL.Nat8),
    'target' : IDL.Principal,
    'expiration' : IDL.Opt(IDL.Nat64),
  });
  const DelegationResponse = IDL.Record({
    'delegations' : IDL.Vec(Delegation),
  });
  const DelegationError = IDL.Variant({
    'NotFound' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'InvalidRequest' : IDL.Text,
    'StorageError' : IDL.Text,
    'Expired' : IDL.Null,
  });
  const Result_4 = IDL.Variant({
    'Ok' : DelegationResponse,
    'Err' : DelegationError,
  });
  const RevokeDelegationRequest = IDL.Record({
    'targets' : IDL.Vec(IDL.Principal),
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : DelegationError });
  return IDL.Service({
    'add_admin' : IDL.Func([IDL.Text], [Result], []),
    'ban_user' : IDL.Func([IDL.Principal, IDL.Nat64], [Result], []),
    'check_ban_status' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(IDL.Nat64)],
        ['query'],
      ),
    'create_comment' : IDL.Func([CreateCommentRequest], [Result_1], []),
    'delete_comment' : IDL.Func([IDL.Nat64], [Result], []),
    'delete_context_comments' : IDL.Func([IDL.Text], [Result_2], []),
    'edit_comment' : IDL.Func([EditCommentRequest], [Result_1], []),
    'get_batch_context_comment_counts' : IDL.Func(
        [BatchCommentCountRequest],
        [IDL.Vec(ContextCommentCount)],
        ['query'],
      ),
    'get_comment' : IDL.Func([IDL.Nat64], [IDL.Opt(Comment)], ['query']),
    'get_comments_by_context' : IDL.Func(
        [GetCommentsRequest],
        [CommentsPage],
        ['query'],
      ),
    'get_context_comment_count' : IDL.Func([IDL.Text], [IDL.Nat32], ['query']),
    'get_user_comments' : IDL.Func(
        [IDL.Principal, IDL.Opt(IDL.Nat32)],
        [IDL.Vec(Comment)],
        ['query'],
      ),
    'get_user_liked_comments' : IDL.Func([], [IDL.Vec(IDL.Nat64)], ['query']),
    'icrc21_canister_call_consent_message' : IDL.Func(
        [ConsentMessageRequest],
        [Result_3],
        ['query'],
      ),
    'icrc28_trusted_origins' : IDL.Func(
        [],
        [Icrc28TrustedOriginsResponse],
        ['query'],
      ),
    'icrc_34_delegate' : IDL.Func([DelegationRequest], [Result_4], []),
    'icrc_34_get_delegation' : IDL.Func(
        [DelegationRequest],
        [Result_4],
        ['query'],
      ),
    'icrc_34_revoke_delegation' : IDL.Func(
        [RevokeDelegationRequest],
        [Result_5],
        [],
      ),
    'is_admin' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'like_comment' : IDL.Func([IDL.Nat64], [Result_2], []),
    'unban_user' : IDL.Func([IDL.Principal], [Result], []),
    'unlike_comment' : IDL.Func([IDL.Nat64], [Result_2], []),
  });
};
export const init = ({ IDL }) => { return []; };
