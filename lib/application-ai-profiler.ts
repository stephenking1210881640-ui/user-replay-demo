import { Prisma } from "@prisma/client";

const agentVersion = "agent1-v1";
const maxPages = 4;
const maxHtmlLength = 500_000;
const maxAssetTextLength = 1_500_000;
const requestTimeoutMs = 8000;

export type CrawlPage = {
  url: string;
  path: string;
  title: string;
  description: string;
  headings: string[];
  textSample: string;
  links: Array<{ label: string; href: string; path: string }>;
  sections: Array<{
    type: string;
    label: string;
    regionKey: string;
    text: string;
    selectorHint: string;
    source: string;
  }>;
  interactiveElements: AgentInteractiveElement[];
};

type AgentInteractiveElement = {
  id: string;
  pageUrl: string;
  pagePath: string;
  elementType: string;
  label: string;
  href?: string;
  action?: string;
  method?: string;
  selectorHint: string;
  regionKey: string;
  regionLabel: string;
  businessMeaning: string;
  suggestedTrackEvent: string;
  suggestedPayload: Record<string, string>;
  confidence: number;
};

export type ApplicationAiProfileOutput = {
  appSummary: {
    purpose: string;
    primaryAudience: string;
    valueProposition: string;
    evidence: string[];
  };
  pageMap: Array<{
    url: string;
    path: string;
    title: string;
    purpose: string;
    keyRegions: string[];
    keyInteractions: string[];
  }>;
  regions: Array<{
    key: string;
    name: string;
    pages: string[];
    description: string;
    detectionStrategy: string;
    suggestedDataAttribute: string;
    confidence: number;
  }>;
  interactiveElements: AgentInteractiveElement[];
  businessJourneys: Array<{
    key: string;
    name: string;
    goal: string;
    entryPages: string[];
    keySteps: string[];
    successSignals: string[];
    failureSignals: string[];
    recommendedTrackEvents: string[];
  }>;
  successSignals: Array<{
    key: string;
    label: string;
    ruleType: "page" | "event" | "request" | "ui";
    rule: string;
    confidence: number;
  }>;
  failureSignals: Array<{
    key: string;
    label: string;
    ruleType: "page" | "event" | "request" | "ui";
    rule: string;
    severity: "warning" | "critical";
    confidence: number;
  }>;
  sdkRecommendations: Array<{
    eventName: string;
    trigger: string;
    regionKey: string;
    businessMeaning: string;
    suggestedPayload: Record<string, string>;
    suggestedDataAttributes: Record<string, string>;
    priority: "high" | "medium" | "low";
  }>;
  confidenceNotes: Array<{
    topic: string;
    note: string;
    confidence: number;
  }>;
  crawlMetadata: {
    sourceUrl: string;
    normalizedUrl: string;
    crawledAt: string;
    crawledPageCount: number;
    skippedUrls: string[];
    version: string;
  };
};

export type ApplicationAiProfileInput = {
  tenantId: string;
  applicationId: string;
  websiteUrl: string;
  businessHint?: string | null;
};

export type Agent1CrawlSnapshot = {
  sourceUrl: string;
  normalizedUrl: string;
  crawledAt: string;
  crawledPageCount: number;
  pages: CrawlPage[];
  skippedUrls: string[];
  version: string;
};

export type ApplicationAiProfileCreateOptions = {
  inputSnapshot?: Agent1CrawlSnapshot;
  modelOutput?: unknown;
  modelMetadata?: unknown;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  generationMode?: "heuristic" | "llm" | "llm_fallback";
  fallbackUsed?: boolean;
};

function normalizeWebsiteUrl(value: string) {
  const parsed = new URL(value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("websiteUrl 仅支持 http/https。");
  }
  parsed.hash = "";
  return parsed;
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function readAttr(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return tag.match(pattern)?.[1]?.trim() ?? "";
}

function slugify(value: string, fallback = "unknown") {
  const slug = value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function toAbsoluteUrl(href: string, baseUrl: string) {
  try {
    const url = new URL(href, baseUrl);
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function inferRegionFromText(text: string, elementType = "") {
  const value = `${text} ${elementType}`.toLowerCase();
  if (/add to cart|加入购物车/.test(value)) return { key: "product_area", name: "商品展示区" };
  if (/cart|basket|购物车|checkout|结算/.test(value)) return { key: "cart_area", name: "购物车与结算区" };
  if (/product|商品|sku|price|价格/.test(value)) return { key: "product_area", name: "商品展示区" };
  if (/filter|size|category|筛选|分类|尺码/.test(value)) return { key: "filter_area", name: "筛选与分类区" };
  if (/login|sign in|register|登录|注册/.test(value)) return { key: "auth_area", name: "登录注册区" };
  if (/search|搜索/.test(value)) return { key: "search_area", name: "搜索区" };
  if (/nav|menu|导航|菜单/.test(value)) return { key: "navigation", name: "导航区" };
  if (/footer|帮助|help|contact|联系/.test(value)) return { key: "footer_area", name: "页脚帮助区" };
  if (/form|submit|提交|预约|报名/.test(value)) return { key: "form_area", name: "表单提交区" };
  return { key: "content_area", name: "内容主体区" };
}

function inferBusinessMeaning(label: string, href = "") {
  const value = `${label} ${href}`.toLowerCase();
  if (/add to cart|加入购物车/.test(value)) return "将商品加入购物车";
  if (/checkout|结算|支付|pay|purchase|buy/.test(value)) return "发起结算或支付";
  if (/remove|delete|移除|删除/.test(value)) return "移除已选对象";
  if (/plus|increase|\+|增加/.test(value)) return "增加数量或提高配置";
  if (/minus|decrease|-|减少/.test(value)) return "减少数量或降低配置";
  if (/filter|size|category|筛选|分类|尺码/.test(value)) return "筛选目标内容";
  if (/search|搜索/.test(value)) return "搜索目标内容";
  if (/submit|提交|预约|报名|confirm|确认/.test(value)) return "提交业务表单";
  if (/login|sign in|登录/.test(value)) return "登录或身份识别";
  if (/register|sign up|注册/.test(value)) return "注册新账号";
  if (/learn|detail|详情|more|更多/.test(value)) return "查看详情信息";
  return "触发页面交互";
}

function inferTrackEvent(label: string, businessMeaning: string, elementType: string) {
  const value = `${label} ${businessMeaning}`.toLowerCase();
  if (/加入购物车|add to cart/.test(value)) return "product_add_to_cart";
  if (/结算|支付|checkout|purchase|pay/.test(value)) return "checkout_clicked";
  if (/移除|删除|remove|delete/.test(value)) return "cart_item_removed";
  if (/增加数量|increase|plus/.test(value)) return "cart_item_quantity_increased";
  if (/减少数量|decrease|minus/.test(value)) return "cart_item_quantity_decreased";
  if (/筛选|filter|category|size/.test(value)) return "filter_changed";
  if (/搜索|search/.test(value)) return "search_submitted";
  if (/提交|submit|预约|报名|confirm/.test(value)) return "form_submit_clicked";
  if (/登录|login|sign in/.test(value)) return "login_clicked";
  if (/注册|register|sign up/.test(value)) return "signup_clicked";
  return `${slugify(elementType)}_${slugify(label || businessMeaning, "clicked")}`;
}

function extractLinks(html: string, pageUrl: string) {
  const links: Array<{ label: string; href: string; path: string }> = [];
  for (const match of Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))) {
    const href = readAttr(match[1], "href");
    const url = href ? toAbsoluteUrl(href, pageUrl) : null;
    if (!url) continue;
    const label = stripTags(match[2]).slice(0, 80) || url.pathname;
    links.push({ label, href: url.href, path: url.pathname || "/" });
  }
  return uniqueBy(links, (link) => link.href).slice(0, 30);
}

function extractScriptUrls(html: string, pageUrl: string) {
  const urls: string[] = [];
  for (const match of Array.from(html.matchAll(/<script\b([^>]*)>/gi))) {
    const src = readAttr(match[1], "src");
    const url = src ? toAbsoluteUrl(src, pageUrl) : null;
    if (url && url.origin === new URL(pageUrl).origin && url.pathname.endsWith(".js")) {
      urls.push(url.href);
    }
  }
  return uniqueBy(urls, (url) => url).slice(0, 3);
}

function extractClientRenderedLabels(assetText: string) {
  if (!assetText) return [];

  const candidates = new Set<string>();
  const patterns = [
    /Add to cart/gi,
    /Checkout/gi,
    /Cart/gi,
    /SUBTOTAL/gi,
    /Product\(s\) found/gi,
    /Free shipping/gi,
    /Quantity/gi,
    /remove product from cart/gi,
  ];

  for (const pattern of patterns) {
    for (const match of Array.from(assetText.matchAll(pattern))) {
      if (match[0]) candidates.add(match[0]);
    }
  }

  return Array.from(candidates);
}

function extractHeadings(html: string) {
  return Array.from(html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .slice(0, 12);
}

function extractSections(html: string, pageUrl: string, assetText = "") {
  const sections: CrawlPage["sections"] = [];
  const tags = ["header", "nav", "main", "aside", "section", "form", "footer"];
  for (const tag of tags) {
    const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let index = 0;
    for (const match of Array.from(html.matchAll(pattern))) {
      index += 1;
      const attrs = match[1];
      const rawLabel = readAttr(attrs, "aria-label") || readAttr(attrs, "data-ur-region") || readAttr(attrs, "id") || readAttr(attrs, "class");
      const text = stripTags(match[2]).slice(0, 240);
      const inferred = inferRegionFromText(`${rawLabel} ${text}`, tag);
      const key = rawLabel ? slugify(rawLabel, inferred.key) : inferred.key;
      sections.push({
        type: tag,
        label: rawLabel || inferred.name,
        regionKey: key,
        text,
        selectorHint: `${tag}:nth-of-type(${index})`,
        source: rawLabel ? "dom_attribute" : "heuristic",
      });
    }
  }
  if (!sections.length) {
    sections.push({
      type: "main",
      label: inferRegionFromText(stripTags(html).slice(0, 400)).name,
      regionKey: inferRegionFromText(stripTags(html).slice(0, 400)).key,
      text: stripTags(html).slice(0, 240),
      selectorHint: "body",
      source: "fallback",
    });
  }

  const clientLabels = extractClientRenderedLabels(assetText);
  if (clientLabels.some((label) => /add to cart|product|free shipping/i.test(label))) {
    sections.push({
      type: "client_component",
      label: "商品列表与商品卡片",
      regionKey: "product_area",
      text: "从客户端 JS bundle 识别到商品展示、加购与免邮等交互文案。",
      selectorHint: "client-rendered product area",
      source: "client_bundle_heuristic",
    });
  }
  if (clientLabels.some((label) => /cart|checkout|subtotal|quantity/i.test(label))) {
    sections.push({
      type: "client_component",
      label: "购物车与结算抽屉",
      regionKey: "cart_area",
      text: "从客户端 JS bundle 识别到购物车、数量、小计和结算等交互文案。",
      selectorHint: "client-rendered cart drawer",
      source: "client_bundle_heuristic",
    });
  }

  return sections.map((section) => ({ ...section, selectorHint: `${new URL(pageUrl).pathname || "/"} ${section.selectorHint}` })).slice(0, 16);
}

function extractInteractiveElements(html: string, pageUrl: string, assetText = "") {
  const page = new URL(pageUrl);
  const elements: AgentInteractiveElement[] = [];
  let seq = 0;

  const pushElement = (elementType: string, label: string, attrs: string, href?: string) => {
    const cleanLabel = label.replace(/\s+/g, " ").trim().slice(0, 100);
    if (!cleanLabel && !href) return;
    seq += 1;
    const businessMeaning = inferBusinessMeaning(cleanLabel, href);
    const region = inferRegionFromText(`${cleanLabel} ${href ?? ""}`, elementType);
    const eventName = inferTrackEvent(cleanLabel, businessMeaning, elementType);
    const selectorHint = `${elementType}:nth-interactive(${seq})`;
    elements.push({
      id: `${slugify(page.pathname || "home")}_${seq}`,
      pageUrl,
      pagePath: page.pathname || "/",
      elementType,
      label: cleanLabel || href || elementType,
      href,
      action: readAttr(attrs, "action") || undefined,
      method: readAttr(attrs, "method") || undefined,
      selectorHint,
      regionKey: region.key,
      regionLabel: region.name,
      businessMeaning,
      suggestedTrackEvent: eventName,
      suggestedPayload: {
        pagePath: page.pathname || "/",
        label: cleanLabel || href || elementType,
        region: region.key,
      },
      confidence: cleanLabel ? 0.72 : 0.48,
    });
  };

  for (const match of Array.from(html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi))) {
    pushElement("button", stripTags(match[2]) || readAttr(match[1], "aria-label") || readAttr(match[1], "title"), match[1]);
  }
  for (const match of Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))) {
    const href = readAttr(match[1], "href");
    const url = href ? toAbsoluteUrl(href, pageUrl) : null;
    pushElement("link", stripTags(match[2]) || readAttr(match[1], "aria-label") || href, match[1], url?.href);
  }
  for (const match of Array.from(html.matchAll(/<input\b([^>]*)>/gi))) {
    const type = readAttr(match[1], "type") || "text";
    if (["hidden", "password"].includes(type.toLowerCase())) continue;
    pushElement(`input:${type}`, readAttr(match[1], "aria-label") || readAttr(match[1], "placeholder") || readAttr(match[1], "name") || type, match[1]);
  }
  for (const match of Array.from(html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi))) {
    pushElement("form", readAttr(match[1], "aria-label") || stripTags(match[2]).slice(0, 80) || "表单提交", match[1]);
  }

  for (const label of extractClientRenderedLabels(assetText)) {
    if (/subtotal|product\(s\) found|free shipping/i.test(label)) continue;
    pushElement("client_button", label, "");
  }

  return uniqueBy(elements, (element) => `${element.pageUrl}:${element.elementType}:${element.label}:${element.href ?? ""}`).slice(0, 50);
}

function extractPage(html: string, pageUrl: string, assetText = ""): CrawlPage {
  const url = new URL(pageUrl);
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || url.hostname;
  const description = readAttr(html.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i)?.[0] ?? "", "content");
  const headings = extractHeadings(html);
  const clientLabels = extractClientRenderedLabels(assetText);
  return {
    url: url.href,
    path: url.pathname || "/",
    title,
    description,
    headings: headings.length ? headings : clientLabels.slice(0, 8),
    textSample: `${stripTags(html).slice(0, 900)} ${clientLabels.join(" ")}`.trim().slice(0, 1200),
    links: extractLinks(html, url.href),
    sections: extractSections(html, url.href, assetText),
    interactiveElements: extractInteractiveElements(html, url.href, assetText),
  };
}

async function fetchText(url: string, maxLength: number, accept: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "UserReplayAgent1/1.0 (+https://user-replay-demo.vercel.app)",
        Accept: accept,
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`抓取失败：HTTP ${response.status}`);
    }
    return (await response.text()).slice(0, maxLength);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtml(url: string) {
  const html = await fetchText(url, maxHtmlLength, "text/html,application/xhtml+xml");
  return html;
}

async function fetchLinkedAssetText(html: string, pageUrl: string) {
  const scriptUrls = extractScriptUrls(html, pageUrl);
  const chunks: string[] = [];
  for (const scriptUrl of scriptUrls) {
    try {
      chunks.push(await fetchText(scriptUrl, maxAssetTextLength, "application/javascript,text/javascript,*/*"));
    } catch {
      // Asset parsing is best-effort. HTML analysis still works without it.
    }
  }
  return chunks.join("\n").slice(0, maxAssetTextLength);
}

function chooseNextLinks(page: CrawlPage, origin: string, visited: Set<string>) {
  const keywordScore = (link: { label: string; href: string }) => {
    const value = `${link.label} ${link.href}`.toLowerCase();
    let score = 0;
    if (/product|商品|pricing|价格|cart|购物车|checkout|结算|login|登录|signup|注册|about|help|docs/.test(value)) score += 5;
    if (/#|javascript:|mailto:|tel:/.test(value)) score -= 10;
    if (/privacy|terms|facebook|twitter|github|instagram/.test(value)) score -= 4;
    return score;
  };

  return page.links
    .map((link) => ({ link, url: toAbsoluteUrl(link.href, page.url), score: keywordScore(link) }))
    .filter((item): item is { link: { label: string; href: string; path: string }; url: URL; score: number } => Boolean(item.url))
    .filter((item) => item.url.origin === origin && !visited.has(item.url.href) && item.score > -5)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map((item) => item.url.href);
}

async function crawlApplication(startUrl: URL) {
  const queue = [startUrl.href];
  const visited = new Set<string>();
  const skippedUrls: string[] = [];
  const pages: CrawlPage[] = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const html = await fetchHtml(url);
      const assetText = await fetchLinkedAssetText(html, url);
      const page = extractPage(html, url, assetText);
      pages.push(page);
      for (const next of chooseNextLinks(page, startUrl.origin, visited)) {
        if (!queue.includes(next) && pages.length + queue.length < maxPages) {
          queue.push(next);
        }
      }
    } catch (error) {
      skippedUrls.push(`${url} - ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (!pages.length) {
    throw new Error(skippedUrls[0] || "未能抓取任何页面。");
  }

  return { pages, skippedUrls };
}

function inferAppSummary(pages: CrawlPage[], businessHint?: string | null) {
  const corpus = `${businessHint ?? ""} ${pages.map((page) => `${page.title} ${page.description} ${page.headings.join(" ")} ${page.textSample}`).join(" ")}`.toLowerCase();
  if (/cart|checkout|product|shop|商品|购物|结算|支付/.test(corpus)) {
    return {
      purpose: businessHint || "该应用主要承载商品浏览、购物车管理与结算转化流程。",
      primaryAudience: "有购买意向的线上访客或测试用户",
      valueProposition: "帮助用户快速浏览商品、加入购物车并完成购买决策。",
    };
  }
  if (/course|class|education|课程|教育|报名|试听/.test(corpus)) {
    return {
      purpose: businessHint || "该应用主要承载课程浏览、试听预约或报名转化流程。",
      primaryAudience: "学生、家长、教师或课程运营人员",
      valueProposition: "帮助用户理解课程价值并完成预约或报名。",
    };
  }
  if (/dashboard|console|workspace|admin|报表|工作台|管理/.test(corpus)) {
    return {
      purpose: businessHint || "该应用主要承载业务工作台、配置管理或数据分析流程。",
      primaryAudience: "企业内部用户、运营人员或管理员",
      valueProposition: "帮助用户完成业务配置、查看数据并处理运营任务。",
    };
  }
  return {
    purpose: businessHint || "该应用用于向用户展示内容并引导其完成关键业务操作。",
    primaryAudience: "目标应用的访问用户",
    valueProposition: "通过页面信息和交互入口推动用户完成核心目标。",
  };
}

function buildPagePurpose(page: CrawlPage) {
  const corpus = `${page.title} ${page.headings.join(" ")} ${page.textSample}`.toLowerCase();
  if (/cart|购物车/.test(corpus)) return "购物车查看与商品数量调整";
  if (/checkout|结算|支付/.test(corpus)) return "结算与支付确认";
  if (/product|商品|price|价格/.test(corpus)) return "商品浏览与购买意向建立";
  if (/login|登录/.test(corpus)) return "用户登录";
  if (/form|submit|提交|预约|报名/.test(corpus)) return "表单填写与业务提交";
  return "内容浏览与下一步引导";
}

function buildRegions(pages: CrawlPage[]) {
  const regionMap = new Map<string, ApplicationAiProfileOutput["regions"][number]>();
  for (const page of pages) {
    for (const section of page.sections) {
      const existing = regionMap.get(section.regionKey);
      const description = section.text || `${section.label} 区域`;
      if (existing) {
        existing.pages = Array.from(new Set([...existing.pages, page.path]));
        existing.confidence = Math.max(existing.confidence, section.source === "dom_attribute" ? 0.82 : 0.58);
      } else {
        regionMap.set(section.regionKey, {
          key: section.regionKey,
          name: section.label || section.regionKey,
          pages: [page.path],
          description: description.slice(0, 160),
          detectionStrategy: section.source === "dom_attribute" ? "读取 DOM 属性或语义标签" : "基于文本、标签和交互元素启发式推断",
          suggestedDataAttribute: `data-ur-region="${section.regionKey}"`,
          confidence: section.source === "dom_attribute" ? 0.82 : 0.58,
        });
      }
    }
    for (const element of page.interactiveElements) {
      if (!regionMap.has(element.regionKey)) {
        regionMap.set(element.regionKey, {
          key: element.regionKey,
          name: element.regionLabel,
          pages: [page.path],
          description: `由交互元素“${element.label}”推断出的业务区域。`,
          detectionStrategy: "基于交互元素标签和链接推断",
          suggestedDataAttribute: `data-ur-region="${element.regionKey}"`,
          confidence: 0.62,
        });
      }
    }
  }
  return Array.from(regionMap.values()).slice(0, 20);
}

function buildBusinessJourneys(
  pages: CrawlPage[],
  elements: AgentInteractiveElement[],
): ApplicationAiProfileOutput["businessJourneys"] {
  const eventNames = new Set(elements.map((element) => element.suggestedTrackEvent));
  const pagePaths = pages.map((page) => page.path);
  const journeys: ApplicationAiProfileOutput["businessJourneys"] = [];

  if (eventNames.has("product_add_to_cart") || eventNames.has("checkout_clicked")) {
    journeys.push({
      key: "shopping_checkout",
      name: "商品购买旅程",
      goal: "用户从商品浏览进入购物车，并最终发起结算。",
      entryPages: pagePaths,
      keySteps: ["进入商品列表或商品详情", "选择目标商品", "加入购物车", "查看或调整购物车", "点击结算"],
      successSignals: ["checkout_clicked", "支付或结算成功页", "POST /checkout 或 /order 返回 2xx"],
      failureSignals: ["checkout_clicked 后出现 4xx/5xx 请求", "支付/结算错误 toast", "加入购物车后长时间无后续动作"],
      recommendedTrackEvents: ["product_add_to_cart", "cart_opened", "cart_item_quantity_changed", "checkout_clicked"],
    });
  }

  if (elements.some((element) => element.elementType === "form" || element.suggestedTrackEvent === "form_submit_clicked")) {
    journeys.push({
      key: "form_submission",
      name: "表单提交旅程",
      goal: "用户完成表单填写并提交核心业务信息。",
      entryPages: pagePaths,
      keySteps: ["进入表单页", "填写关键字段", "点击提交", "等待提交结果", "看到成功反馈"],
      successSignals: ["form_submit_clicked", "成功 toast 或成功页", "POST 表单接口返回 2xx"],
      failureSignals: ["必填字段校验失败", "提交接口返回 4xx/5xx", "提交后无反馈或重复点击"],
      recommendedTrackEvents: ["form_started", "form_submit_clicked", "form_submit_succeeded", "form_submit_failed"],
    });
  }

  if (!journeys.length) {
    journeys.push({
      key: "content_to_action",
      name: "内容浏览到关键动作旅程",
      goal: "用户理解页面内容并点击关键行动入口。",
      entryPages: pagePaths,
      keySteps: ["进入页面", "浏览主要内容区", "查看关键交互入口", "点击主要 CTA"],
      successSignals: ["点击主要 CTA", "进入下一步页面", "关键请求返回 2xx"],
      failureSignals: ["仅浏览退出", "关键 CTA 点击后无反馈", "关键请求失败"],
      recommendedTrackEvents: elements.slice(0, 4).map((element) => element.suggestedTrackEvent),
    });
  }

  return journeys;
}

function buildSignals(journeys: ApplicationAiProfileOutput["businessJourneys"]) {
  const successSignals = uniqueBy(
    journeys.flatMap((journey) =>
      journey.successSignals.map((signal, index) => ({
        key: `${journey.key}_success_${index + 1}`,
        label: signal,
        ruleType: signal.includes("POST") || signal.includes("GET") ? ("request" as const) : signal.includes("页") ? ("page" as const) : ("event" as const),
        rule: signal,
        confidence: 0.72,
      })),
    ),
    (signal) => signal.label,
  );

  const failureSignals = uniqueBy(
    journeys.flatMap((journey) =>
      journey.failureSignals.map((signal, index) => ({
        key: `${journey.key}_failure_${index + 1}`,
        label: signal,
        ruleType: signal.includes("4xx") || signal.includes("5xx") || signal.includes("接口") ? ("request" as const) : signal.includes("toast") ? ("ui" as const) : ("event" as const),
        rule: signal,
        severity: signal.includes("4xx") || signal.includes("5xx") ? ("critical" as const) : ("warning" as const),
        confidence: 0.68,
      })),
    ),
    (signal) => signal.label,
  );

  return { successSignals, failureSignals };
}

function buildSdkRecommendations(elements: AgentInteractiveElement[]) {
  return uniqueBy(elements, (element) => element.suggestedTrackEvent)
    .slice(0, 16)
    .map((element) => ({
      eventName: element.suggestedTrackEvent,
      trigger: `用户触发“${element.label}”`,
      regionKey: element.regionKey,
      businessMeaning: element.businessMeaning,
      suggestedPayload: element.suggestedPayload,
      suggestedDataAttributes: {
        "data-ur-region": element.regionKey,
        "data-ur-action": element.suggestedTrackEvent,
        "data-ur-business-action": element.businessMeaning,
      },
      priority: /checkout|submit|add_to_cart|login|signup/.test(element.suggestedTrackEvent) ? ("high" as const) : ("medium" as const),
    }));
}

export async function crawlApplicationSnapshot(input: ApplicationAiProfileInput): Promise<Agent1CrawlSnapshot> {
  const startUrl = normalizeWebsiteUrl(input.websiteUrl);
  const { pages, skippedUrls } = await crawlApplication(startUrl);

  return {
    sourceUrl: input.websiteUrl,
    normalizedUrl: startUrl.href,
    crawledAt: new Date().toISOString(),
    crawledPageCount: pages.length,
    pages,
    skippedUrls,
    version: agentVersion,
  };
}

export function buildHeuristicApplicationAiProfile(
  input: ApplicationAiProfileInput,
  snapshot: Agent1CrawlSnapshot,
): ApplicationAiProfileOutput {
  const pages = snapshot.pages;
  const appSummaryBase = inferAppSummary(pages, input.businessHint);
  const interactiveElements = uniqueBy(
    pages.flatMap((page) => page.interactiveElements),
    (element) => `${element.pageUrl}:${element.suggestedTrackEvent}:${element.label}`,
  ).slice(0, 80);
  const regions = buildRegions(pages);
  const pageMap = pages.map((page) => ({
    url: page.url,
    path: page.path,
    title: page.title,
    purpose: buildPagePurpose(page),
    keyRegions: page.sections.slice(0, 6).map((section) => section.regionKey),
    keyInteractions: page.interactiveElements.slice(0, 8).map((element) => element.suggestedTrackEvent),
  }));
  const businessJourneys = buildBusinessJourneys(pages, interactiveElements);
  const { successSignals, failureSignals } = buildSignals(businessJourneys);
  const sdkRecommendations = buildSdkRecommendations(interactiveElements);

  return {
    appSummary: {
      ...appSummaryBase,
      evidence: pages.flatMap((page) => [page.title, ...page.headings.slice(0, 3)]).filter(Boolean).slice(0, 10),
    },
    pageMap,
    regions,
    interactiveElements,
    businessJourneys,
    successSignals,
    failureSignals,
    sdkRecommendations,
    confidenceNotes: [
      {
        topic: "抓取范围",
        note: `第一版最多抓取 ${maxPages} 个同源页面，本次抓取 ${pages.length} 个页面。动态渲染内容可能需要目标站点服务端 HTML 支持。`,
        confidence: pages.length > 1 ? 0.72 : 0.55,
      },
      {
        topic: "region 识别",
        note: "优先读取语义标签和 DOM 属性，其次基于文本和交互元素启发式推断。建议业务侧补充 data-ur-region 提升准确率。",
        confidence: regions.some((region) => region.confidence >= 0.8) ? 0.72 : 0.58,
      },
      {
        topic: "埋点建议",
        note: "建议结果用于 SDK track 与 data-ur-* 标记设计，不会自动修改目标应用代码。",
        confidence: sdkRecommendations.length ? 0.76 : 0.5,
      },
    ],
    crawlMetadata: {
      sourceUrl: input.websiteUrl,
      normalizedUrl: snapshot.normalizedUrl,
      crawledAt: snapshot.crawledAt,
      crawledPageCount: snapshot.crawledPageCount,
      skippedUrls: snapshot.skippedUrls,
      version: agentVersion,
    },
  };
}

export async function generateApplicationAiProfile(input: ApplicationAiProfileInput): Promise<ApplicationAiProfileOutput> {
  const snapshot = await crawlApplicationSnapshot(input);
  return buildHeuristicApplicationAiProfile(input, snapshot);
}

export function toApplicationAiProfileCreateData(
  input: ApplicationAiProfileInput,
  profile: ApplicationAiProfileOutput,
  options: ApplicationAiProfileCreateOptions = {},
): Prisma.ApplicationAiProfileCreateInput {
  return {
    tenant: { connect: { id: input.tenantId } },
    application: { connect: { id: input.applicationId } },
    sourceUrl: profile.crawlMetadata.normalizedUrl,
    businessHint: input.businessHint?.trim() || null,
    appPurpose: profile.appSummary.purpose,
    appSummary: `${profile.appSummary.purpose} ${profile.appSummary.valueProposition}`,
    pageMapJson: profile.pageMap as unknown as Prisma.InputJsonValue,
    regionsJson: profile.regions as unknown as Prisma.InputJsonValue,
    interactiveElementsJson: profile.interactiveElements as unknown as Prisma.InputJsonValue,
    journeysJson: profile.businessJourneys as unknown as Prisma.InputJsonValue,
    successRulesJson: profile.successSignals as unknown as Prisma.InputJsonValue,
    failureRulesJson: profile.failureSignals as unknown as Prisma.InputJsonValue,
    sdkRecommendationsJson: profile.sdkRecommendations as unknown as Prisma.InputJsonValue,
    confidenceNotesJson: profile.confidenceNotes as unknown as Prisma.InputJsonValue,
    crawlMetadataJson: profile.crawlMetadata as unknown as Prisma.InputJsonValue,
    ...(options.inputSnapshot ? { inputSnapshotJson: options.inputSnapshot as unknown as Prisma.InputJsonValue } : {}),
    ...(options.modelOutput ? { modelOutputJson: options.modelOutput as Prisma.InputJsonValue } : {}),
    ...(options.modelMetadata ? { modelMetadataJson: options.modelMetadata as Prisma.InputJsonValue } : {}),
    provider: options.provider ?? null,
    model: options.model ?? null,
    promptVersion: options.promptVersion ?? null,
    generationMode: options.generationMode ?? "heuristic",
    fallbackUsed: options.fallbackUsed ?? false,
    version: agentVersion,
    generatedAt: new Date(profile.crawlMetadata.crawledAt),
  };
}
