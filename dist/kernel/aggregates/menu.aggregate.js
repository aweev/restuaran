"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuItemAggregate = void 0;
const types_1 = require("@/kernel/types");
const aggregate_1 = require("./aggregate");
class MenuItemAggregate extends aggregate_1.Aggregate {
    constructor(tenant) {
        super(MenuItemAggregate.TYPE, tenant, {
            name: "",
            categoryId: "",
            basePrice: 0,
            available: true,
            eightySixed: false,
            eightySixReason: null,
            cost: 0,
            image: null,
            allergens: [],
            modifiers: [],
            priceHistory: [],
        });
    }
    static create(tenant, opts) {
        var _a, _b, _c, _d;
        const agg = new MenuItemAggregate(tenant);
        agg.initialize(opts.id);
        if (!((_a = opts.name) === null || _a === void 0 ? void 0 : _a.trim()))
            throw (0, types_1.kernelError)("INVALID_MENU_ITEM", "Name is required");
        if (!Number.isFinite(opts.basePrice) || opts.basePrice < 0) {
            throw (0, types_1.kernelError)("INVALID_MENU_ITEM", "Base price must be a non-negative number");
        }
        agg.raise("menu.itemCreated", {
            name: opts.name,
            categoryId: opts.categoryId,
            basePrice: opts.basePrice,
            cost: (_b = opts.cost) !== null && _b !== void 0 ? _b : 0,
            image: (_c = opts.image) !== null && _c !== void 0 ? _c : null,
            allergens: (_d = opts.allergens) !== null && _d !== void 0 ? _d : [],
        }, opts.actor);
        return agg;
    }
    changePrice(actor, price) {
        if (!Number.isFinite(price) || price < 0)
            throw (0, types_1.kernelError)("INVALID_PRICE", "Price must be a non-negative number");
        this.raise("menu.priceChanged", { basePrice: price }, actor);
    }
    setAvailability(actor, available) {
        if (this.state.eightySixed && available) {
            throw (0, types_1.kernelError)("CLEAR_86_FIRST", "Clear the 86 before marking the item available");
        }
        this.raise("menu.availabilityChanged", { available }, actor);
    }
    eightySix(actor, reason) {
        this.raise("menu.eightySixed", { eightySixed: true, eightySixReason: reason, available: false }, actor);
    }
    clearEightySix(actor) {
        if (!this.state.eightySixed)
            throw (0, types_1.kernelError)("NOT_86D", "Item is not 86'd");
        this.raise("menu.eightySixCleared", { eightySixed: false, eightySixReason: null, available: true }, actor);
    }
    addModifierGroup(actor, group) {
        var _a;
        this.raise("menu.modifierGroupAdded", {
            group: Object.assign(Object.assign({}, group), { groupId: (_a = group.groupId) !== null && _a !== void 0 ? _a : crypto.randomUUID() }),
        }, actor);
    }
    sellable() {
        return this.state.available && !this.state.eightySixed;
    }
    margin() {
        return this.state.basePrice - this.state.cost;
    }
    applyEvent(event) {
        var _a, _b, _c, _d;
        const s = this.state;
        switch (event.eventType) {
            case "menu.itemCreated":
                return Object.assign(Object.assign(Object.assign({}, s), event.payload), { priceHistory: [
                        { price: Number(event.payload.basePrice), at: event.occurredAt, by: (_b = (_a = event.actor) === null || _a === void 0 ? void 0 : _a.userId) !== null && _b !== void 0 ? _b : "system" },
                    ] });
            case "menu.priceChanged":
                return Object.assign(Object.assign({}, s), { basePrice: Number(event.payload.basePrice), priceHistory: [
                        ...s.priceHistory,
                        { price: Number(event.payload.basePrice), at: event.occurredAt, by: (_d = (_c = event.actor) === null || _c === void 0 ? void 0 : _c.userId) !== null && _d !== void 0 ? _d : "system" },
                    ] });
            case "menu.availabilityChanged":
            case "menu.eightySixed":
            case "menu.eightySixCleared":
                return Object.assign(Object.assign({}, s), event.payload);
            case "menu.modifierGroupAdded":
                return Object.assign(Object.assign({}, s), { modifiers: [...s.modifiers, event.payload.group] });
            default:
                return s;
        }
    }
}
exports.MenuItemAggregate = MenuItemAggregate;
MenuItemAggregate.TYPE = "MenuItem";
