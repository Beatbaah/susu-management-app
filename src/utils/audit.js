import { genId } from "./helpers";
import { roleLabel } from "./roles";
const sanitizeAuditValue = (value) => {
    if (value == null)
        return null;
    if (typeof value !== "object")
        return value;
    const clone = Array.isArray(value) ? [...value] : { ...value };
    ["password", "confirmPassword", "token", "apiKey", "secret"].forEach(key => {
        if (key in clone)
            clone[key] = "[redacted]";
    });
    return clone;
};
export function createAuditEntry({ action, actor, targetType, targetId, oldValue = null, newValue = null, }) {
    return {
        id: genId(),
        action,
        actorId: actor?.id || "anonymous",
        actorName: actor?.name || "Unknown user",
        actorRole: actor?.role || "anonymous",
        actorRoleLabel: roleLabel(actor?.role),
        targetType,
        targetId: targetId || null,
        oldValue: sanitizeAuditValue(oldValue),
        newValue: sanitizeAuditValue(newValue),
        timestamp: new Date().toISOString(),
        deviceInfo: typeof navigator === "undefined"
            ? "unknown"
            : `${navigator.platform || "unknown"} · ${navigator.userAgent || "unknown"}`,
    };
}
