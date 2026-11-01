// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import './styles/index.css';
import { router } from './router';
import { SiteProvider } from './data/SiteContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteProvider>
      <RouterProvider router={router} />
    </SiteProvider>
  </StrictMode>,
);
