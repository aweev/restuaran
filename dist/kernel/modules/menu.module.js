"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noSoldItems86dPolicy = void 0;
exports.menuBoardProjection = menuBoardProjection;
exports.menuModule = menuModule;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
const define_command_1 = require("@/kernel/commands/define-command");
const menu_aggregate_1 = require("@/kernel/aggregates/menu.aggregate");
const projection_1 = require("@/kernel/projections/projection");
function menuBoardProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "menu.board",
        initial: { items: [] },
        watchedEventTypes: [
            "menu.itemCreated",
            "menu.priceChanged",
            "menu.availabilityChanged",
            "menu.eightySixed",
            "menu.eightySixCleared",
            "menu.modifierGroupAdded",
        ],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e, _f;
            const items = [...state.items];
            const idx = items.findIndex((i) => i.id === event.aggregateId);
            const p = event.payload;
            const base = idx >= 0
                ? items[idx]
                : { id: event.aggregateId, name: "", categoryId: "", price: 0, cost: 0, margin: 0, available: true, eightySixed: false, allergens: [] };
            const next = Object.assign({}, base);
            switch (event.eventType) {
                case "menu.itemCreated":
                    next.name = String((_a = p.name) !== null && _a !== void 0 ? _a : "");
                    next.categoryId = String((_b = p.categoryId) !== null && _b !== void 0 ? _b : "");
                    next.price = Number((_c = p.basePrice) !== null && _c !== void 0 ? _c : 0);
                    next.cost = Number((_d = p.cost) !== null && _d !== void 0 ? _d : 0);
                    next.allergens = (_e = p.allergens) !== null && _e !== void 0 ? _e : [];
                    break;
                case "menu.priceChanged":
                    next.price = Number((_f = p.basePrice) !== null && _f !== void 0 ? _f : next.price);
                    break;
                case "menu.availabilityChanged":
                    next.available = Boolean(p.available);
                    break;
                case "menu.eightySixed":
                    next.eightySixed = true;
                    next.available = false;
                    break;
                case "menu.eightySixCleared":
                    next.eightySixed = false;
                    next.available = true;
                    break;
            }
            next.margin = next.price - next.cost;
            if (idx >= 0)
                items[idx] = next;
            else
                items.push(next);
            return { items };
        },
    }, store, tenant);
}
const createItem = (0, define_command_1.defineCommand)({
    commandType: "menu.createItem",
    requiredPermission: "menu:manage",
    async execute(ctx) {
        var _a, _b, _c, _d;
        const id = (_a = ctx.payload.itemId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)();
        const agg = menu_aggregate_1.MenuItemAggregate.create(ctx.tenant, {
            id,
            actor: ctx.actor,
            name: String((_b = ctx.payload.name) !== null && _b !== void 0 ? _b : ""),
            categoryId: String((_c = ctx.payload.categoryId) !== null && _c !== void 0 ? _c : ""),
            basePrice: Number((_d = ctx.payload.basePrice) !== null && _d !== void 0 ? _d : 0),
            cost: ctx.payload.cost ? Number(ctx.payload.cost) : undefined,
            image: ctx.payload.image ? String(ctx.payload.image) : undefined,
            allergens: ctx.payload.allergens,
        });
        await ctx.commit(agg);
        return id;
    },
});
const changePrice = (0, define_command_1.defineCommand)({
    commandType: "menu.changePrice",
    requiredPermission: "menu:manage",
    async execute(ctx) {
        const id = String(ctx.payload.itemId);
        const agg = await ctx.load(menu_aggregate_1.MenuItemAggregate.TYPE, id);
        agg.changePrice(ctx.actor, Number(ctx.payload.price));
        await ctx.commit(agg);
        return id;
    },
});
const setAvailability = (0, define_command_1.defineCommand)({
    commandType: "menu.setAvailability",
    requiredPermission: "menu:manage",
    async execute(ctx) {
        const id = String(ctx.payload.itemId);
        const agg = await ctx.load(menu_aggregate_1.MenuItemAggregate.TYPE, id);
        agg.setAvailability(ctx.actor, Boolean(ctx.payload.available));
        await ctx.commit(agg);
        return id;
    },
});
const eightySix = (0, define_command_1.defineCommand)({
    commandType: "menu.eightySix",
    requiredPermission: "menu:manage",
    async execute(ctx) {
        var _a;
        const id = String(ctx.payload.itemId);
        const agg = await ctx.load(menu_aggregate_1.MenuItemAggregate.TYPE, id);
        agg.eightySix(ctx.actor, String((_a = ctx.payload.reason) !== null && _a !== void 0 ? _a : "out of stock"));
        await ctx.commit(agg);
        return id;
    },
});
const clearEightySix = (0, define_command_1.defineCommand)({
    commandType: "menu.clearEightySix",
    requiredPermission: "menu:manage",
    async execute(ctx) {
        const id = String(ctx.payload.itemId);
        const agg = await ctx.load(menu_aggregate_1.MenuItemAggregate.TYPE, id);
        agg.clearEightySix(ctx.actor);
        await ctx.commit(agg);
        return id;
    },
});
const addModifierGroup = (0, define_command_1.defineCommand)({
    commandType: "menu.addModifierGroup",
    requiredPermission: "menu:manage",
    async execute(ctx) {
        const id = String(ctx.payload.itemId);
        const agg = await ctx.load(menu_aggregate_1.MenuItemAggregate.TYPE, id);
        agg.addModifierGroup(ctx.actor, ctx.payload.group);
        await ctx.commit(agg);
        return id;
    },
});
/**
 * Cross-module policy: an order line cannot reference an item that is 86'd.
 * This is the flagship example of a module enforcing a rule on *another* module's
 * command — impossible in a monolithic POS where order logic and menu logic are
 * tangled in the same file.
 */
exports.noSoldItems86dPolicy = {
    id: "ros.menu.noSoldItems86d",
    async check(command, deps) {
        if (command.commandType !== "order.addLine")
            return null;
        const menuItemId = command.payload.menuItemId;
        if (!menuItemId)
            return null;
        const agg = await deps.repository.read(menu_aggregate_1.MenuItemAggregate.TYPE, deps.tenant, menuItemId);
        // Unknown item id is a referential concern, not this module's; only veto
        // items the venue has explicitly made unsellable (86'd / unavailable).
        if (agg.version === 0)
            return null;
        if (!agg.sellable()) {
            return (0, types_1.kernelError)("MENU_ITEM_UNAVAILABLE", agg.state.eightySixed
                ? `"${agg.state.name}" is 86'd${agg.state.eightySixReason ? `: ${agg.state.eightySixReason}` : ""}`
                : `"${agg.state.name}" is not available`);
        }
        return null;
    },
};
const getItem = {
    queryType: "get.menuItem",
    requiredPermission: "menu:view",
    async handle(params, ctx) {
        const agg = await ctx.repository.load(menu_aggregate_1.MenuItemAggregate.TYPE, ctx.tenant, String(params.itemId));
        return { id: agg.id, version: agg.version, state: agg.state, sellable: agg.sellable(), margin: agg.margin() };
    },
};
const listMenu = {
    queryType: "list.menu",
    requiredPermission: "menu:view",
    async handle(_params, ctx) {
        return ctx.projections.get("menu.board").state.items;
    },
};
const listSellable = {
    queryType: "list.menu.sellable",
    requiredPermission: "menu:view",
    async handle(_params, ctx) {
        return ctx.projections.get("menu.board").state.items.filter((i) => i.available && !i.eightySixed);
    },
};
function menuModule() {
    return {
        id: "ros.menu",
        name: "Menu",
        version: "1.0.0",
        capabilities: {
            commands: [
                "menu.createItem", "menu.changePrice", "menu.setAvailability",
                "menu.eightySix", "menu.clearEightySix", "menu.addModifierGroup",
            ],
            queries: ["get.menuItem", "list.menu", "list.menu.sellable"],
            eventTypes: [
                "menu.itemCreated", "menu.priceChanged", "menu.availabilityChanged",
                "menu.eightySixed", "menu.eightySixCleared", "menu.modifierGroupAdded",
            ],
        },
        lifecycle: {
            async install(runtime) {
                runtime.projections.register(menuBoardProjection(runtime.events, runtime.tenant));
            },
            async activate(runtime) {
                runtime.commands.register(createItem);
                runtime.commands.register(changePrice);
                runtime.commands.register(setAvailability);
                runtime.commands.register(eightySix);
                runtime.commands.register(clearEightySix);
                runtime.commands.register(addModifierGroup);
                runtime.commands.use(exports.noSoldItems86dPolicy);
                runtime.queries.register(getItem);
                runtime.queries.register(listMenu);
                runtime.queries.register(listSellable);
            },
            async deactivate(runtime) {
                var _a, _b;
                (_b = (_a = runtime.commands).removePolicy) === null || _b === void 0 ? void 0 : _b.call(_a, exports.noSoldItems86dPolicy.id);
            },
        },
    };
}
