'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';

const TAWK_PUBLIC_PATHS = new Set([
  '/',
  '/features',
  '/features/team-inbox',
  '/features/broadcasts',
  '/features/automation',
  '/pricing',
  '/checkout/pro',
  '/checkout/lifetime',
  '/about',
  '/contact',
  '/privacy-policy',
  '/terms-and-conditions',
  '/refund-policy',
]);

export function TawkToWidget() {
  const pathname = usePathname();

  if (!TAWK_PUBLIC_PATHS.has(pathname)) {
    return null;
  }

  return (
    <Script
      id="tawk-to-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
          (function(){
            var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
            s1.async = true;
            s1.src = 'https://embed.tawk.to/69c2fd0846a6c41c341aac11/1jkgqoql8';
            s1.charset = 'UTF-8';
            s1.setAttribute('crossorigin', '*');
            s0.parentNode.insertBefore(s1, s0);
          })();
        `,
      }}
    />
  );
}
