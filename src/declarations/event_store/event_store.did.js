export const idlFactory = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'push_events_whitelist' : IDL.Vec(IDL.Principal),
    'read_events_whitelist' : IDL.Vec(IDL.Principal),
    'time_granularity' : IDL.Opt(IDL.Nat64),
  });
  const EventsArgs = IDL.Record({ 'start' : IDL.Nat64, 'length' : IDL.Nat64 });
  const IndexedEvent = IDL.Record({
    'source' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'user' : IDL.Opt(IDL.Text),
    'timestamp' : IDL.Nat64,
    'index' : IDL.Nat64,
    'payload' : IDL.Vec(IDL.Nat8),
  });
  const EventsResponse = IDL.Record({
    'events' : IDL.Vec(IndexedEvent),
    'latest_event_index' : IDL.Opt(IDL.Nat64),
  });
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'upgrade' : IDL.Opt(IDL.Bool),
    'status_code' : IDL.Nat16,
  });
  const Anonymizable = IDL.Variant({
    'Anonymize' : IDL.Text,
    'Public' : IDL.Text,
  });
  const IdempotentEvent = IDL.Record({
    'source' : IDL.Opt(Anonymizable),
    'name' : IDL.Text,
    'user' : IDL.Opt(Anonymizable),
    'timestamp' : IDL.Nat64,
    'payload' : IDL.Vec(IDL.Nat8),
    'idempotency_key' : IDL.Nat,
  });
  const PushEventsArgs = IDL.Record({ 'events' : IDL.Vec(IdempotentEvent) });
  const WhitelistedPrincipals = IDL.Record({
    'push' : IDL.Vec(IDL.Principal),
    'read' : IDL.Vec(IDL.Principal),
  });
  return IDL.Service({
    'events' : IDL.Func([EventsArgs], [EventsResponse], ['query']),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'push_events' : IDL.Func([PushEventsArgs], [], []),
    'whitelisted_principals' : IDL.Func([], [WhitelistedPrincipals], ['query']),
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'push_events_whitelist' : IDL.Vec(IDL.Principal),
    'read_events_whitelist' : IDL.Vec(IDL.Principal),
    'time_granularity' : IDL.Opt(IDL.Nat64),
  });
  return [InitArgs];
};
