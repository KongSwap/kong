export function isLocalhost(): boolean | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return window.location.hostname === 'localhost';
}

export function currentEnvMode(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  switch (window.location.hostname) {
    case "localhost":
      return "DEV";
    case "todo":
      // TODO: Add staging canister ID
      break;
    case "kongswap.io":
      return null;
  }
}
