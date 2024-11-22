import { CanisterService } from './services/canisterService';

const CANISTER_ID = '2ipq2-uqaaa-aaaar-qailq-cai';

async function testCanister() {
  const service = new CanisterService();

  try {
    console.log('Testing token fetch...');
    await service.fetchAndStoreTokens();
    console.log('Tokens fetched and stored successfully');

    console.log('\nTesting pools fetch...');
    await service.fetchAndStorePools();
    console.log('Pools fetched and stored successfully');

    console.log('\nTesting transactions fetch...');
    await service.fetchAndStoreTransactions();
    console.log('Transactions fetched and stored successfully');

  } catch (error) {
    console.error('Error during testing:', error);
  }
}

testCanister().catch(console.error);
