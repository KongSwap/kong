import { Wallet, MessagesSquare, Bell, LogOut, X } from "lucide-svelte";
import type {
  Component,
  ComponentConstructorOptions,
  SvelteComponent,
} from "svelte";
import WalletPanel from "$lib/components/wallet/WalletPanel.svelte";
import TrollboxPanel from "$lib/components/wallet/trollbox/TrollboxPanel.svelte";
import NotificationsPanel from "$lib/components/notifications/NotificationsPanel.svelte";

export type WalletTabId = "wallet" | "chat" | "notifications";

type IconComponent = typeof Wallet;
type PanelComponent = typeof WalletPanel;

export interface WalletTab {
  id: WalletTabId;
  label: string;
  icon: IconComponent;
  component: PanelComponent;
  showBadge?: boolean;
}

export interface WalletAction {
  id: string;
  icon: IconComponent;
  label?: string;
  tooltip: string;
  variant?: "default" | "danger";
}

// Main tabs configuration
export const WALLET_TABS: WalletTab[] = [
  {
    id: "wallet",
    label: "Wallet",
    icon: Wallet,
    component: WalletPanel,
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessagesSquare,
    component: TrollboxPanel,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    component: NotificationsPanel,
    showBadge: true,
  },
];

// Action buttons configuration
export const WALLET_ACTIONS: WalletAction[] = [
  {
    id: "disconnect",
    icon: LogOut,
    tooltip: "Disconnect wallet",
    variant: "default",
  },
  {
    id: "close",
    icon: X,
    tooltip: "Close sidebar",
    variant: "default",
  },
];

// Helper to get tab by ID
export function getTabById(id: WalletTabId): WalletTab | undefined {
  return WALLET_TABS.find((tab) => tab.id === id);
}

// Transition configurations
export const WALLET_TRANSITIONS = {
  backdrop: {
    fade: { duration: 200 },
  },
  panel: {
    fly: {
      x: 480,
      duration: 300,
      // easing will be imported where used
    },
  },
} as const;
