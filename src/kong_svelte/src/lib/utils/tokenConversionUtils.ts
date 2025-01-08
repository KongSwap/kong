export function formatTokenInput(value: string, decimals: number): string {
  let formattedValue = value.replace(/[^0-9.]/g, "");
  const parts = formattedValue.split(".");
  
  if (parts.length > 2) {
    formattedValue = `${parts[0]}.${parts[1]}`;
  }

  if (parts[1]?.length > decimals) {
    formattedValue = `${parts[0]}.${parts[1].slice(0, decimals)}`;
  }

  return formattedValue;
}

export function convertToTokenAmount(amount: string, decimals: number): bigint {
  return BigInt(Math.floor(Number(amount) * 10 ** decimals).toString());
} 