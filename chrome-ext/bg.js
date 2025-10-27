const APP_BASE = "https://price-watcher-rgfpt5aun-ovadias-projects.vercel.app/"; // ← remplace

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-price-watcher",
    title: "Ajouter ce séjour à Price Watcher",
    contexts: ["page", "link"]
  });
});

async function openWithParams(urlString) {
  try {
    const u = new URL(urlString);
    const p = new URLSearchParams();
    p.set("url", u.toString());

    // heuristiques simples pour Booking/Expedia
    ["checkin","checkout","adults","children","curr","price"].forEach(k=>{
      const v = u.searchParams.get(k);
      if (v) p.set(k, v);
    });

    const target = `${APP_BASE}/?${p.toString()}`;
    await chrome.tabs.create({ url: target });
  } catch (e) {
    console.error("openWithParams", e);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.url) openWithParams(tab.url);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const u = info.linkUrl || info.pageUrl || (tab && tab.url);
  if (u) openWithParams(u);
});
