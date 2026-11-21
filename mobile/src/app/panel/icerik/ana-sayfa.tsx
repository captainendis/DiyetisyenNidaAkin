// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği → Ana sayfa (web: ContentPage "Ana Sayfa" sekmesi) */
import { ApproachForm, CtaForm, HeroForm, IntroForm, ProcessForm, RecipesSectionForm } from '@/features/content/HomeForms';
import { SettingsEditor } from '@/features/content/settingsStore';
import { RequirePermission } from '@/features/settings/Gate';

export default function HomeContentScreen() {
  return (
    <RequirePermission perm="content:write">
      <SettingsEditor title="Ana sayfa" keys={['hero', 'intro', 'approach', 'process', 'recipesSection', 'cta']} viewPath="/">
        <HeroForm />
        <IntroForm />
        <ApproachForm />
        <ProcessForm />
        <RecipesSectionForm />
        <CtaForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
