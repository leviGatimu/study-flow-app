/**
 * A useSyncExternalStore `subscribe` for values only the browser knows (today's
 * date, the device time zone, a media query) that never announce changes.
 *
 * The server renders with getServerSnapshot. With a subscribe that never calls
 * back, React can keep that server value after hydration, so the browser's
 * real value never shows. Calling back once, right after mount, makes React
 * read getSnapshot and re-render if it differs.
 */
export function subscribeOnMount(onChange: () => void) {
  const id = window.setTimeout(onChange, 0);
  return () => window.clearTimeout(id);
}
