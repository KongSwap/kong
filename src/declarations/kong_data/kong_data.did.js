export const idlFactory = ({ IDL }) => {
  return IDL.Service({ 'icrc1_name' : IDL.Func([], [IDL.Text], ['query']) });
};
export const init = ({ IDL }) => { return []; };
