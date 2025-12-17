import type { ComponentProps } from "solid-js";

export const DriverIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <path d="M6 14h3l1.5-3a6 6 0 0 1 11.5 2c0 3.3-2.7 6-6 6H6a2 2 0 0 1-2-2V4" />
    <path d="M12 19v-2" />
  </svg>
);

export const WoodIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <path d="M7 14h3l1.5-3a5 5 0 0 1 9.5 2c0 2.8-2.2 5-5 5H7a2 2 0 0 1-2-2V5" />
    <path d="M12 18v-2" />
  </svg>
);

export const HybridIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <path d="M8 15h3l1-2a4 4 0 0 1 7.5 1.5c0 2.2-1.8 4-4 4H8a2 2 0 0 1-2-2V6" />
    <path d="M12 18.5v-2" />
  </svg>
);

export const IronIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <path d="M8 3v16a2 2 0 0 0 2 2h6l-3-6H9" />
  </svg>
);

export const PutterIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <path d="M12 3v13" />
    <path d="M8 16h8a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z" />
  </svg>
);

export const WedgeIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
     <path d="M9 3v15a2 2 0 0 0 2 2h5l-4-8H9" />
  </svg>
);
