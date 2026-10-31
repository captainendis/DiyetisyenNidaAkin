import { RequireAuth } from '@/components/panel/PanelAuth';
import { PanelLayout } from '@/components/panel/PanelLayout';

export default function PanelShell() {
  return (
    <RequireAuth>
      <PanelLayout />
    </RequireAuth>
  );
}
