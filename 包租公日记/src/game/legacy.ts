import { properties, tenants, renovations, events } from "./content";
export function validateLegacy(value: unknown): any {
    const bad = () => {
        throw new Error("存档损坏，原件已保留");
    };
    if (!value || typeof value !== "object")
        return bad();
    const s = value as any;
    if (s.schemaVersion !== 1)
        throw new Error("不支持此存档版本，原件已保留");
    const number = (v: unknown, min = 0) => typeof v === "number" && Number.isFinite(v) && v >= min;
    if (!Number.isInteger(s.month) ||
        s.month < 0 ||
        !number(s.cash) ||
        !s.properties ||
        !s.tenants ||
        !Array.isArray(s.pendingEvents) ||
        !Array.isArray(s.history) ||
        !Array.isArray(s.news) ||
        !Array.isArray(s.completedEvents))
        return bad();
    if (Object.keys(s.properties).length !== properties.length ||
        Object.keys(s.tenants).length !== 5)
        return bad();
    const occupied = new Set<string>();
    for (const def of properties) {
        const p = s.properties[def.id];
        if (!p ||
            typeof p.owned !== "boolean" ||
            !number(p.condition) ||
            p.condition > 100 ||
            !number(p.debt) ||
            !number(p.payment) ||
            !number(p.valueFactor) ||
            p.valueFactor === 0 ||
            !Number.isInteger(p.renovatingMonths) ||
            p.renovatingMonths < 0 ||
            p.renovatingMonths > 2 ||
            !(p.renovationId === null ||
                renovations.some((r) => r.id === p.renovationId)))
            return bad();
        if ((p.debt === 0) !== (p.payment === 0) ||
            (!p.owned && (p.tenantId !== null || p.debt !== 0 || p.payment !== 0)))
            return bad();
        if (p.tenantId !== null) {
            if (!tenants.slice(0, 5).some((t) => t.id === p.tenantId) ||
                occupied.has(p.tenantId) ||
                p.renovatingMonths)
                return bad();
            occupied.add(p.tenantId);
        }
    }
    for (const t of tenants.slice(0, 5)) {
        const v = s.tenants[t.id];
        if (!v ||
            !number(v.relationship) ||
            v.relationship > 100 ||
            !number(v.growth) ||
            !Number.isInteger(v.growth) ||
            typeof v.job !== "string")
            return bad();
    }
    if (!s.news.every((v: any) => typeof v === "string") ||
        !s.completedEvents.every((v: any) => typeof v === "string") ||
        new Set(s.completedEvents).size !== s.completedEvents.length)
        return bad();
    const ids = new Set<string>();
    for (const e of s.pendingEvents) {
        if (!e ||
            typeof e.id !== "string" ||
            ids.has(e.id) ||
            s.completedEvents.includes(e.id) ||
            typeof e.title !== "string" ||
            typeof e.text !== "string" ||
            !Array.isArray(e.choices) ||
            !e.choices.length ||
            (e.propertyId && !properties.some((p) => p.id === e.propertyId)) ||
            (e.tenantId && !tenants.slice(0, 5).some((t) => t.id === e.tenantId)))
            return bad();
        if (e.propertyId &&
            (!s.properties[e.propertyId].owned ||
                s.properties[e.propertyId].tenantId !== e.tenantId))
            return bad();
        const template = events.find((t) => e.id === t.id || e.id.startsWith(t.id + ":"));
        if (!template ||
            e.title !== template.title ||
            e.text !== template.text ||
            Boolean(e.tenantId) !== Boolean(e.propertyId) ||
            (template.trigger?.tenantId &&
                e.tenantId !== template.trigger.tenantId) ||
            JSON.stringify(e.choices) !== JSON.stringify(template.choices))
            return bad();
        ids.add(e.id);
        const choices = new Set<string>();
        for (const c of e.choices) {
            if (!c || choices.has(c.id))
                return bad();
            choices.add(c.id);
        }
        for (const c of e.choices)
            if (typeof c.id !== "string" ||
                typeof c.label !== "string" ||
                (c.cost !== undefined && !number(c.cost)))
                return bad();
    }
    for (const h of s.history)
        if (!h ||
            h.net !== h.income - h.maintenance - h.loanPayment ||
            !Number.isInteger(h.month) ||
            h.month < 1 ||
            h.month > s.month ||
            ![h.income, h.maintenance, h.loanPayment].every((v: any) => number(v)) ||
            !number(h.net, -Infinity) ||
            !Array.isArray(h.items) ||
            !h.items.every((v: any) => typeof v === "string"))
            return bad();
    return structuredClone(s);
}
