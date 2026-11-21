// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Blog yazısı düzenleme */
import { useLocalSearchParams } from 'expo-router';
import { BlogEditorScreen } from '@/features/content/blog/BlogEditor';
import { RequirePermission } from '@/features/settings/Gate';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePermission perm="content:write">
      <BlogEditorScreen id={id === 'yeni' ? undefined : id} />
    </RequirePermission>
  );
}
