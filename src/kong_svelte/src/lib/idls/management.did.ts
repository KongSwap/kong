import { IDL } from '@dfinity/candid';

// Management Canister IDL for the Internet Computer
export const managementCanisterIdl = ({ IDL }) => {
  const canister_id = IDL.Principal;
  const wasm_module = IDL.Vec(IDL.Nat8);
  
  const canister_settings = IDL.Record({
    controllers: IDL.Opt(IDL.Vec(IDL.Principal)),
    compute_allocation: IDL.Opt(IDL.Nat),
    memory_allocation: IDL.Opt(IDL.Nat),
    freezing_threshold: IDL.Opt(IDL.Nat)
  });
  
  const definite_canister_settings = IDL.Record({
    controllers: IDL.Vec(IDL.Principal),
    compute_allocation: IDL.Nat,
    memory_allocation: IDL.Nat,
    freezing_threshold: IDL.Nat
  });

  // Define install_code method
  return IDL.Service({
    'create_canister': IDL.Func(
      [IDL.Record({ 
        settings: IDL.Opt(canister_settings),
        subnet_selection: IDL.Opt(IDL.Any)
      })],
      [IDL.Record({ canister_id: canister_id })],
      [],
    ),
    'install_code': IDL.Func(
      [IDL.Record({
        mode: IDL.Variant({
          'install': IDL.Null,
          'reinstall': IDL.Null,
          'upgrade': IDL.Null
        }),
        canister_id: canister_id,
        wasm_module: wasm_module,
        arg: IDL.Vec(IDL.Nat8)
      })],
      [],
      [],
    ),
    'update_settings': IDL.Func(
      [IDL.Record({
        canister_id: IDL.Principal,
        settings: canister_settings
      })],
      [],
      [],
    ),
    'deposit_cycles': IDL.Func(
      [IDL.Record({ canister_id: canister_id })],
      [],
      [],
    ),
    'canister_status': IDL.Func(
      [IDL.Record({ canister_id: canister_id })],
      [
        IDL.Record({
          status: IDL.Variant({
            'running': IDL.Null,
            'stopping': IDL.Null,
            'stopped': IDL.Null
          }),
          settings: definite_canister_settings,
          module_hash: IDL.Opt(IDL.Vec(IDL.Nat8)),
          memory_size: IDL.Nat,
          cycles: IDL.Nat,
          idle_cycles_burned_per_day: IDL.Nat
        })
      ],
      [],
    ),
    'start_canister': IDL.Func(
      [IDL.Record({ canister_id: canister_id })],
      [],
      [],
    ),
    'stop_canister': IDL.Func(
      [IDL.Record({ canister_id: canister_id })],
      [],
      [],
    ),
    'delete_canister': IDL.Func(
      [IDL.Record({ canister_id: canister_id })],
      [],
      [],
    ),
    'raw_rand': IDL.Func(
      [],
      [IDL.Vec(IDL.Nat8)],
      [],
    ),
    'provisional_create_canister_with_cycles': IDL.Func(
      [
        IDL.Record({
          settings: IDL.Opt(canister_settings),
          amount: IDL.Opt(IDL.Nat),
          specified_id: IDL.Opt(canister_id),
          sender_canister_version: IDL.Opt(IDL.Nat64),
        }),
      ],
      [IDL.Record({ canister_id: canister_id })],
      [],
    ),
    'provisional_top_up_canister': IDL.Func(
      [IDL.Record({
        canister_id: canister_id,
        amount: IDL.Nat
      })],
      [],
      [],
    ),
    'ecdsa_public_key': IDL.Func(
      [
        IDL.Record({
          canister_id: IDL.Opt(canister_id),
          derivation_path: IDL.Vec(IDL.Vec(IDL.Nat8)),
          key_id: IDL.Record({
            curve: IDL.Variant({ 'secp256k1': IDL.Null }),
            name: IDL.Text,
          }),
        }),
      ],
      [
        IDL.Record({
          public_key: IDL.Vec(IDL.Nat8),
          chain_code: IDL.Vec(IDL.Nat8),
        }),
      ],
      [],
    ),
    'http_request': IDL.Func(
      [
        IDL.Record({
          url: IDL.Text,
          method: IDL.Variant({
            'get': IDL.Null,
            'head': IDL.Null,
            'post': IDL.Null,
          }),
          headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
          body: IDL.Opt(IDL.Vec(IDL.Nat8)),
          transform: IDL.Opt(
            IDL.Variant({
              'function': IDL.Func(
                [
                  IDL.Record({
                    response: IDL.Record({
                      status: IDL.Nat,
                      headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
                      body: IDL.Vec(IDL.Nat8),
                    }),
                  }),
                ],
                [
                  IDL.Record({
                    status: IDL.Nat,
                    headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
                    body: IDL.Vec(IDL.Nat8),
                  }),
                ],
                ['query'],
              ),
            })
          ),
        }),
      ],
      [
        IDL.Record({
          status: IDL.Nat,
          headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
          body: IDL.Vec(IDL.Nat8),
        }),
      ],
      [],
    ),
  });
}; 
