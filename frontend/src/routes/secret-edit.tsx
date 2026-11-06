import { ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useFolders } from '@/features/folders/queries';
import { useSecret, useUpdateSecret } from '@/features/vault/queries';
import { SecretForm, type SecretFormValues } from '@/features/vault/secret-form';
import { ApiError } from '@/lib/api';
import type { SecretCategory, SecretPayload } from '@/types/api';

function buildFormValues(
  secret: { title: string; category: SecretCategory; folderId: string | null; isFavorite: boolean; tags: string[] },
  payload: SecretPayload | null,
): SecretFormValues {
  return {
    title: secret.title,
    category: secret.category,
    folderId: secret.folderId ?? '',
    isFavorite: secret.isFavorite,
    tags: secret.tags,
    fields: payload?.fields ?? {},
    custom: payload?.custom?.map(({ key, value }) => ({ key, value })) ?? [],
    notes: payload?.notes ?? '',
  };
}

export default function SecretEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const secret = useSecret(id);
  const folders = useFolders();
  const updateSecret = useUpdateSecret();

  if (secret.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Edit secret" breadcrumbs={[{ label: 'Vault', to: '/vault' }, { label: 'Edit' }]} />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (secret.isError || !secret.data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="That item is not available"
        description={
          secret.error instanceof ApiError && secret.error.status === 404
            ? 'It may have been deleted, or the link is wrong.'
            : 'Something went wrong loading this item.'
        }
        action={
          <Button size="sm" variant="secondary" onClick={() => void navigate('/vault')}>
            Back to vault
          </Button>
        }
      />
    );
  }

  if (secret.data.decryptError || !secret.data.payload) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="This item cannot be edited"
        description="It was encrypted with a previous vault key. You can delete it and create it again."
        action={
          <Button size="sm" variant="secondary" onClick={() => void navigate(`/vault/${id}`)}>
            Back to details
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Edit “${secret.data.title}”`}
        description="Changes are re-encrypted in your browser before saving. The previous version is kept in history."
        breadcrumbs={[
          { label: 'Vault', to: '/vault' },
          { label: secret.data.title, to: `/vault/${id}` },
          { label: 'Edit' },
        ]}
      />

      <SecretForm
        folders={folders.data?.items ?? []}
        defaultValues={buildFormValues(secret.data, secret.data.payload)}
        submitLabel="Save changes"
        pending={updateSecret.isPending}
        onCancel={() => void navigate(-1)}
        onSubmit={(values) => {
          updateSecret.mutate(
            { id: secret.data!.id, ...values },
            {
              onSuccess: (updated) => {
                toast.success(`Updated “${updated.title}”`, { description: 'The previous version was kept.' });
                void navigate(`/vault/${updated.id}`);
              },
              onError: (error) => {
                toast.error('Could not save your changes', {
                  description: error instanceof ApiError ? error.message : undefined,
                });
              },
            },
          );
        }}
      />
    </div>
  );
}
