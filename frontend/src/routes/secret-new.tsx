import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { useFolders } from '@/features/folders/queries';
import { useCreateSecret } from '@/features/vault/queries';
import { SecretForm, type SecretFormValues } from '@/features/vault/secret-form';
import { ApiError } from '@/lib/api';
import type { SecretCategory } from '@/types/api';

export default function SecretNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const folders = useFolders();
  const createSecret = useCreateSecret();

  const presetCategory = params.get('category') as SecretCategory | null;
  const presetFolder = params.get('folder');

  const defaultValues: Partial<SecretFormValues> = {
    ...(presetCategory ? { category: presetCategory } : {}),
    ...(presetFolder ? { folderId: presetFolder } : {}),
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="New secret"
        description="Values are encrypted in your browser with your vault key before anything is sent."
        breadcrumbs={[
          { label: 'Vault', to: '/vault' },
          { label: 'New secret' },
        ]}
      />

      <SecretForm
        folders={folders.data?.items ?? []}
        defaultValues={defaultValues}
        submitLabel="Encrypt & save"
        pending={createSecret.isPending}
        onCancel={() => void navigate(-1)}
        onSubmit={(values) => {
          createSecret.mutate(values, {
            onSuccess: (secret) => {
              toast.success(`Saved “${secret.title}”`, { description: 'Encrypted and stored in your vault.' });
              void navigate(`/vault/${secret.id}`);
            },
            onError: (error) => {
              toast.error('Could not save that item', {
                description: error instanceof ApiError ? error.message : 'Check the fields and try again.',
              });
            },
          });
        }}
      />
    </div>
  );
}
