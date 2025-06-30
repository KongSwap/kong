export const prerender = false;

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  return {
    principalId: params.principalId,
  };
};
