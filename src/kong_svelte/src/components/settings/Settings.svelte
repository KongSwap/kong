const claimTokens = async () => {
    try {
        if (!$auth.isConnected) {
            toastStore.error('Please connect your wallet first');
            return;
        }

        toastStore.info('Claiming test tokens...');
        const result = await tokenStore.claimFaucetTokens();
        
        // Check if result is successful
        if (result?.Ok) {
            // Refresh balances
            await tokenStore.loadBalances($auth.account?.owner);
            toastStore.success('Test tokens claimed successfully');
        } else if (result?.Err) {
            toastStore.error(`Failed to claim tokens: ${result.Err}`);
        } else {
            throw new Error('Unknown response from faucet');
        }
    } catch (error) {
        console.error('Error claiming tokens:', error);
        toastStore.error(error instanceof Error ? error.message : 'Failed to claim test tokens');
    }
}; 
