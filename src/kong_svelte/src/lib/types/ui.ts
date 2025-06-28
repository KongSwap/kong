export interface UITab<T> {
  id: T;
  label: string;
  icon?: any; // Icon component type
  badge?: number | string;
  disabled?: boolean;
}

export interface UITabAction {
  id: string;
  icon: any; // Icon component type
  tooltip?: string;
  variant?: "default" | "danger";
  onClick: () => void;
} 