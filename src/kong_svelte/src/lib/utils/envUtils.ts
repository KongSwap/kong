export function isLocalEnv(): boolean {
	return process.env.DFX_NETWORK === 'local';
}

export function currentEnvMode(): string {
  return process.env.DFX_NETWORK;
}
