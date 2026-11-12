import type { ComponentChildren } from "preact";
import type { IconName } from "../icons.gen";
import { useHold } from "../../nav/hold";
import { Icon } from "./Icon";

interface Props {
  children: ComponentChildren;
  onPress: () => void;
  icon?: IconName;
  /// Starts with focus when its screen appears.
  autoFocus?: boolean;
  /// Dimmed and inert, but still reachable: focus never has to jump when a button turns off.
  disabled?: boolean;
  /// A toggle that is switched on (a filter in use, "Watched"). Leave unset for plain buttons.
  on?: boolean;
  /// Called when OK (or the pointer) is held down; a short press still calls `onPress`.
  onHold?: () => void;
}

/// The app's one button. Focus (remote or pointer) inverts it to a tan fill.
export function Button({ children, onPress, icon, autoFocus, disabled, on, onHold }: Props) {
  const press = useHold(onHold, () => {
    if (!disabled) onPress();
  });
  return (
    <button
      class="button"
      type="button"
      data-focusable
      data-autofocus={autoFocus || undefined}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      aria-pressed={on}
      {...press}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
