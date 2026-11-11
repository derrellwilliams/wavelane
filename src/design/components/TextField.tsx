import { useRef } from "preact/hooks";
import { isOK } from "../../nav/keys";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /// OK on the TV keyboard (or Enter): the field is finished.
  onDone?: () => void;
  placeholder?: string;
  secret?: boolean;
  mono?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

/// A labelled text field for the remote. The frame is what the focus engine lands on; OK on it
/// starts typing (which opens the TV keyboard), and OK again finishes. Landing on the frame alone
/// never opens the keyboard, so the field can be passed over with the arrows.
export function TextField({ label, value, onChange, onDone, placeholder, secret, mono, autoFocus, maxLength = 200 }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={frame}
      class="field"
      data-focusable
      data-autofocus={autoFocus || undefined}
      tabIndex={-1}
      onClick={() => input.current?.focus({ preventScroll: true })}
    >
      <span class="field-label">{label}</span>
      <input
        ref={input}
        class={mono ? "field-input mono" : "field-input"}
        {...(secret ? { type: "password" } : { type: "text" })}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        tabIndex={-1}
        aria-label={label}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        onInput={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (!isOK(event)) return;
          event.preventDefault();
          event.stopPropagation();
          // A held OK (the press that opened the field, still repeating) must not also finish it.
          if (event.repeat) return;
          frame.current?.focus({ preventScroll: true });
          onDone?.();
        }}
      />
    </div>
  );
}
