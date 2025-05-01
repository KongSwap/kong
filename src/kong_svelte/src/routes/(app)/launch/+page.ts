import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  // Redirect from /launch to /launch/explore
  throw redirect(307, '/launch/explore');
};
