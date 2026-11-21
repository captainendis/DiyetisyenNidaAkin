// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme Rehberi (blog) yazıları */
import { Stack } from 'expo-router';
import { BlogList } from '@/features/content/blog/BlogList';
import { RequirePermission } from '@/features/settings/Gate';

export default function BlogIndex() {
  return (
    <>
      <Stack.Screen options={{ title: 'Beslenme Rehberi' }} />
      <RequirePermission perm="content:write">
        <BlogList />
      </RequirePermission>
    </>
  );
}
