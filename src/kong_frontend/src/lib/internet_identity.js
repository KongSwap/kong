import { HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { createActor, canisterId } from 'declarations/internet_identity';

const LOCAL_IDENTITY_URL = 'http://' + process.env.CANISTER_ID_INTERNET_IDENTITY + '.localhost:4943';
const MAINNET_INDENTITY_URL = 'https://identity.ic0.app';
const MAX_TTL = 7 * 24 * 60 * 60 * 1000 * 1000 * 1000;
//const MAX_TTL = 30 * 1000 * 1000 * 1000;	// 30 seconds

export async function getAuthClient() {
	return await AuthClient.create();
}

export async function getPrincipal() {
	const authClient = await getAuthClient();
	return authClient.getIdentity()?.getPrincipal();
}

export async function getPrincipalText() {
	return (await getPrincipal()).toText();
}

export async function isAuthenticated() {
	try {
		const authClient = await getAuthClient();
		return await authClient.isAuthenticated();
	} catch (err) {
		logout();
	}
}

export async function login(onSuccess) {
	const authClient = await getAuthClient();
	const isAuthenticated = await authClient.isAuthenticated();
	if (!isAuthenticated) {
		console.log("id url=" + getIdentityUrl());
		await authClient?.login({
			identityProvider: getIdentityUrl(),
			maxTimeToLive: BigInt(MAX_TTL),
			onSuccess: (async () => {
				window.alert(isAuthenticated());
				await onSuccess();
				//window.location.reload();
			})
		});
	}
}

function getIdentityUrl() {
	let isLocalHost = process.env.DFX_NETWORK == 'local';
	return isLocalHost ? LOCAL_IDENTITY_URL : MAINNET_INDENTITY_URL;
}

export async function logout() {
	const authClient = await getAuthClient();
	authClient.logout();
	window.location.reload();
}