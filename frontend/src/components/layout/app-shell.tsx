import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { CommandPalette } from '@/features/palette/command-palette';

/**
 * Authenticated application frame: fixed sidebar on desktop, sticky header and
 * an animated outlet. Route transitions are short and disabled entirely when
 * the user prefers reduced motion.
 */
export function AppShell() {
  const location = useLocation();
  // Snapshot the outlet NOW: an exiting clone must keep showing the old route.
  // A live <Outlet/> inside the exiting subtree would re-resolve to the new
  // route, mount it twice (once while exiting, once on entry) and drop state.
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="min-h-0 flex-1 overflow-y-auto">
          {/* popLayout crossfades old and new pages simultaneously - mode="wait"
              left an empty (white-looking) canvas for ~180ms on every nav. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={location.pathname}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.12, ease: 'easeOut' }}
              className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global shortcuts + Ctrl/Cmd+K palette live here so they work on every page. */}
      <CommandPalette />
    </div>
  );
}
