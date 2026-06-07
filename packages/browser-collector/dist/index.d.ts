export type CollectorEventType = "page_view" | "ui_click" | "form_submit" | "network_request" | "ui_error";
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
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
export declare function createJourneyCollector(config: JourneyCollectorConfig): JourneyCollector;
export declare const createCollector: typeof createJourneyCollector;
export declare function init(config: JourneyCollectorConfig): JourneyCollector;
export declare function identify(userId: string, traits?: IdentifyTraits): void;
export declare function track(eventName: string, payload?: TrackPayload): void;
export declare function flush(): Promise<void>;
export declare function reset(): void;
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
