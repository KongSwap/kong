// Basic error handling for now
export const handleError = async ({ error }: { error: Error }) => {
	const errorId = crypto.randomUUID();
	console.error('Client error:', error);
	return {
		message: 'An unexpected error occurred.',
		errorId
	};
}; 
