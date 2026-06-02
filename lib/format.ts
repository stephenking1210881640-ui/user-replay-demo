import { format, formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";

export function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "yyyy-MM-dd HH:mm", { locale: zhCN });
}

export function formatDateTimeFull(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "yyyy-MM-dd HH:mm:ss", { locale: zhCN });
}

export function formatRelativeTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: zhCN });
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分 ${seconds}秒`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

