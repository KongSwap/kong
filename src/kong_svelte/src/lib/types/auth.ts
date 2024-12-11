import type { PNP } from "@windoge98/plug-n-play";

export interface AuthState {
  isConnected: boolean;
  principal: string | null;
  accountId: string | null;
  selectedWallet: PNP | null;
}

export interface CanisterType {
  canisterId: string;
  idl: any;
} 
