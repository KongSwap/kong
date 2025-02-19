export type CanisterNetwork = 'local' | 'staging' | 'staging_fe' | 'ic';

export interface DeployOptions {
  network: CanisterNetwork;
  clean: boolean;
} 