import { TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const RELOAD_FLAG = 'vaultory.chunk-reload';

/**
 * Last-resort crash screen. The important case for a PWA is a stale tab after
 * a deploy: the cached index.html requests a hashed chunk that no longer
 * exists, the dynamic import rejects and React would otherwise unmount to a
 * blank page. That specific failure reloads once automatically; anything else
 * gets a manual reload + sign-in-safe message.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const chunkFailure =
      error.name === 'ChunkLoadError' ||
      /Loading chunk|Failed to fetch dynamically imported module|dynamically imported module/i.test(
        error.message,
      );

    if (chunkFailure && sessionStorage.getItem(RELOAD_FLAG) !== '1') {
      // One silent reload picks up the new index.html (fresh asset hashes).
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
      return;
    }
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-warning/15 text-warning">
              <TriangleAlert className="size-5" />
            </span>
            <h1 className="text-base font-semibold text-fg">Something went wrong</h1>
            <p className="text-[13px] text-fg-muted">
              The app hit an unexpected error. Your vault data is safe - reloading usually fixes it.
            </p>
            <Button
              size="sm"
              onClick={() => {
                sessionStorage.removeItem(RELOAD_FLAG);
                window.location.reload();
              }}
            >
              Reload app
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
