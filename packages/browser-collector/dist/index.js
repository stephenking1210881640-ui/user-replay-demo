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
let defaultCollector = null;
function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}
function createId(prefix) {
    const cryptoApi = isBrowser() ? window.crypto : undefined;
    if (cryptoApi === null || cryptoApi === void 0 ? void 0 : cryptoApi.randomUUID) {
        return `${prefix}_${cryptoApi.randomUUID().replace(/-/g, "")}`;
    }
    const random = Math.random().toString(36).slice(2);
    const time = Date.now().toString(36);
    return `${prefix}_${time}${random}`;
}
function nowIso() {
    return new Date().toISOString();
}
function normalizeConfig(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const token = (_a = config.ingestToken) !== null && _a !== void 0 ? _a : config.token;
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
        autoStart: (_b = config.autoStart) !== null && _b !== void 0 ? _b : true,
        autoTrackPageView: (_c = config.autoTrackPageView) !== null && _c !== void 0 ? _c : true,
        autoTrackRouteChange: (_d = config.autoTrackRouteChange) !== null && _d !== void 0 ? _d : true,
        autoTrackClick: (_e = config.autoTrackClick) !== null && _e !== void 0 ? _e : true,
        autoTrackFormSubmit: (_f = config.autoTrackFormSubmit) !== null && _f !== void 0 ? _f : true,
        autoTrackNetwork: (_g = config.autoTrackNetwork) !== null && _g !== void 0 ? _g : true,
        autoTrackErrors: (_h = config.autoTrackErrors) !== null && _h !== void 0 ? _h : true,
        batchSize: Math.max(1, Math.min((_j = config.batchSize) !== null && _j !== void 0 ? _j : 20, 100)),
        flushIntervalMs: Math.max(1000, (_k = config.flushIntervalMs) !== null && _k !== void 0 ? _k : 5000),
        sessionTimeoutMs: Math.max(60000, (_l = config.sessionTimeoutMs) !== null && _l !== void 0 ? _l : 30 * 60 * 1000),
        anonymousIdStorageKey: (_m = config.anonymousIdStorageKey) !== null && _m !== void 0 ? _m : "user_replay_anonymous_id",
        sessionStorageKey: (_o = config.sessionStorageKey) !== null && _o !== void 0 ? _o : "user_replay_session_id",
        redactKeys: [...defaultRedactKeys, ...((_p = config.redactKeys) !== null && _p !== void 0 ? _p : [])],
    };
}
function safeGetStorage(storage, key) {
    var _a;
    try {
        return (_a = storage === null || storage === void 0 ? void 0 : storage.getItem(key)) !== null && _a !== void 0 ? _a : null;
    }
    catch {
        return null;
    }
}
function safeSetStorage(storage, key, value) {
    try {
        storage === null || storage === void 0 ? void 0 : storage.setItem(key, value);
    }
    catch {
        // Ignore storage failures in blocked-cookie or private browsing modes.
    }
}
function safeRemoveStorage(storage, key) {
    try {
        storage === null || storage === void 0 ? void 0 : storage.removeItem(key);
    }
    catch {
        // Ignore storage failures in blocked-cookie or private browsing modes.
    }
}
function getOrCreateAnonymousId(config) {
    const storage = isBrowser() ? window.localStorage : undefined;
    const existing = safeGetStorage(storage, config.anonymousIdStorageKey);
    if (existing) {
        return existing;
    }
    const anonymousId = createId("anon");
    safeSetStorage(storage, config.anonymousIdStorageKey, anonymousId);
    return anonymousId;
}
function getOrCreateSessionId(config) {
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
    var _a, _b;
    if (!isBrowser()) {
        return undefined;
    }
    return {
        url: window.location.href,
        host: window.location.hostname,
        path: `${window.location.pathname}${window.location.search}`,
        template: ((_a = document.body) === null || _a === void 0 ? void 0 : _a.getAttribute("data-ur-page-template")) || ((_b = document.body) === null || _b === void 0 ? void 0 : _b.getAttribute("data-replay-page-template")) || undefined,
        title: document.title,
        referrer: document.referrer,
    };
}
function normalizeUrl(value) {
    try {
        const url = new URL(value, isBrowser() ? window.location.href : undefined);
        return {
            url: url.href,
            host: url.hostname,
            path: `${url.pathname}${url.search}`,
        };
    }
    catch {
        return {
            url: value,
            host: undefined,
            path: undefined,
        };
    }
}
function isRedactedKey(key, redactKeys) {
    const normalizedKey = key.toLowerCase();
    return redactKeys.some((redactKey) => normalizedKey === redactKey.toLowerCase());
}
function sanitizeString(value) {
    return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
}
function sanitizeValue(value, redactKeys, depth = 0) {
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
        const result = {};
        for (const [key, item] of Object.entries(value).slice(0, 80)) {
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
function getElementSelector(element) {
    if (!element) {
        return undefined;
    }
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }
    const parts = [];
    let current = element;
    while (current && current !== document.body && parts.length < 5) {
        const tagName = current.tagName.toLowerCase();
        const testId = current.getAttribute("data-testid") || current.getAttribute("data-test-id");
        if (testId) {
            parts.unshift(`${tagName}[data-testid="${testId.replace(/"/g, '\\"')}"]`);
            break;
        }
        const parent = current.parentElement;
        if (!parent) {
            parts.unshift(tagName);
            break;
        }
        const currentTagName = current.tagName;
        const siblings = Array.from(parent.children).filter((item) => item.tagName === currentTagName);
        const index = siblings.indexOf(current) + 1;
        parts.unshift(siblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName);
        current = parent;
    }
    return parts.join(" > ") || undefined;
}
function getElementRect(element) {
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
function readTrackingData(element) {
    if (!element) {
        return {};
    }
    const htmlElement = element;
    const result = {};
    for (const [key, value] of Object.entries(htmlElement.dataset)) {
        if (key.startsWith("ur") || key.startsWith("replay")) {
            result[key] = value !== null && value !== void 0 ? value : "";
        }
    }
    return result;
}
function readAttribute(element, names) {
    for (const name of names) {
        const value = element === null || element === void 0 ? void 0 : element.getAttribute(name);
        if (value === null || value === void 0 ? void 0 : value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}
function closestByAttributes(element, attributes) {
    if (!element) {
        return null;
    }
    return element.closest(attributes.map((attribute) => `[${attribute}]`).join(","));
}
function getSemanticFromElement(element, redactKeys) {
    var _a;
    const regionElement = closestByAttributes(element, ["data-ur-region", "data-replay-region"]);
    const actionElement = (_a = closestByAttributes(element, ["data-ur-action", "data-replay-action"])) !== null && _a !== void 0 ? _a : element;
    const region = readAttribute(regionElement, ["data-ur-region", "data-replay-region"]);
    const action = readAttribute(actionElement, ["data-ur-action", "data-replay-action"]);
    const businessAction = readAttribute(actionElement, ["data-ur-business-action", "data-replay-business-action"]);
    const businessIntent = readAttribute(actionElement, ["data-ur-business-intent", "data-replay-business-intent"]);
    const targetLabel = readAttribute(actionElement, ["data-ur-label", "aria-label", "title"]);
    const semantic = {
        region,
        regionSource: region ? "data_attribute" : undefined,
        regionConfidence: region ? 1 : undefined,
        action,
        actionType: action ? "dom_action" : undefined,
        businessAction,
        businessIntent,
        targetLabel,
        aiRegionStatus: region ? "RESOLVED" : "PENDING",
        payload: sanitizeValue({
            regionData: readTrackingData(regionElement),
            actionData: readTrackingData(actionElement),
        }, redactKeys),
    };
    return semantic;
}
function getElementDescriptor(element) {
    if (!element) {
        return {};
    }
    const htmlElement = element;
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
function getFormDescriptor(form) {
    const fields = Array.from(form.elements)
        .filter((field) => {
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
function createNoopCollector() {
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
class BrowserJourneyCollector {
    constructor(config) {
        this.queue = [];
        this.cleanupTasks = [];
        this.started = false;
        this.lastPageUrl = "";
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
        var _a;
        if (!this.started) {
            return;
        }
        this.started = false;
        if (this.flushTimer) {
            window.clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        while (this.cleanupTasks.length) {
            (_a = this.cleanupTasks.pop()) === null || _a === void 0 ? void 0 : _a();
        }
        this.restoreNetworkTracking();
    }
    identify(userId, traits = {}) {
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
    track(eventName, payload = {}) {
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
        }
        catch (error) {
            this.queue.unshift(...events);
            this.log("warn", "flush error", error);
        }
    }
    reset() {
        this.stop();
        safeRemoveStorage(isBrowser() ? window.localStorage : undefined, this.config.anonymousIdStorageKey);
        safeRemoveStorage(isBrowser() ? window.sessionStorage : undefined, this.config.sessionStorageKey);
        safeRemoveStorage(isBrowser() ? window.sessionStorage : undefined, `${this.config.sessionStorageKey}${sessionCreatedAtKeySuffix}`);
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
    capture(eventType, options = {}) {
        var _a, _b, _c, _d;
        if (!isBrowser()) {
            return;
        }
        const event = {
            eventId: createId("evt"),
            sessionId: this.sessionId,
            anonymousId: this.anonymousId,
            userId: this.userId,
            eventType,
            timestamp: (_a = options.timestamp) !== null && _a !== void 0 ? _a : nowIso(),
            page: (_b = options.page) !== null && _b !== void 0 ? _b : getCurrentPage(),
            semantic: options.semantic,
            target: options.target,
            viewport: (_c = options.viewport) !== null && _c !== void 0 ? _c : getViewport(),
            scroll: (_d = options.scroll) !== null && _d !== void 0 ? _d : getScrollPosition(),
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
    installRouteTracking() {
        const trackIfChanged = (reason) => {
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
        const patchHistory = (method) => {
            const original = window.history[method];
            window.history[method] = function patchedHistoryMethod(...args) {
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
    installClickTracking() {
        const onClick = (event) => {
            const target = event.target instanceof Element ? event.target.closest("a,button,input,select,textarea,[role='button'],[data-track]") : null;
            if (!target) {
                return;
            }
            this.capture("ui_click", {
                semantic: getSemanticFromElement(target, this.config.redactKeys),
                target: sanitizeValue(getElementDescriptor(target), this.config.redactKeys),
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
    installFormTracking() {
        const onSubmit = (event) => {
            var _a, _b;
            if (!(event.target instanceof HTMLFormElement)) {
                return;
            }
            this.capture("form_submit", {
                semantic: {
                    ...getSemanticFromElement(event.target, this.config.redactKeys),
                    action: (_a = readAttribute(event.target, ["data-ur-action", "data-replay-action"])) !== null && _a !== void 0 ? _a : "form_submit",
                    actionType: "form_submit",
                    businessAction: (_b = readAttribute(event.target, ["data-ur-business-action", "data-replay-business-action"])) !== null && _b !== void 0 ? _b : "form_submit",
                },
                target: sanitizeValue(getElementDescriptor(event.target), this.config.redactKeys),
                context: {
                    form: sanitizeValue(getFormDescriptor(event.target), this.config.redactKeys),
                },
            });
        };
        document.addEventListener("submit", onSubmit, true);
        this.cleanupTasks.push(() => document.removeEventListener("submit", onSubmit, true));
    }
    installNetworkTracking() {
        this.installFetchTracking();
        this.installXhrTracking();
    }
    installFetchTracking() {
        if (!window.fetch || this.originalFetch) {
            return;
        }
        this.originalFetch = window.fetch.bind(window);
        const collector = this;
        window.fetch = async function patchedFetch(input, init) {
            const startedAt = performance.now();
            const request = collector.readFetchRequest(input, init);
            const shouldSkip = collector.shouldSkipNetworkUrl(request.url);
            try {
                const response = await collector.originalFetch(input, init);
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
            }
            catch (error) {
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
    shouldSkipNetworkUrl(url) {
        try {
            return new URL(url, window.location.href).href === new URL(this.config.endpoint, window.location.href).href;
        }
        catch {
            return url === this.config.endpoint;
        }
    }
    readFetchRequest(input, init) {
        var _a;
        const rawUrl = input instanceof Request ? input.url : String(input);
        const normalized = normalizeUrl(rawUrl);
        const method = (_a = init === null || init === void 0 ? void 0 : init.method) !== null && _a !== void 0 ? _a : (input instanceof Request ? input.method : "GET");
        return {
            url: normalized.url,
            host: normalized.host,
            method: method.toUpperCase(),
        };
    }
    installXhrTracking() {
        if (this.originalXhrOpen || this.originalXhrSend) {
            return;
        }
        this.originalXhrOpen = XMLHttpRequest.prototype.open;
        this.originalXhrSend = XMLHttpRequest.prototype.send;
        const collector = this;
        XMLHttpRequest.prototype.open = function patchedXhrOpen(method, url, ...args) {
            this.__userReplayRequest = {
                method: method.toUpperCase(),
                url: String(url),
            };
            const open = collector.originalXhrOpen;
            return open.apply(this, [method, url, ...args]);
        };
        XMLHttpRequest.prototype.send = function patchedXhrSend(body) {
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
            return collector.originalXhrSend.call(this, body);
        };
    }
    restoreNetworkTracking() {
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
    installErrorTracking() {
        const onError = (event) => {
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
        const onUnhandledRejection = (event) => {
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
    flushWithBeacon() {
        if (!this.queue.length || !navigator.sendBeacon) {
            return;
        }
        const events = this.queue.splice(0, this.config.batchSize);
        const blob = new Blob([
            JSON.stringify({
                appKey: this.config.appKey,
                token: this.config.token,
                events,
            }),
        ], {
            type: "application/json",
        });
        const sent = navigator.sendBeacon(this.config.endpoint, blob);
        if (!sent) {
            this.queue.unshift(...events);
        }
    }
    log(level, ...args) {
        if (!this.config.debug) {
            return;
        }
        const logger = level === "warn" ? console.warn : console.debug;
        logger("[UserReplayCollector]", ...args);
    }
}
export function createJourneyCollector(config) {
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
export function init(config) {
    defaultCollector = createJourneyCollector(config);
    return defaultCollector;
}
export function identify(userId, traits) {
    defaultCollector === null || defaultCollector === void 0 ? void 0 : defaultCollector.identify(userId, traits);
}
export function track(eventName, payload) {
    defaultCollector === null || defaultCollector === void 0 ? void 0 : defaultCollector.track(eventName, payload);
}
export function flush() {
    var _a;
    return (_a = defaultCollector === null || defaultCollector === void 0 ? void 0 : defaultCollector.flush()) !== null && _a !== void 0 ? _a : Promise.resolve();
}
export function reset() {
    defaultCollector === null || defaultCollector === void 0 ? void 0 : defaultCollector.reset();
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
//# sourceMappingURL=index.js.map