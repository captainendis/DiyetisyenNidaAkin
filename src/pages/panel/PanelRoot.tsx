import { Outlet } from 'react-router';
import { PanelAuthProvider } from '@/components/panel/PanelAuth';

/** /panel altındaki tüm sayfalar (giriş dahil) için kimlik bağlamı */
export default function PanelRoot() {
  return (
    <PanelAuthProvider>
      <Outlet />
    </PanelAuthProvider>
  );
}
