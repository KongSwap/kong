export const idlFactory = ({ IDL }) => {
  const ClaimResult = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  return IDL.Service({ 'claim' : IDL.Func([], [ClaimResult], []) });
};
export const init = ({ IDL }) => { return []; };
