import { A } from '@solidjs/router';

const BagIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M6 10h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10Z" />
    <path d="M6 14h12" />
    <path d="M9 10V5l-2-1" />
    <path d="M12 10V3l1-1" />
    <path d="M15 10V5l2-1" />
  </svg>
);

const Header = () => {
  return (
    <header class="bg-golf-surface border-b border-white/5 sticky top-0 z-50">
      <div class="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <A href="/" class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-golf-dark">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          Golf Stats
        </A>

        <A
          href="/bag"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          title="Edit Bag"
        >
          <BagIcon class="w-6 h-6" />
        </A>
      </div>
    </header>
  );
};

export default Header;
