// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Yeni blog yazısı */
import { BlogEditorScreen } from '@/features/content/blog/BlogEditor';
import { RequirePermission } from '@/features/settings/Gate';

export default function NewPostScreen() {
  return (
    <RequirePermission perm="content:write">
      <BlogEditorScreen />
    </RequirePermission>
  );
}
