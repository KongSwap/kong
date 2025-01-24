import { handleErrorWithSentry, replayIntegration } from "@sentry/sveltekit";
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  environment: process.env.DOPPLER_CONFIG,
  dsn: 'https://3c7847a3aac687407c5de18746ccc457@o4508554870325248.ingest.us.sentry.io/4508554872029184',
  release: process.env.VITE_RELEASE || 'development',

  tracesSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // If you don't want to use Session Replay, just remove the line below:
  integrations: [replayIntegration()],
});

// Combine both error handlers into one
export const handleError = handleErrorWithSentry(async (error) => {
	const errorId = crypto.randomUUID();
	console.error(error);
	return {
		message: 'An unexpected error occurred.',
		errorId
	};
});
