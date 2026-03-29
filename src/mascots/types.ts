export type MascotState =
  | "idle"
  | "thinking"
  | "needs-input"
  | "error"
  | "compacting"
  | "notification"
  | "entering"
  | "exiting";

export interface MascotDefinition {
  svg(state: MascotState): string;
  css: string;
  metadata: {
    name: string;
    defaultColor: string;
    size: { width: number; height: number };
  };
}
