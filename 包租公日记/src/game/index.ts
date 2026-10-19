import { validateLegacy } from "./legacy";
import { properties, tenants, renovations, regions, events } from "./content";
export type Property = {
    id: string;
    name: string;
    regionId: string;
    capacity: number;
    baseValue: number;
    baseRent: number;
    mortgage: {
        downPaymentRate: number;
        months: number;
        annualRate: number;
    };
};
export type Tenant = {
    id: string;
    name: string;
    budget: number;
    job: string;
    description: string;
};
export type Event = {
    id: string;
    title: string;
    text: string;
    trigger?: {
        month?: number;
        tenantId?: string;
        minRelationship?: number;
        maxCondition?: number;
        requiresTenant?: boolean;
        once?: boolean;
    };
    choices: {
        id: string;
        label: string;
        cost?: number;
        description?: string;
        effects?: {
            relationship?: number;
            condition?: number;
            job?: string;
            budgetGrowth?: number;
        };
    }[];
};
export type PendingEvent = Event & {
    propertyId?: string;
    tenantId?: string;
};
export type Settlement = {
    month: number;
    income: number;
    maintenance: number;
    loanPayment: number;
    net: number;
    items: string[];
};
export type Lease = {
    tenantId: string;
    rentShare: number;
    monthlyRent: number;
    expiresMonth: number;
    joinedMonth: number;
    source: "walkin" | "agency" | "legacy";
};
export type Applicant = {
    id: string;
    propertyId: string;
    tenantId: string;
    source: "walkin" | "agency";
    createdMonth: number;
    offeredRent: number;
    kind: "full" | "bargain" | "renewal";
    leaseTenantId?: string;
    offerText: string;
    expiresMonth: number;
};
type PropertyState = {
    askingRent: number | null;
    owned: boolean;
    leases: Lease[];
    renovationId: string | null;
    renovatingMonths: number;
    condition: number;
    debt: number;
    payment: number;
    valueFactor: number;
};
type TenantState = {
    relationship: number;
    job: string;
    growth: number;
};
export type GameState = {
    schemaVersion: 3;
    citySeed: number;
    development: Record<string, {
        stage: ProjectStage;
        priceFactor: number;
        rentFactor: number;
        demandBonus: number;
    }>;
    applicants: Applicant[];
    walkinMonths: Record<string, number>;
    month: number;
    cash: number;
    properties: Record<string, PropertyState>;
    tenants: Record<string, TenantState>;
    pendingEvents: PendingEvent[];
    history: Settlement[];
    news: string[];
    completedEvents: string[];
};
export type Action = {
    type: "listing";
    propertyId: string;
    askingRent: number;
} | {
    type: "unlist";
    propertyId: string;
} | {
    type: "counter";
    propertyId: string;
    applicantId: string;
    rent: number;
} | {
    type: "renovate";
    propertyId: string;
    renovationId: string;
} | {
    type: "rent" | "reject";
    propertyId: string;
    applicantId: string;
} | {
    type: "agency";
    propertyId: string;
} | {
    type: "buy";
    propertyId: string;
    financing: "cash" | "mortgage";
} | {
    type: "sell" | "repair";
    propertyId: string;
} | {
    type: "advance";
} | {
    type: "resolve";
    eventId: string;
    choiceId: string;
};
const definitionRate = (p: Property) => p.mortgage.annualRate / 12;
export function quoteMortgage(value: number, terms: Property["mortgage"]) {
    const downPayment = Math.ceil(value * terms.downPaymentRate);
    const debt = value - downPayment;
    const rate = terms.annualRate / 12;
    const factor = (1 + rate) ** terms.months;
    const payment = Math.ceil(rate === 0 ? debt / terms.months : debt * rate * factor / (factor - 1));
    return { downPayment, debt, payment };
}
function nextLoanPayment(p: Property & {
    debt: number;
    payment: number;
}) {
    const interest = Math.round(p.debt * definitionRate(p) * 100) / 100;
    return Math.min(p.debt + interest, p.payment);
}
export const content = { properties, tenants, renovations, regions, events, recruitment: { agencyFee: 200, agencyCandidateCount: 2 } };
export function createGame(seed = Math.floor(Math.random() * 0x100000000)): GameState {
    if (!Number.isInteger(seed) || seed < 0) throw new Error("城市种子必须是非负整数");
    return {
        schemaVersion: 3,
        citySeed: seed,
        development: Object.fromEntries(regions.map(r => [r.id, { stage: "rumor" as ProjectStage, priceFactor: 1, rentFactor: 1, demandBonus: 0 }])),
        applicants: [],
        walkinMonths: {},
        month: 0,
        cash: 20000,
        properties: Object.fromEntries(properties.map((p, i) => [
            p.id,
            {
                askingRent: null,
                owned: i === 0,
                leases: [],
                renovationId: i === 0 ? null : "simple",
                renovatingMonths: 0,
                condition: i === 0 ? 30 : 90,
                debt: 0,
                payment: 0,
                valueFactor: 1,
            },
        ])),
        tenants: Object.fromEntries(tenants.map((t) => [t.id, { relationship: 60, job: t.job, growth: 0 }])),
        pendingEvents: [],
        history: [],
        news: ["2029年1月：幸福里402交到你手中，先装修，再招租。"],
        completedEvents: [],
    };
}
export function selectTenants(state: GameState) {
    return tenants.map((t) => ({
        ...t,
        ...state.tenants[t.id],
        budget: t.budget + state.tenants[t.id].growth * 100,
    }));
}
export type ProjectStage = 'rumor' | 'announced' | 'building' | 'operating' | 'delayed' | 'cancelled';
const stageLabels: Record<ProjectStage, string> = { rumor: '传闻', announced: '已公布', building: '施工中', operating: '已启用', delayed: '延期', cancelled: '取消' };
export const cityProjects = [
    { regionId: 'xingfu', id: 'metro', name: '老街地铁站', announce: 4, build: 7, finish: 12, price: .12, rent: .08, demand: .3 },
    { regionId: 'university', id: 'campus', name: '大学新校区', announce: 2, build: 5, finish: 9, price: .08, rent: .12, demand: .18 },
    { regionId: 'tech', id: 'research', name: '科技园研发中心', announce: 3, build: 6, finish: 10, price: .16, rent: .14, demand: .2 },
];
function tierOf(s: PropertyState): 'basic' | 'comfort' | 'premium' { return s.renovationId === 'premium' ? 'premium' : s.renovationId === 'modern' ? 'comfort' : 'basic'; }
function demand(state: GameState, id: string, tier?: string) { const region = properties.find(p => p.id === id)!.regionId; const t = tier ?? tierOf(state.properties[id]); return ({ xingfu: { basic: .65, comfort: .75, premium: .45 }, university: { basic: .95, comfort: .8, premium: .5 }, tech: { basic: .65, comfort: .85, premium: .95 } } as Record<string, Record<string, number>>)[region][t] + state.development[region].demandBonus; }
export function marketRent(state: GameState, id: string) { const p = properties.find(p => p.id === id)!; const s = state.properties[id]; return Math.round(p.baseRent / p.capacity * (renovations.find(r => r.id === s.renovationId)?.rentMultiplier ?? 1) * (s.condition < 40 ? .8 : s.condition < 80 ? .95 : 1) * state.development[p.regionId].rentFactor); }
export function quoteRent(state: GameState, id: string, tenantId: string) { return properties.some(p => p.id === id) ? Math.min(marketRent(state, id), selectTenants(state).find(t => t.id === tenantId)?.budget ?? 0) : 0; }
export function selectApplicants(state: GameState, id: string) { return state.applicants.filter(a => a.propertyId === id).map(a => ({ ...selectTenants(state).find(t => t.id === a.tenantId)!, ...a, monthlyRent: a.offeredRent, askedRent: state.properties[id].askingRent ?? marketRent(state, id) })); }
export function selectProperties(state: GameState) { return properties.map(p => { const s = state.properties[p.id]; return { ...p, ...s, leases: s.leases, tenantId: s.leases[0]?.tenantId ?? null, tenantIds: s.leases.map(l => l.tenantId), applicantCount: state.applicants.filter(a => a.propertyId === p.id && a.kind !== "renewal").length, renewalCount: state.applicants.filter(a => a.propertyId === p.id && a.kind === "renewal").length, occupancy: s.leases.length, vacancies: p.capacity - s.leases.length, value: Math.round(p.baseValue * s.valueFactor * state.development[p.regionId].priceFactor), rent: s.renovatingMonths ? 0 : s.leases.reduce((v, l) => v + l.monthlyRent, 0), marketRent: marketRent(state, p.id), tier: tierOf(s), listing: s.askingRent !== null }; }); }
function eligible(state: GameState, id: string) { const p = state.properties[id]; return p.owned && p.condition >= 40 && !p.renovatingMonths && p.leases.length < 3 && p.askingRent !== null; }
function candidates(state: GameState) { const used = new Set([...Object.values(state.properties).flatMap(p => p.leases.map(l => l.tenantId)), ...state.applicants.map(a => a.tenantId)]); return tenants.filter(t => !used.has(t.id)); }
function offerLimit(state: GameState, id: string, tenantId: string) { return Math.floor(Math.min(selectTenants(state).find(t => t.id === tenantId)!.budget, marketRent(state, id) * (1 + Math.max(0, demand(state, id) - .75) * .3))); }
function addApplicant(state: GameState, id: string, tenantId: string, source: Applicant['source']) { const asking = state.properties[id].askingRent!; const limit = offerLimit(state, id, tenantId); if (asking > limit * 1.55)
    return false; const full = asking <= limit; state.applicants.push({ id: `${source}:${state.month}:${id}:${tenantId}`, propertyId: id, tenantId, source, createdMonth: state.month, expiresMonth: state.month + 1, offeredRent: full ? asking : limit, kind: full ? 'full' : 'bargain', offerText: full ? '愿按挂牌价入住，本月有效' : '预算有限，报价本月有效' }); return true; }
function walkin(state: GameState, id: string) { if (!eligible(state, id) || state.walkinMonths[id] === state.month)
    return; if (state.applicants.filter(a => a.propertyId === id && a.kind !== 'renewal').length >= 3 - state.properties[id].leases.length)
    return; const cadence = demand(state, id) >= .75 ? 1 : 2; if (state.walkinMonths[id] !== undefined && state.month % cadence)
    return; for (const t of candidates(state))
    if (addApplicant(state, id, t.id, 'walkin')) {
        state.walkinMonths[id] = state.month;
        break;
    } }
function develop(state: GameState, items: string[]) { for (const c of cityProjects) {
    const d = state.development[c.regionId];
    const branch = (state.citySeed + c.finish) % 4;
    const stage: ProjectStage = state.month < c.announce ? 'rumor' : state.month < c.build ? 'announced' : state.month < c.finish ? 'building' : branch === 0 ? 'cancelled' : branch === 1 && state.month < c.finish + 3 ? 'delayed' : 'operating';
    if (stage === d.stage)
        continue;
    d.stage = stage;
    const weight = stage === 'operating' ? 1 : stage === 'announced' ? .2 : stage === 'building' ? .35 : stage === 'delayed' ? .1 : 0;
    d.priceFactor = 1 + c.price * weight;
    d.rentFactor = 1 + (stage === 'operating' ? c.rent : 0);
    d.demandBonus = stage === 'operating' ? c.demand : stage === 'building' ? -.08 : 0;
    items.push(`${c.name}${stageLabels[stage]}${stage === 'operating' ? '，租住需求提升' : stage === 'cancelled' ? '，预期溢价消退' : ''}`);
} }
// Display levels share the same absolute price/rent basis as actual property quotes.
const priceLevel = (value: number) => value < 150000 ? '便宜' : value >= 400000 ? '昂贵' : '适中';
const rentLevel = (value: number) => value < 700 ? '低' : value >= 1400 ? '高' : '中';
export function selectDistricts(state: GameState) {
    const all = selectProperties(state);
    return regions.map(r => {
        const homes = all.filter(p => p.regionId === r.id);
        const owned = homes.filter(p => p.owned);
        const d = state.development[r.id];
        const c = cityProjects.find(c => c.regionId === r.id)!;
        const referencePrice = homes.reduce((total, p) => total + p.value, 0) / homes.length;
        const tiers = (['basic', 'comfort', 'premium'] as const).map((id, i) => {
            const multiplier = renovations[i].rentMultiplier;
            const referenceRent = homes.reduce((total, p) => total + p.baseRent / p.capacity * multiplier * (p.condition < 40 ? .8 : p.condition < 80 ? .95 : 1) * d.rentFactor, 0) / homes.length;
            const demandFactor = demand(state, homes[0].id, id);
            return { id, name: ['基础', '舒适', '精品'][i], priceLevel: priceLevel(referencePrice), rentLevel: rentLevel(referenceRent), demandLevel: demandFactor < .7 ? '冷清' : demandFactor > .9 ? '旺盛' : '平稳' };
        });
        const expenses = owned.reduce((v, p) => v + Math.round(p.baseRent * .08) + nextLoanPayment(p), 0);
        const contractRent = owned.reduce((v, p) => v + p.rent, 0);
        return {
            ...r, priceLevel: priceLevel(referencePrice), rentLevel: rentLevel(homes.reduce((total, p) => total + p.marketRent, 0) / homes.length), demandLevel: tiers[0].demandLevel, tiers,
            ownedCount: owned.length, vacancies: owned.reduce((v, p) => v + p.vacancies, 0), listedVacancies: owned.filter(p => p.listing).reduce((v, p) => v + p.vacancies, 0), occupiedSlots: owned.reduce((v, p) => v + p.occupancy, 0), contractRent, expenses, netIncome: contractRent - expenses,
            waitingCount: state.applicants.filter(a => owned.some(p => p.id === a.propertyId)).length, repairCount: owned.filter(p => p.condition < 80 && p.renovatingMonths === 0).length, constructionCount: owned.filter(p => p.renovatingMonths > 0).length,
            project: { id: c.id, name: c.name, stage: d.stage, stageLabel: stageLabels[d.stage], description: d.stage === 'operating' ? '配套启用带来租住需求' : d.stage === 'cancelled' ? '项目取消，预期收益未兑现' : d.stage === 'delayed' ? '工期延误，需求尚未兑现' : d.stage === 'building' ? '施工影响居住，等待启用' : d.stage === 'announced' ? '规划公布，租住需求尚未增长' : '尚未公布正式计划', nextMonth: d.stage === 'rumor' ? c.announce : d.stage === 'announced' ? c.build : d.stage === 'building' ? c.finish : d.stage === 'delayed' ? c.finish + 3 : null }
        };
    });
}
// A departing household cannot cancel a repair shared by the remaining households.
function removeHousehold(state: GameState, propertyId: string, tenantId: string) {
    const p = state.properties[propertyId];
    p.leases = p.leases.filter(l => l.tenantId !== tenantId);
    state.pendingEvents = state.pendingEvents.flatMap(e => {
        if (e.tenantId !== tenantId) return [e];
        if (e.propertyId === propertyId && e.id.startsWith('repair-request:') && p.leases.length) return [{ ...e, tenantId: p.leases[0].tenantId }];
        return [];
    });
}
export function selectSummary(state: GameState) {
    const owned = selectProperties(state).filter((p) => p.owned);
    const assets = owned.reduce((v, p) => v + p.value, 0);
    const debt = owned.reduce((v, p) => v + p.debt, 0);
    const income = owned.reduce((v, p) => v + p.rent, 0);
    const expenses = owned.reduce((v, p) => v + Math.round(p.baseRent * 0.08) + nextLoanPayment(p), 0);
    return {
        cash: state.cash,
        assets,
        debt,
        netWorth: state.cash + assets - debt,
        income,
        expenses,
        netIncome: income - expenses,
        ownedCount: owned.length,
    };
}
export function dispatch(state: GameState, action: Action): {
    ok: boolean;
    message: string;
    state: GameState;
} {
    const fail = (message: string) => ({ ok: false, message, state });
    const next: GameState = structuredClone(state);
    const success = (message: string) => ({ ok: true, message, state: next });
    if (action.type === "resolve") {
        const index = next.pendingEvents.findIndex((e) => e.id === action.eventId);
        if (index < 0)
            return fail("事件已经处理或不存在");
        const e = next.pendingEvents[index];
        const c = e.choices.find((c) => c.id === action.choiceId);
        if (!c)
            return fail("请选择有效选项");
        if (next.cash < (c.cost ?? 0))
            return fail("现金不足，可选择免费处理");
        next.cash -= c.cost ?? 0;
        // 漏水属于同房共用设施，关系反馈覆盖本房所有住户；个人消息仍只影响本人。
        const sharedRepair = e.propertyId !== undefined && e.id.startsWith('repair-request:');
        const affectedTenants = sharedRepair ? next.properties[e.propertyId!].leases.map(l => l.tenantId) : e.tenantId ? [e.tenantId] : [];
        for (const tenantId of affectedTenants) {
            const t = next.tenants[tenantId];
            t.relationship = Math.max(0, Math.min(100, t.relationship + (c.effects?.relationship ?? 0)));
            if (c.effects?.job)
                t.job = c.effects.job;
            if (c.effects?.budgetGrowth)
                t.growth += c.effects.budgetGrowth;
        }
        if (e.propertyId && c.effects?.condition !== undefined)
            next.properties[e.propertyId].condition = c.effects.condition;
        const resolved = sharedRepair
            ? next.pendingEvents.filter(other => other.propertyId === e.propertyId && other.id.startsWith(`repair-request:${e.id.split(':')[1]}:`))
            : [e];
        // 清理先前 v2 曾按住户生成的同房同月重复请求，防止再次支付同一项维修。
        for (const event of resolved)
            next.completedEvents.push(event.id);
        const resolvedIds = new Set(resolved.map(event => event.id));
        next.pendingEvents = next.pendingEvents.filter(event => !resolvedIds.has(event.id));
        return success("已处理这件事");
    }
    if (action.type === "advance") {
        if (next.pendingEvents.length)
            return fail("先处理本月租客的消息");
        const month = next.month + 1;
        let income = 0, maintenance = 0, loanPayment = 0;
        const items: string[] = [];
        for (const p of selectProperties(state).filter((p) => p.owned)) {
            const s = next.properties[p.id];
            income += p.rent;
            if (p.rent)
                items.push(`${p.name}租金 +${p.rent}`);
            const upkeep = Math.round(p.baseRent * 0.08);
            maintenance += upkeep;
            const interest = Math.round(s.debt * definitionRate(p) * 100) / 100;
            const payment = nextLoanPayment(p);
            loanPayment += payment;
            s.debt = Math.max(0, Math.round((s.debt + interest - payment) * 100) / 100);
            if (!s.debt)
                s.payment = 0;
            if (s.renovatingMonths > 0) {
                s.renovatingMonths--;
                if (!s.renovatingMonths)
                    s.condition = 100;
                if (!s.renovatingMonths)
                    items.push(`${p.name}装修完成，可以招租`);
            }
            s.condition = Math.max(0, s.condition - 2);
            for (const lease of [...s.leases]) {
                const t = next.tenants[lease.tenantId];
                if (month % 6 === 0)
                    t.growth++;
                if (s.condition < 40)
                    t.relationship = Math.max(0, t.relationship - 8);
                if (t.relationship <= 20) {
                    items.push(`${tenants.find((t) => t.id === lease.tenantId)!.name}搬走了`);
                    s.leases = s.leases.filter(l => l.tenantId !== lease.tenantId);
                }
            }
        }
        for (const template of events) {
            const trigger = template.trigger!;
            if (month < (trigger.month ?? 0))
                continue;
            let targets = properties.flatMap(p => next.properties[p.id].leases.map(l => ({ propertyId: p.id, tenantId: l.tenantId }))).filter(t => trigger.tenantId ? t.tenantId === trigger.tenantId : trigger.requiresTenant ? next.properties[t.propertyId].condition <= (trigger.maxCondition ?? 100) : false);
            if (template.id === 'repair-request')
                targets = targets.filter((target, index, all) => all.findIndex(other => other.propertyId === target.propertyId) === index);
            if ((trigger.tenantId || trigger.requiresTenant) && !targets.length)
                continue;
            for (const target of targets.length ? targets : [undefined]) {
                const tenantId = target?.tenantId;
                if (tenantId && next.tenants[tenantId].relationship < (trigger.minRelationship ?? 0))
                    continue;
                const id = trigger.once ? template.id : `${template.id}:${month}:${target!.propertyId}:${tenantId}`;
                if (!next.completedEvents.includes(id))
                    next.pendingEvents.push({ ...structuredClone(template), id, propertyId: target?.propertyId, tenantId });
            }
        }
        const net = income - maintenance - loanPayment;
        if (next.cash + net < 0)
            return fail("现金不足以支付本月维护和月供，请先招租或出售房产");
        next.cash += net;
        next.month = month;
        next.applicants = next.applicants.filter(a => a.kind === 'renewal' && next.properties[a.propertyId].leases.some(l => l.tenantId === a.leaseTenantId));
        develop(next, items);
        for (const def of properties)
            for (const l of next.properties[def.id].leases)
                if (l.expiresMonth <= month && !next.applicants.some(a => a.leaseTenantId === l.tenantId)) {
                    const offeredRent = offerLimit(next, def.id, l.tenantId);
                    next.applicants.push({ id: `renewal:${month}:${def.id}:${l.tenantId}`, propertyId: def.id, tenantId: l.tenantId, leaseTenantId: l.tenantId, source: l.source === 'agency' ? 'agency' : 'walkin', createdMonth: month, expiresMonth: month + 1, offeredRent, kind: 'renewal', offerText: '合同到期，租客提出续租报价' });
                }
        for (const p of properties)
            walkin(next, p.id);
        next.history.push({ month, income, maintenance, loanPayment, net, items });
        next.history = next.history.slice(-60);
        next.news = items.slice(0, 8);
        return success("月结完成");
    }
    const definition = properties.find((p) => p.id === action.propertyId);
    if (!definition)
        return fail("房屋不存在");
    const p = next.properties[definition.id];
    const view = selectProperties(state).find((p) => p.id === definition.id)!;
    if (action.type === "buy") {
        if (p.owned)
            return fail("已经拥有这套房");
        if (action.financing !== "cash" && action.financing !== "mortgage")
            return fail("请选择付款方案");
        const cost = action.financing === "cash"
            ? view.value
            : Math.ceil(view.value * definition.mortgage.downPaymentRate);
        if (next.cash < cost)
            return fail("现金不足");
        next.cash -= cost;
        p.owned = true;
        if (action.financing === "mortgage") {
            const quote = quoteMortgage(view.value, definition.mortgage);
            p.debt = quote.debt;
            p.payment = quote.payment;
        }
        walkin(next, definition.id);
        return success("购房完成");
    }
    if (!p.owned)
        return fail("还没有这套房的产权");
    if (action.type === 'listing') {
        if (!Number.isInteger(action.askingRent) || action.askingRent <= 0)
            return fail('请输入正整数月租');
        if (p.condition < 40 || p.renovatingMonths || p.leases.length >= 3)
            return fail('房屋没有可出租空位');
        p.askingRent = action.askingRent;
        next.applicants = next.applicants.filter(a => a.propertyId !== definition.id || a.kind === 'renewal' || action.askingRent <= offerLimit(next, definition.id, a.tenantId) * 1.55);
        for (const a of next.applicants.filter(a => a.propertyId === definition.id && a.kind !== 'renewal')) {
            a.offeredRent = Math.min(action.askingRent, offerLimit(next, definition.id, a.tenantId));
            a.kind = a.offeredRent === action.askingRent ? 'full' : 'bargain';
            a.offerText = a.kind === 'full' ? '愿按挂牌价入住，本月有效' : '提出较低报价，本月有效';
        }
        walkin(next, definition.id);
        return success('挂牌租金已更新');
    }
    if (action.type === 'unlist') {
        p.askingRent = null;
        next.applicants = next.applicants.filter(a => a.propertyId !== definition.id || a.kind === 'renewal');
        return success('已暂停招租');
    }
    if (action.type === "sell") {
        next.cash += view.value - p.debt;
        p.owned = false;
        p.leases = [];
        p.askingRent = null;
        next.applicants = next.applicants.filter(a => a.propertyId !== definition.id);
        p.debt = 0;
        p.payment = 0;
        p.renovatingMonths = 0;
        next.pendingEvents = next.pendingEvents.filter((e) => e.propertyId !== definition.id);
        return success("售房完成，剩余贷款已结清");
    }
    if (action.type === "repair") {
        if (p.condition === 100)
            return fail("房况良好，无需维修");
        const cost = Math.ceil((100 - p.condition) * 5);
        if (next.cash < cost)
            return fail("现金不足");
        next.cash -= cost;
        p.condition = 100;
        for (const l of p.leases)
            next.tenants[l.tenantId].relationship = Math.min(100, next.tenants[l.tenantId].relationship + 5);
        walkin(next, definition.id);
        return success("维修完成");
    }
    if (action.type === "renovate") {
        const r = renovations.find((r) => r.id === action.renovationId);
        if (!r)
            return fail("装修方案不存在");
        if (p.leases.length || p.renovatingMonths)
            return fail("请在空置且未施工时装修");
        if (p.renovationId === r.id)
            return fail("已采用这套装修");
        if (next.cash < r.cost)
            return fail("现金不足");
        next.cash -= r.cost;
        p.renovationId = r.id;
        p.renovatingMonths = r.months;
        next.applicants = next.applicants.filter(a => a.propertyId !== definition.id);
        return success("装修开工");
    }
    if (action.type === 'agency') {
        if (!eligible(next, definition.id))
            return fail('房屋没有可出租空位');
        const needed = 3 - p.leases.length - next.applicants.filter(a => a.propertyId === definition.id && a.kind !== 'renewal').length;
        const available = candidates(next).filter(t => p.askingRent! <= offerLimit(next, definition.id, t.id) * 1.55).slice(0, Math.min(content.recruitment.agencyCandidateCount, needed));
        if (!available.length)
            return fail('暂无新的候选租客');
        if (next.cash < content.recruitment.agencyFee)
            return fail('现金不足');
        next.cash -= content.recruitment.agencyFee;
        for (const t of available)
            addApplicant(next, definition.id, t.id, 'agency');
        return success('中介已带来候选租客');
    }
    if (action.type === 'rent' || action.type === 'reject' || action.type === 'counter') {
        const a = next.applicants.find(a => a.id === action.applicantId && a.propertyId === definition.id);
        if (!a)
            return fail('这位访客已离开或不属于这套房');
        if (action.type === 'reject') {
            if (a.kind === 'renewal') {
                removeHousehold(next, definition.id, a.tenantId);
            }
            next.applicants = next.applicants.filter(v => v.id !== a.id);
            return success('已婉拒访客');
        }
        const rent = action.type === 'counter' ? action.rent : a.offeredRent;
        if (!Number.isInteger(rent) || rent <= 0)
            return fail('请输入正整数月租');
        if (action.type === 'counter' && rent > offerLimit(next, definition.id, a.tenantId)) {
            next.applicants = next.applicants.filter(v => v.id !== a.id);
            if (a.kind === 'renewal') {
                removeHousehold(next, definition.id, a.tenantId);
                return success('续租价格未谈拢，租客搬离');
            }
            return success('报价超过租客可接受范围，访客离开');
        }
        if (a.kind === 'renewal') {
            const lease = p.leases.find(l => l.tenantId === a.leaseTenantId);
            if (!lease)
                return fail('原租约不存在');
            lease.monthlyRent = rent;
            lease.expiresMonth = next.month + 6;
            next.applicants = next.applicants.filter(v => v.id !== a.id);
            return success('已续租六个月');
        }
        if (!eligible(next, definition.id))
            return fail('房屋已住满、正在施工、未挂牌或需要维修');
        if (Object.values(next.properties).some(p => p.leases.some(l => l.tenantId === a.tenantId)))
            return fail('这位租客已经有住所');
        p.leases.push({ tenantId: a.tenantId, rentShare: 1 / 3, joinedMonth: next.month, source: a.source, monthlyRent: rent, expiresMonth: next.month + 6 });
        next.applicants = next.applicants.filter(v => v.id !== a.id);
        next.tenants[a.tenantId].relationship = Math.max(40, next.tenants[a.tenantId].relationship);
        return success('租约已签订');
    }
    return fail("操作不存在");
}
export const SAVE_KEY = "landlord-diary.save.v1";
export const BACKUP_KEY = "landlord-diary.save.v1.backup";
export const SAVE_BACKUP_KEY = BACKUP_KEY;
export const V2_BACKUP_KEY = "landlord-diary.save.v2.backup";
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export function validateSave(value: unknown): GameState {
    const bad = () => {
        throw new Error("存档损坏，原件已保留");
    };
    if (!value || typeof value !== "object")
        return bad();
    const s = value as GameState;
    if ((s as any).schemaVersion === 1) {
        const old = validateLegacy(value);
        const next = createGame(17);
        for (const def of properties) {
            const p = old.properties[def.id];
            const { tenantId, ...rest } = p;
            next.properties[def.id] = { ...rest, leases: tenantId ? [{ tenantId, rentShare: 1, joinedMonth: old.month, source: 'legacy' }] : [] } as any;
        }
        return validateSave({ ...old, schemaVersion: 2, properties: next.properties, tenants: { ...next.tenants, ...old.tenants }, applicants: [], walkinMonths: {} });
    }
    const version = (s as any).schemaVersion;
    if (version !== 2 && version !== 3)
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
        Object.keys(s.tenants).length !== tenants.length)
        return bad();
    const occupied = new Set<string>();
    for (const def of properties) {
        const p = s.properties[def.id];
        if (version === 3 && p && (p.askingRent !== null && (!Number.isInteger(p.askingRent) || p.askingRent! <= 0)))
            return bad();
        if (!p ||
            !Array.isArray(p.leases) || p.leases.length > 3 ||
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
            (!p.owned && (p.leases.length !== 0 || p.debt !== 0 || p.payment !== 0)))
            return bad();
        for (const l of p.leases) {
            if (!l || !tenants.some(t => t.id === l.tenantId) || occupied.has(l.tenantId) || p.renovatingMonths || !['walkin', 'agency', 'legacy'].includes(l.source) || l.rentShare !== (l.source === 'legacy' ? 1 : 1 / 3) || !Number.isInteger(l.joinedMonth) || l.joinedMonth < 0 || l.joinedMonth > s.month)
                return bad();
            if (version === 3 && (!Number.isInteger(l.monthlyRent) || l.monthlyRent <= 0 || !Number.isInteger(l.expiresMonth) || l.expiresMonth < l.joinedMonth))
                return bad();
            occupied.add(l.tenantId);
        }
    }
    if (!Array.isArray(s.applicants) || !s.walkinMonths || typeof s.walkinMonths !== 'object' || Array.isArray(s.walkinMonths))
        return bad();
    for (const [id, month] of Object.entries(s.walkinMonths))
        if (!properties.some(p => p.id === id) || !Number.isInteger(month) || month < 0 || month > s.month)
            return bad();
    const applicantIds = new Set<string>();
    const applicantTenants = new Set<string>();
    for (const a of s.applicants) {
        if (!a || typeof a.id !== 'string' || applicantIds.has(a.id) || applicantTenants.has(a.tenantId) || !properties.some(p => p.id === a.propertyId) || !tenants.some(t => t.id === a.tenantId) || (occupied.has(a.tenantId) && !(version === 3 && a.kind === 'renewal' && a.leaseTenantId === a.tenantId && s.properties[a.propertyId].leases.some(l => l.tenantId === a.tenantId))) || !['walkin', 'agency'].includes(a.source) || !Number.isInteger(a.createdMonth) || a.createdMonth < 0 || a.createdMonth > s.month)
            return bad();
        if (!s.properties[a.propertyId].owned || s.properties[a.propertyId].renovatingMonths || s.applicants.filter(v => v.propertyId === a.propertyId && (version === 2 || v.kind !== 'renewal')).length > 3 - s.properties[a.propertyId].leases.length)
            return bad();
        if (a.source === 'walkin' && (version === 2 || a.kind !== 'renewal') && (s.walkinMonths[a.propertyId] ?? -1) < a.createdMonth)
            return bad();
        if (version === 3 && a.kind === 'renewal' && (a.leaseTenantId !== a.tenantId || !s.properties[a.propertyId].leases.some(l => l.tenantId === a.tenantId)))
            return bad();
        if (version === 3 && (!Number.isInteger(a.offeredRent) || a.offeredRent <= 0 || !['full', 'bargain', 'renewal'].includes(a.kind) || typeof a.offerText !== 'string' || !Number.isInteger(a.expiresMonth) || a.expiresMonth <= a.createdMonth || (a.kind !== 'renewal' && (a.leaseTenantId !== undefined || a.expiresMonth <= s.month || s.properties[a.propertyId].askingRent === null))))
            return bad();
        applicantIds.add(a.id);
        applicantTenants.add(a.tenantId);
        occupied.add(a.tenantId);
    }
    for (const t of tenants) {
        const v = s.tenants[t.id];
        if (!v ||
            !number(v.relationship) ||
            v.relationship > 100 ||
            !number(v.growth) ||
            !Number.isInteger(v.growth) ||
            typeof v.job !== "string")
            return bad();
    }
    if (!s.news.every((v) => typeof v === "string") ||
        !s.completedEvents.every((v) => typeof v === "string") ||
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
            (e.tenantId && !tenants.some((t) => t.id === e.tenantId)))
            return bad();
        if (e.propertyId &&
            (!s.properties[e.propertyId].owned ||
                !s.properties[e.propertyId].leases.some(l => l.tenantId === e.tenantId)))
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
            ![h.income, h.maintenance, h.loanPayment].every((v) => number(v)) ||
            !number(h.net, -Infinity) ||
            !Array.isArray(h.items) ||
            !h.items.every((v) => typeof v === "string"))
            return bad();
    if (version === 2) {
        const next = createGame(17);
        const migrated = { ...structuredClone(s), schemaVersion: 3, citySeed: 17, development: next.development } as GameState;
        // Align project time without granting or removing equity at the upgrade boundary.
        develop(migrated, []);
        for (const def of properties) migrated.properties[def.id].valueFactor /= migrated.development[def.regionId].priceFactor;
        for (const def of properties) {
            const p = migrated.properties[def.id];
            p.askingRent = null;
            for (const l of p.leases) {
                const budget = tenants.find(t => t.id === l.tenantId)!.budget + migrated.tenants[l.tenantId].growth * 100;
                l.monthlyRent = Math.round(Math.min(def.baseRent * (renovations.find(r => r.id === p.renovationId)?.rentMultiplier ?? 1) * l.rentShare, budget) * (p.condition < 40 ? .8 : 1));
                l.expiresMonth = migrated.month + 6;
            }
            if (migrated.applicants.some(a => a.propertyId === def.id))
                p.askingRent = marketRent(migrated, def.id);
        }
        for (const a of migrated.applicants) {
            // Upgrade keeps already presented v2 offers, including its former condition rule.
            const def = properties.find(p => p.id === a.propertyId)!;
            const p = migrated.properties[a.propertyId];
            const budget = tenants.find(t => t.id === a.tenantId)!.budget + migrated.tenants[a.tenantId].growth * 100;
            a.offeredRent = Math.round(Math.min(def.baseRent * (renovations.find(r => r.id === p.renovationId)?.rentMultiplier ?? 1) / 3, budget) * (p.condition < 40 ? .8 : 1));
            a.kind = 'full';
            a.offerText = '升级前已有的入住报价，本月有效';
            a.expiresMonth = migrated.month + 1;
        }
        return validateSave(migrated);
    }
    if (!Number.isInteger(s.citySeed) || s.citySeed < 0 || !s.development || Object.keys(s.development).length !== regions.length)
        return bad();
    for (const r of regions) {
        const d = s.development[r.id];
        if (!d || !Object.hasOwn(stageLabels, d.stage) || !number(d.priceFactor) || d.priceFactor === 0 || !number(d.rentFactor) || d.rentFactor === 0 || !number(d.demandBonus, -.1) || d.demandBonus > 1)
            return bad();
    }
    return structuredClone(s);
}
function readSave(raw: string): GameState {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("存档损坏，原件已保留");
    }
    return validateSave(parsed);
}
function storageMessage(error: unknown, saving: boolean): string {
    if (error instanceof Error && /存档|另一页面/.test(error.message))
        return error.message;
    return saving ? "保存失败，请检查浏览器存储权限及可用空间。" : "无法读取存档，请检查浏览器存储权限。";
}
export function loadGame(storage: StorageLike): {
    state: GameState;
    error: string | null;
    blocked: boolean;
    raw: string | null;
} {
    try {
        let raw = storage.getItem(SAVE_KEY);
        const state = raw === null ? createGame() : readSave(raw);
        if (raw !== null && JSON.parse(raw).schemaVersion < 3) {
            backupLegacy(storage, raw);
            if (storage.getItem(SAVE_KEY) !== raw)
                throw new Error('另一页面已更新进度，请重新载入后继续');
            const migrated = JSON.stringify(state);
            storage.setItem(SAVE_KEY, migrated);
            raw = migrated;
        }
        return {
            state,
            error: null,
            blocked: false,
            raw,
        };
    }
    catch (e) {
        return {
            state: createGame(),
            error: storageMessage(e, false),
            blocked: true,
            raw: null,
        };
    }
}
export function saveGame(storage: StorageLike, state: GameState, expectedRaw?: string | null): {
    ok: boolean;
    error: string | null;
    raw: string | null;
} {
    try {
        const current = storage.getItem(SAVE_KEY);
        // 乐观检查可以拒绝已知的旧页面；localStorage不提供跨页面原子比较并写入。
        if (expectedRaw !== undefined && current !== expectedRaw)
            throw new Error("另一页面已更新进度，请重新载入后继续");
        if (current !== null)
            readSave(current);
        const checked = validateSave(state);
        if (current !== null && JSON.parse(current).schemaVersion < 3) {
            backupLegacy(storage, current);
            if (storage.getItem(SAVE_KEY) !== current)
                throw new Error('另一页面已更新进度，请重新载入后继续');
        }
        const raw = JSON.stringify(checked);
        storage.setItem(SAVE_KEY, raw);
        return { ok: true, error: null, raw };
    }
    catch (e) {
        return {
            ok: false,
            error: storageMessage(e, true),
            raw: null,
        };
    }
}
function backupLegacy(storage: StorageLike, raw: string) {
    try {
        const key = JSON.parse(raw).schemaVersion === 1 ? BACKUP_KEY : V2_BACKUP_KEY;
        const backup = storage.getItem(key);
        if (backup !== null && backup !== raw)
            throw Error('existing backup differs');
        if (backup !== raw)
            storage.setItem(key, raw);
        if (storage.getItem(key) !== raw)
            throw Error('backup verification');
    }
    catch {
        throw new Error('旧存档备份失败，原件已保留，请检查存储空间后重新载入');
    }
}
