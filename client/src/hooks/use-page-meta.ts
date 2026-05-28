import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
  keywords?: string;
  canonical?: string;
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

export function usePageMeta(titleOrOptions: string | PageMetaOptions, description?: string) {
  const opts: PageMetaOptions =
    typeof titleOrOptions === "string"
      ? { title: titleOrOptions, description }
      : titleOrOptions;

  useEffect(() => {
    const prev = {
      title: document.title,
      desc: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
      ogTitle: document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? "",
      ogDesc: document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? "",
      twTitle: document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content ?? "",
      twDesc: document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content ?? "",
    };

    document.title = opts.title;

    if (opts.description) {
      setMeta("description", opts.description);
      setMeta("og:description", opts.description, "property");
      setMeta("twitter:description", opts.description);
    }

    setMeta("og:title", opts.title, "property");
    setMeta("twitter:title", opts.title);

    if (opts.keywords) {
      setMeta("keywords", opts.keywords);
    }

    if (opts.canonical) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = opts.canonical;
    }

    return () => {
      document.title = prev.title;
      if (prev.desc) setMeta("description", prev.desc);
      if (prev.ogTitle) setMeta("og:title", prev.ogTitle, "property");
      if (prev.ogDesc) setMeta("og:description", prev.ogDesc, "property");
      if (prev.twTitle) setMeta("twitter:title", prev.twTitle);
      if (prev.twDesc) setMeta("twitter:description", prev.twDesc);
    };
  }, [opts.title, opts.description, opts.keywords, opts.canonical]);
}
