export type CollectorEventType =
  | "page_view"
  | "ui_click"
  | "form_submit"
  | "network_request"
  | "ui_error";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JourneyCollectorConfig = {
  appKey: string;
  ingestToken?: string;
  token?: string;
  endpoint: string;
  host?: string;
  debug?: boolean;
  autoStart?: boolean;
  autoTrackPageView?: boolean;
  autoTrackRouteChange?: boolean;
  autoTrackClick?: boolean;
  autoTrackFormSubmit?: boolean;
  autoTrackNetwork?: boolean;
  autoTrackErrors?: boolean;
  batchSize?: number;
  flushIntervalMs?: number;
  sessionTimeoutMs?: number;
  anonymousIdStorageKey?: string;
  sessionStorageKey?: string;
  redactKeys?: string[];
  context?: Record<string, unknown>;
};

export type IdentifyTraits = Record<string, unknown>;
export type TrackPayload = Record<string, unknown>;

export type CollectorSemantic = {
  region?: string;
  regionSource?: string;
  regionConfidence?: number;
  action?: string;
  actionType?: string;
  businessAction?: string;
  businessIntent?: string;
  targetLabel?: string;
  payload?: JsonValue;
  aiRegionStatus?: "PENDING" | "RESOLVED" | "IGNORED";
  aiRegionCandidate?: JsonValue;
  aiRegionReason?: string;
};

export type BrowserCollectorEvent = {
  eventId: string;
  sessionId: string;
  userId?: string;
  anonymousId: string;
  eventType: CollectorEventType;
  timestamp: string;
  page?: {
    url?: string;
    host?: string;
    path?: string;
    title?: string;
    referrer?: string;
    template?: string;
  };
  semantic?: CollectorSemantic;
  target?: {
    label?: string;
    text?: string;
    selector?: string;
    role?: string;
    tagName?: string;
    testId?: string;
    data?: JsonValue;
    rect?: JsonValue;
  };
  viewport?: JsonValue;
  scroll?: JsonValue;
  interaction?: JsonValue;
  request?: {
    url?: string;
    host?: string;
    method?: string;
    statusCode?: number;
    durationMs?: number;
    requestId?: string;
  };
  context?: Record<string, unknown>;
};

export type JourneyCollector = {
  start: () => void;
  stop: () => void;
  identify: (userId: string, traits?: IdentifyTraits) => void;
  track: (eventName: string, payload?: TrackPayload) => void;
  flush: () => Promise<void>;
  reset: () => void;
  getSessionId: () => string;
  getAnonymousId: () => string;
};

type InternalConfig = Required<
  Pick<
    JourneyCollectorConfig,
    | "autoStart"
    | "autoTrackPageView"
    | "autoTrackRouteChange"
    | "autoTrackClick"
    | "autoTrackFormSubmit"
    | "autoTrackNetwork"
    | "autoTrackErrors"
    | "batchSize"
    | "flushIntervalMs"
    | "sessionTimeoutMs"
    | "anonymousIdStorageKey"
    | "sessionStorageKey"
  >
> &
  JourneyCollectorConfig & {
    token: string;
    redactKeys: string[];
  };

type HistoryMethod = "pushState" | "replaceState";

const defaultRedactKeys = [
  "password",
  "passwd",
  "pwd",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "auth",
  "secret",
  "client_secret",
  "ingestToken",
  "ingest_token",
  "cookie",
  "set-cookie",
];

const sessionCreatedAtKeySuffix = ":createdAt";
const maxStringLength = 1000;
const maxClickTextLength = 120;
const maxRedactDepth = 8;

let defaultCollector: JourneyCollector | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function createId(prefix: string) {
  const cryptoApi = isBrowser() ? window.crypto : undefined;

  if (cryptoApi?.randomUUID) {
    return `${prefix}_${cryptoApi.randomUUID().replace(/-/g, "")}`;
  }

  const random = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeConfig(config: JourneyCollectorConfig): InternalConfig {
  const token = config.ingestToken ?? config.token;

  if (!config.appKey) {
    throw new Error("[UserReplayCollector] appKey is required.");
  }
  if (!token) {
    throw new Error("[UserReplayCollector] ingestToken or token is required.");
  }
  if (!config.endpoint) {
    throw new Error("[UserReplayCollector] endpoint is required.");
  }

  return {
    ...config,
    token,
    autoStart: config.autoStart ?? true,
    autoTrackPageView: config.autoTrackPageView ?? true,
    autoTrackRouteChange: config.autoTrackRouteChange ?? true,
    autoTrackClick: config.autoTrackClick ?? true,
    autoTrackFormSubmit: config.autoTrackFormSubmit ?? true,
    autoTrackNetwork: config.autoTrackNetwork ?? true,
    autoTrackErrors: config.autoTrackErrors ?? true,
    batchSize: Math.max(1, Math.min(config.batchSize ?? 20, 100)),
    flushIntervalMs: Math.max(1000, config.flushIntervalMs ?? 5000),
    sessionTimeoutMs: Math.max(60_000, config.sessionTimeoutMs ?? 30 * 60 * 1000),
    anonymousIdStorageKey: config.anonymousIdStorageKey ?? "user_replay_anonymous_id",
    sessionStorageKey: config.sessionStorageKey ?? "user_replay_session_id",
    redactKeys: [...defaultRedactKeys, ...(config.redactKeys ?? [])],
  };
}

function safeGetStorage(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore storage failures in blocked-cookie or private browsing modes.
  }
}

function safeRemoveStorage(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage failures in blocked-cookie or private browsing modes.
  }
}

function getOrCreateAnonymousId(config: InternalConfig) {
  const storage = isBrowser() ? window.localStorage : undefined;
  const existing = safeGetStorage(storage, config.anonymousIdStorageKey);

  if (existing) {
    return existing;
  }

  const anonymousId = createId("anon");
  safeSetStorage(storage, config.anonymousIdStorageKey, anonymousId);
  return anonymousId;
}

function getOrCreateSessionId(config: InternalConfig) {
  const storage = isBrowser() ? window.sessionStorage : undefined;
  const createdAtKey = `${config.sessionStorageKey}${sessionCreatedAtKeySuffix}`;
  const existing = safeGetStorage(storage, config.sessionStorageKey);
  const createdAt = Number(safeGetStorage(storage, createdAtKey));
  const isExpired = !createdAt || Date.now() - createdAt > config.sessionTimeoutMs;

  if (existing && !isExpired) {
    return existing;
  }

  const sessionId = createId("sess");
  safeSetStorage(storage, config.sessionStorageKey, sessionId);
  safeSetStorage(storage, createdAtKey, String(Date.now()));
  return sessionId;
}

function getCurrentPage() {
  if (!isBrowser()) {
    return undefined;
  }

  return {
    url: window.location.href,
    host: window.location.hostname,
    path: `${window.location.pathname}${window.location.search}`,
    template: document.body?.getAttribute("data-ur-page-template") || document.body?.getAttribute("data-replay-page-template") || undefined,
    title: document.title,
    referrer: document.referrer,
  };
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value, isBrowser() ? window.location.href : undefined);
    return {
      url: url.href,
      host: url.hostname,
      path: `${url.pathname}${url.search}`,
    };
  } catch {
    return {
      url: value,
      host: undefined,
      path: undefined,
    };
  }
}

function isRedactedKey(key: string, redactKeys: string[]) {
  const normalizedKey = key.toLowerCase();
  return redactKeys.some((redactKey) => normalizedKey === redactKey.toLowerCase());
}

function sanitizeString(value: string) {
  return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
}

function sanitizeValue(value: unknown, redactKeys: string[], depth = 0): JsonValue {
  if (depth > maxRedactDepth) {
    return "[MaxDepth]";
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : null,
    };
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, redactKeys, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      result[key] = isRedactedKey(key, redactKeys) ? "[REDACTED]" : sanitizeValue(item, redactKeys, depth + 1);
    }
    return result;
  }

  return String(value);
}

function getViewport() {
  if (!isBrowser()) {
    return undefined;
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };
}

function getScrollPosition() {
  if (!isBrowser()) {
    return undefined;
  }

  return {
    x: Math.round(window.scrollX),
    y: Math.round(window.scrollY),
  };
}

function getElementSelector(element: Element | null) {
  if (!element) {
    return undefined;
  }
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && parts.length < 5) {
    const tagName = current.tagName.toLowerCase();
    const testId = current.getAttribute("data-testid") || current.getAttribute("data-test-id");
    if (testId) {
      parts.unshift(`${tagName}[data-testid="${testId.replace(/"/g, '\\"')}"]`);
      break;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (!parent) {
      parts.unshift(tagName);
      break;
    }

    const currentTagName = current.tagName;
    const siblings = Array.from(parent.children).filter((item: Element) => item.tagName === currentTagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName);
    current = parent;
  }

  return parts.join(" > ") || undefined;
}

function getElementRect(element: Element | null) {
  if (!element) {
    return undefined;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function readTrackingData(element: Element | null) {
  if (!element) {
    return {};
  }

  const htmlElement = element as HTMLElement;
  const result: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(htmlElement.dataset)) {
    if (key.startsWith("ur") || key.startsWith("replay")) {
      result[key] = value ?? "";
    }
  }

  return result;
}

function readAttribute(element: Element | null, names: string[]) {
  for (const name of names) {
    const value = element?.getAttribute(name);
    if (value?.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function closestByAttributes(element: Element | null, attributes: string[]) {
  if (!element) {
    return null;
  }

  return element.closest(attributes.map((attribute) => `[${attribute}]`).join(","));
}

function getSemanticFromElement(element: Element | null, redactKeys: string[]) {
  const regionElement = closestByAttributes(element, ["data-ur-region", "data-replay-region"]);
  const actionElement = closestByAttributes(element, ["data-ur-action", "data-replay-action"]) ?? element;
  const region = readAttribute(regionElement, ["data-ur-region", "data-replay-region"]);
  const action = readAttribute(actionElement, ["data-ur-action", "data-replay-action"]);
  const businessAction = readAttribute(actionElement, ["data-ur-business-action", "data-replay-business-action"]);
  const businessIntent = readAttribute(actionElement, ["data-ur-business-intent", "data-replay-business-intent"]);
  const targetLabel = readAttribute(actionElement, ["data-ur-label", "aria-label", "title"]);

  const semantic: CollectorSemantic = {
    region,
    regionSource: region ? "data_attribute" : undefined,
    regionConfidence: region ? 1 : undefined,
    action,
    actionType: action ? "dom_action" : undefined,
    businessAction,
    businessIntent,
    targetLabel,
    aiRegionStatus: region ? "RESOLVED" : "PENDING",
    payload: sanitizeValue(
      {
        regionData: readTrackingData(regionElement),
        actionData: readTrackingData(actionElement),
      },
      redactKeys,
    ),
  };

  return semantic;
}

function getElementDescriptor(element: Element | null) {
  if (!element) {
    return {};
  }

  const htmlElement = element as HTMLElement;
  const text = (htmlElement.innerText || htmlElement.textContent || "").replace(/\s+/g, " ").trim();

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: typeof htmlElement.className === "string" ? htmlElement.className.slice(0, 200) || undefined : undefined,
    name: htmlElement.getAttribute("name") || undefined,
    role: htmlElement.getAttribute("role") || undefined,
    ariaLabel: htmlElement.getAttribute("aria-label") || undefined,
    selector: getElementSelector(element),
    testId: htmlElement.getAttribute("data-testid") || htmlElement.getAttribute("data-test-id") || undefined,
    data: readTrackingData(element),
    rect: getElementRect(element),
    text: text ? text.slice(0, maxClickTextLength) : undefined,
    href: element instanceof HTMLAnchorElement ? element.href : undefined,
    type: htmlElement.getAttribute("type") || undefined,
  };
}

function getFormDescriptor(form: HTMLFormElement) {
  const fields = Array.from(form.elements)
    .filter((field): field is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
      return field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement;
    })
    .slice(0, 50)
    .map((field) => ({
      name: field.name || undefined,
      id: field.id || undefined,
      tagName: field.tagName.toLowerCase(),
      type: field instanceof HTMLInputElement ? field.type : undefined,
      required: field.required || undefined,
    }));

  return {
    id: form.id || undefined,
    name: form.getAttribute("name") || undefined,
    action: form.action || undefined,
    method: (form.method || "get").toUpperCase(),
    fields,
  };
}

function createNoopCollector(): JourneyCollector {
  return {
    start: () => undefined,
    stop: () => undefined,
    identify: () => undefined,
    track: () => undefined,
    flush: async () => undefined,
    reset: () => undefined,
    getSessionId: () => "",
    getAnonymousId: () => "",
  };
}

class BrowserJourneyCollector implements JourneyCollector {
  private readonly config: InternalConfig;
  private readonly queue: BrowserCollectorEvent[] = [];
  private readonly cleanupTasks: Array<() => void> = [];
  private anonymousId: string;
  private sessionId: string;
  private userId?: string;
  private userTraits?: IdentifyTraits;
  private started = false;
  private flushTimer: number | undefined;
  private originalFetch?: typeof window.fetch;
  private originalXhrOpen?: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend?: typeof XMLHttpRequest.prototype.send;
  private lastPageUrl = "";

  constructor(config: InternalConfig) {
    this.config = config;
    this.anonymousId = getOrCreateAnonymousId(config);
    this.sessionId = getOrCreateSessionId(config);
  }

  start() {
    if (this.started || !isBrowser()) {
      return;
    }

    this.started = true;
    this.lastPageUrl = window.location.href;

    if (this.config.autoTrackPageView) {
      this.capture("page_view", {
        context: {
          reason: "initial_load",
        },
      });
    }
    if (this.config.autoTrackRouteChange) {
      this.installRouteTracking();
    }
    if (this.config.autoTrackClick) {
      this.installClickTracking();
    }
    if (this.config.autoTrackFormSubmit) {
      this.installFormTracking();
    }
    if (this.config.autoTrackNetwork) {
      this.installNetworkTracking();
    }
    if (this.config.autoTrackErrors) {
      this.installErrorTracking();
    }

    this.flushTimer = window.setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);

    const handlePageHide = () => {
      this.flushWithBeacon();
    };
    window.addEventListener("pagehide", handlePageHide);
    this.cleanupTasks.push(() => window.removeEventListener("pagehide", handlePageHide));
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.started = false;
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    while (this.cleanupTasks.length) {
      this.cleanupTasks.pop()?.();
    }
    this.restoreNetworkTracking();
  }

  identify(userId: string, traits: IdentifyTraits = {}) {
    this.userId = userId;
    this.userTraits = traits;
    this.capture("ui_click", {
      semantic: {
        action: "identify",
        actionType: "manual_track",
        businessAction: "identify",
        aiRegionStatus: "IGNORED",
        payload: sanitizeValue(traits, this.config.redactKeys),
      },
      context: {
        manual: true,
        eventName: "identify",
        traits: sanitizeValue(traits, this.config.redactKeys),
      },
    });
  }

  track(eventName: string, payload: TrackPayload = {}) {
    this.capture("ui_click", {
      semantic: {
        action: eventName,
        actionType: "manual_track",
        businessAction: eventName,
        payload: sanitizeValue(payload, this.config.redactKeys),
        aiRegionStatus: "PENDING",
      },
      context: {
        manual: true,
        eventName,
        payload: sanitizeValue(payload, this.config.redactKeys),
      },
    });
  }

  async flush() {
    if (!this.queue.length) {
      return;
    }

    const events = this.queue.splice(0, this.config.batchSize);

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-key": this.config.appKey,
          "x-ingest-token": this.config.token,
        },
        body: JSON.stringify({
          appKey: this.config.appKey,
          token: this.config.token,
          events,
        }),
        keepalive: events.length <= 10,
      });

      if (!response.ok) {
        this.queue.unshift(...events);
        this.log("warn", "flush failed", response.status);
      }
    } catch (error) {
      this.queue.unshift(...events);
      this.log("warn", "flush error", error);
    }
  }

  reset() {
    this.stop();
    safeRemoveStorage(isBrowser() ? window.localStorage : undefined, this.config.anonymousIdStorageKey);
    safeRemoveStorage(isBrowser() ? window.sessionStorage : undefined, this.config.sessionStorageKey);
    safeRemoveStorage(
      isBrowser() ? window.sessionStorage : undefined,
      `${this.config.sessionStorageKey}${sessionCreatedAtKeySuffix}`,
    );
    this.anonymousId = getOrCreateAnonymousId(this.config);
    this.sessionId = getOrCreateSessionId(this.config);
    this.userId = undefined;
    this.userTraits = undefined;
    this.queue.length = 0;
    if (this.config.autoStart) {
      this.start();
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  getAnonymousId() {
    return this.anonymousId;
  }

  private capture(
    eventType: CollectorEventType,
    options: {
      page?: BrowserCollectorEvent["page"];
      semantic?: BrowserCollectorEvent["semantic"];
      target?: BrowserCollectorEvent["target"];
      viewport?: BrowserCollectorEvent["viewport"];
      scroll?: BrowserCollectorEvent["scroll"];
      interaction?: BrowserCollectorEvent["interaction"];
      request?: BrowserCollectorEvent["request"];
      context?: Record<string, unknown>;
      timestamp?: string;
    } = {},
  ) {
    if (!isBrowser()) {
      return;
    }

    const event: BrowserCollectorEvent = {
      eventId: createId("evt"),
      sessionId: this.sessionId,
      anonymousId: this.anonymousId,
      userId: this.userId,
      eventType,
      timestamp: options.timestamp ?? nowIso(),
      page: options.page ?? getCurrentPage(),
      semantic: options.semantic,
      target: options.target,
      viewport: options.viewport ?? getViewport(),
      scroll: options.scroll ?? getScrollPosition(),
      interaction: options.interaction,
      request: options.request,
      context: {
        ...this.config.context,
        userTraits: this.userTraits ? sanitizeValue(this.userTraits, this.config.redactKeys) : undefined,
        ...options.context,
      },
    };

    this.queue.push(event);
    if (this.queue.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  private installRouteTracking() {
    const trackIfChanged = (reason: string) => {
      window.setTimeout(() => {
        if (window.location.href === this.lastPageUrl) {
          return;
        }
        this.lastPageUrl = window.location.href;
        this.capture("page_view", {
          context: {
            reason,
          },
        });
      }, 0);
    };

    const patchHistory = (method: HistoryMethod) => {
      const original = window.history[method];
      window.history[method] = function patchedHistoryMethod(this: History, ...args: Parameters<History[HistoryMethod]>) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event(`user-replay:${method}`));
        return result;
      };
      this.cleanupTasks.push(() => {
        window.history[method] = original;
      });
    };

    patchHistory("pushState");
    patchHistory("replaceState");

    const onPushState = () => trackIfChanged("pushState");
    const onReplaceState = () => trackIfChanged("replaceState");
    const onPopState = () => trackIfChanged("popstate");

    window.addEventListener("user-replay:pushState", onPushState);
    window.addEventListener("user-replay:replaceState", onReplaceState);
    window.addEventListener("popstate", onPopState);
    this.cleanupTasks.push(() => window.removeEventListener("user-replay:pushState", onPushState));
    this.cleanupTasks.push(() => window.removeEventListener("user-replay:replaceState", onReplaceState));
    this.cleanupTasks.push(() => window.removeEventListener("popstate", onPopState));
  }

  private installClickTracking() {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a,button,input,select,textarea,[role='button'],[data-track]") : null;
      if (!target) {
        return;
      }

      this.capture("ui_click", {
        semantic: getSemanticFromElement(target, this.config.redactKeys),
        target: sanitizeValue(getElementDescriptor(target), this.config.redactKeys) as BrowserCollectorEvent["target"],
        interaction: {
          pointer: {
            x: event.clientX,
            y: event.clientY,
          },
        },
        context: {
          target: sanitizeValue(getElementDescriptor(target), this.config.redactKeys),
          pointer: {
            x: event.clientX,
            y: event.clientY,
          },
        },
      });
    };

    document.addEventListener("click", onClick, true);
    this.cleanupTasks.push(() => document.removeEventListener("click", onClick, true));
  }

  private installFormTracking() {
    const onSubmit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) {
        return;
      }

      this.capture("form_submit", {
        semantic: {
          ...getSemanticFromElement(event.target, this.config.redactKeys),
          action: readAttribute(event.target, ["data-ur-action", "data-replay-action"]) ?? "form_submit",
          actionType: "form_submit",
          businessAction: readAttribute(event.target, ["data-ur-business-action", "data-replay-business-action"]) ?? "form_submit",
        },
        target: sanitizeValue(getElementDescriptor(event.target), this.config.redactKeys) as BrowserCollectorEvent["target"],
        context: {
          form: sanitizeValue(getFormDescriptor(event.target), this.config.redactKeys),
        },
      });
    };

    document.addEventListener("submit", onSubmit, true);
    this.cleanupTasks.push(() => document.removeEventListener("submit", onSubmit, true));
  }

  private installNetworkTracking() {
    this.installFetchTracking();
    this.installXhrTracking();
  }

  private installFetchTracking() {
    if (!window.fetch || this.originalFetch) {
      return;
    }

    this.originalFetch = window.fetch.bind(window);
    const collector = this;

    window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const startedAt = performance.now();
      const request = collector.readFetchRequest(input, init);
      const shouldSkip = collector.shouldSkipNetworkUrl(request.url);

      try {
        const response = await collector.originalFetch!(input as RequestInfo, init);
        if (!shouldSkip) {
          collector.capture("network_request", {
            request: {
              ...request,
              statusCode: response.status,
              durationMs: Math.round(performance.now() - startedAt),
            },
            context: {
              transport: "fetch",
              ok: response.ok,
            },
          });
        }
        return response;
      } catch (error) {
        if (!shouldSkip) {
          collector.capture("network_request", {
            request: {
              ...request,
              durationMs: Math.round(performance.now() - startedAt),
            },
            context: {
              transport: "fetch",
              error: sanitizeValue(error, collector.config.redactKeys),
            },
          });
        }
        throw error;
      }
    };
  }

  private shouldSkipNetworkUrl(url: string) {
    try {
      return new URL(url, window.location.href).href === new URL(this.config.endpoint, window.location.href).href;
    } catch {
      return url === this.config.endpoint;
    }
  }

  private readFetchRequest(input: RequestInfo | URL, init?: RequestInit) {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const normalized = normalizeUrl(rawUrl);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    return {
      url: normalized.url,
      host: normalized.host,
      method: method.toUpperCase(),
    };
  }

  private installXhrTracking() {
    if (this.originalXhrOpen || this.originalXhrSend) {
      return;
    }

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const collector = this;

    XMLHttpRequest.prototype.open = function patchedXhrOpen(
      this: XMLHttpRequest & { __userReplayRequest?: { method: string; url: string; startedAt?: number } },
      method: string,
      url: string | URL,
      ...args: unknown[]
    ) {
      this.__userReplayRequest = {
        method: method.toUpperCase(),
        url: String(url),
      };
      const open = collector.originalXhrOpen as unknown as (this: XMLHttpRequest, ...openArgs: unknown[]) => void;
      return open.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function patchedXhrSend(
      this: XMLHttpRequest & { __userReplayRequest?: { method: string; url: string; startedAt?: number } },
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      if (this.__userReplayRequest) {
        this.__userReplayRequest.startedAt = performance.now();
      }

      const onLoadEnd = () => {
        const request = this.__userReplayRequest;
        if (!request) {
          return;
        }
        const normalized = normalizeUrl(request.url);
        collector.capture("network_request", {
          request: {
            url: normalized.url,
            host: normalized.host,
            method: request.method,
            statusCode: this.status || undefined,
            durationMs: request.startedAt ? Math.round(performance.now() - request.startedAt) : undefined,
          },
          context: {
            transport: "xhr",
          },
        });
      };

      this.addEventListener("loadend", onLoadEnd, { once: true });
      return collector.originalXhrSend!.call(this, body);
    };
  }

  private restoreNetworkTracking() {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = undefined;
    }
    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = undefined;
    }
    if (this.originalXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrSend = undefined;
    }
  }

  private installErrorTracking() {
    const onError = (event: ErrorEvent) => {
      this.capture("ui_error", {
        context: {
          source: "window.error",
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: sanitizeValue(event.error, this.config.redactKeys),
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      this.capture("ui_error", {
        context: {
          source: "unhandledrejection",
          reason: sanitizeValue(event.reason, this.config.redactKeys),
        },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    this.cleanupTasks.push(() => window.removeEventListener("error", onError));
    this.cleanupTasks.push(() => window.removeEventListener("unhandledrejection", onUnhandledRejection));
  }

  private flushWithBeacon() {
    if (!this.queue.length || !navigator.sendBeacon) {
      return;
    }

    const events = this.queue.splice(0, this.config.batchSize);
    const blob = new Blob(
      [
        JSON.stringify({
          appKey: this.config.appKey,
          token: this.config.token,
          events,
        }),
      ],
      {
        type: "application/json",
      },
    );

    const sent = navigator.sendBeacon(this.config.endpoint, blob);
    if (!sent) {
      this.queue.unshift(...events);
    }
  }

  private log(level: "debug" | "warn", ...args: unknown[]) {
    if (!this.config.debug) {
      return;
    }
    const logger = level === "warn" ? console.warn : console.debug;
    logger("[UserReplayCollector]", ...args);
  }
}

export function createJourneyCollector(config: JourneyCollectorConfig): JourneyCollector {
  if (!isBrowser()) {
    return createNoopCollector();
  }

  const normalizedConfig = normalizeConfig(config);
  const collector = new BrowserJourneyCollector(normalizedConfig);
  if (normalizedConfig.autoStart) {
    collector.start();
  }
  return collector;
}

export const createCollector = createJourneyCollector;

export function init(config: JourneyCollectorConfig): JourneyCollector {
  defaultCollector = createJourneyCollector(config);
  return defaultCollector;
}

export function identify(userId: string, traits?: IdentifyTraits) {
  defaultCollector?.identify(userId, traits);
}

export function track(eventName: string, payload?: TrackPayload) {
  defaultCollector?.track(eventName, payload);
}

export function flush() {
  return defaultCollector?.flush() ?? Promise.resolve();
}

export function reset() {
  defaultCollector?.reset();
}

declare global {
  interface Window {
    UserReplayCollector?: {
      createJourneyCollector: typeof createJourneyCollector;
      createCollector: typeof createCollector;
      init: typeof init;
      identify: typeof identify;
      track: typeof track;
      flush: typeof flush;
      reset: typeof reset;
    };
  }
}

if (isBrowser()) {
  window.UserReplayCollector = {
    createJourneyCollector,
    createCollector,
    init,
    identify,
    track,
    flush,
    reset,
  };
}
