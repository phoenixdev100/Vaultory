import { ErrorBoundary } from '@/app/error-boundary';
import { Providers } from '@/app/providers';
import { AppRouter } from '@/app/router';

export function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <AppRouter />
      </Providers>
    </ErrorBoundary>
  );
}
