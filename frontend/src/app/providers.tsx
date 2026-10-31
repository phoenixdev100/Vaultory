import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from '@/app/query-client';
import { ThemeProvider } from '@/app/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/features/auth/auth-provider';
import { VaultProvider } from '@/features/vault/vault-provider';
import { WorkspaceProvider } from '@/features/workspace/workspace-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <VaultProvider>
                <TooltipProvider delayDuration={300} skipDelayDuration={200}>
                  {children}
                  <Toaster />
                </TooltipProvider>
              </VaultProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
