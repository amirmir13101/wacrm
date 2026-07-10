import Script from "next/script";

const YANDEX_METRICA_COUNTER_ID = 110570956;

export function YandexMetrica() {
  return (
    <Script
      id="yandex-metrica"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function () {
            var allowedHosts = new Set(["talkwagon.chat", "www.talkwagon.chat"]);
            if (!allowedHosts.has(window.location.hostname)) return;
            if (window.ym && window.ym.__talkWagonMetricaLoaded) return;
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              m[i].__talkWagonMetricaLoaded=true;
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) { return; }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
            })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRICA_COUNTER_ID}", "ym");

            ym(${YANDEX_METRICA_COUNTER_ID}, "init", {
              ssr: true,
              clickmap: true,
              ecommerce: "dataLayer",
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true
            });
          })();
        `,
      }}
    />
  );
}
