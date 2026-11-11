import { icons, type IconName } from "../icons.gen";

/// A Phosphor Bold icon, sized by the text around it and colored like it.
export function Icon({ name }: { name: IconName }) {
  return (
    <svg class="icon" viewBox="0 0 256 256" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}
