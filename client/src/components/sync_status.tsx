import { Show } from "solid-js";
import {
  useOnlineStatus,
  useSyncQueueCount,
  useProcessSync,
} from "~/hooks/use_local_data";

/**
 * Floating sync status indicator
 * - Shows in bottom-right corner
 * - Only visible when offline OR has pending sync items OR actively syncing
 * - Tapping triggers immediate sync when online
 */
export function SyncStatus() {
  const isOnline = useOnlineStatus();
  const syncCount = useSyncQueueCount();
  const processSync = useProcessSync();

  const pendingCount = () => syncCount.data ?? 0;
  const isSyncing = () => processSync.isPending;

  // Only show if offline OR has pending items OR is syncing
  const shouldShow = () => !isOnline() || pendingCount() > 0 || isSyncing();

  const handleClick = () => {
    if (isOnline() && !isSyncing()) {
      processSync.mutate();
    }
  };

  return (
    <Show when={shouldShow()}>
      <button
        onClick={handleClick}
        disabled={!isOnline() || isSyncing()}
        class={`
          fixed bottom-4 right-4 z-50
          flex items-center gap-2
          px-4 py-2 rounded-full
          text-sm font-medium
          shadow-lg backdrop-blur-sm
          transition-all duration-200
          ${
            !isOnline()
              ? "bg-red-500/90 text-white cursor-not-allowed"
              : isSyncing()
                ? "bg-emerald-500/90 text-white cursor-wait"
                : "bg-slate-800/90 text-white hover:bg-slate-700/90 cursor-pointer"
          }
        `}
      >
        {/* Status indicator dot */}
        <span
          class={`
            w-2 h-2 rounded-full
            ${!isOnline() ? "bg-red-300" : "bg-emerald-400"}
            ${isSyncing() ? "animate-pulse" : ""}
          `}
        />

        {/* Status text */}
        <Show
          when={!isOnline()}
          fallback={
            <Show
              when={isSyncing()}
              fallback={
                <span>
                  {pendingCount()} pending
                </span>
              }
            >
              <span class="flex items-center gap-2">
                <svg
                  class="w-4 h-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Syncing...
              </span>
            </Show>
          }
        >
          <span>
            Offline
            <Show when={pendingCount() > 0}>
              {" "}({pendingCount()} pending)
            </Show>
          </span>
        </Show>
      </button>
    </Show>
  );
}
