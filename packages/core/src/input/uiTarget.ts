/** CSS selector for DOM controls that should not start a camera gesture. */
export const UI_POINTER_SELECTOR = "button, a, input, select, textarea, label, .guide-rail";

export function isUiPointerTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as HTMLElement).closest !== "function") return false;
  return Boolean((target as HTMLElement).closest(UI_POINTER_SELECTOR));
}
