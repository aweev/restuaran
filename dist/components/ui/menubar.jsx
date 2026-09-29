"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Menubar = Menubar;
exports.MenubarPortal = MenubarPortal;
exports.MenubarMenu = MenubarMenu;
exports.MenubarTrigger = MenubarTrigger;
exports.MenubarContent = MenubarContent;
exports.MenubarGroup = MenubarGroup;
exports.MenubarSeparator = MenubarSeparator;
exports.MenubarLabel = MenubarLabel;
exports.MenubarItem = MenubarItem;
exports.MenubarShortcut = MenubarShortcut;
exports.MenubarCheckboxItem = MenubarCheckboxItem;
exports.MenubarRadioGroup = MenubarRadioGroup;
exports.MenubarRadioItem = MenubarRadioItem;
exports.MenubarSub = MenubarSub;
exports.MenubarSubTrigger = MenubarSubTrigger;
exports.MenubarSubContent = MenubarSubContent;
const React = __importStar(require("react"));
const MenubarPrimitive = __importStar(require("@radix-ui/react-menubar"));
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
function Menubar(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<MenubarPrimitive.Root data-slot="menubar" className={(0, utils_1.cn)("bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs", className)} {...props}/>);
}
function MenubarMenu(_a) {
    var props = __rest(_a, []);
    return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props}/>;
}
function MenubarGroup(_a) {
    var props = __rest(_a, []);
    return <MenubarPrimitive.Group data-slot="menubar-group" {...props}/>;
}
function MenubarPortal(_a) {
    var props = __rest(_a, []);
    return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props}/>;
}
function MenubarRadioGroup(_a) {
    var props = __rest(_a, []);
    return (<MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props}/>);
}
function MenubarTrigger(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<MenubarPrimitive.Trigger data-slot="menubar-trigger" className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none", className)} {...props}/>);
}
function MenubarContent(_a) {
    var { className, align = "start", alignOffset = -4, sideOffset = 8 } = _a, props = __rest(_a, ["className", "align", "alignOffset", "sideOffset"]);
    return (<MenubarPortal>
      <MenubarPrimitive.Content data-slot="menubar-content" align={align} alignOffset={alignOffset} sideOffset={sideOffset} className={(0, utils_1.cn)("bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-md", className)} {...props}/>
    </MenubarPortal>);
}
function MenubarItem(_a) {
    var { className, inset, variant = "default" } = _a, props = __rest(_a, ["className", "inset", "variant"]);
    return (<MenubarPrimitive.Item data-slot="menubar-item" data-inset={inset} data-variant={variant} className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}/>);
}
function MenubarCheckboxItem(_a) {
    var { className, children, checked } = _a, props = __rest(_a, ["className", "children", "checked"]);
    return (<MenubarPrimitive.CheckboxItem data-slot="menubar-checkbox-item" className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} checked={checked} {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <lucide_react_1.CheckIcon className="size-4"/>
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>);
}
function MenubarRadioItem(_a) {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    return (<MenubarPrimitive.RadioItem data-slot="menubar-radio-item" className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <lucide_react_1.CircleIcon className="size-2 fill-current"/>
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>);
}
function MenubarLabel(_a) {
    var { className, inset } = _a, props = __rest(_a, ["className", "inset"]);
    return (<MenubarPrimitive.Label data-slot="menubar-label" data-inset={inset} className={(0, utils_1.cn)("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)} {...props}/>);
}
function MenubarSeparator(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<MenubarPrimitive.Separator data-slot="menubar-separator" className={(0, utils_1.cn)("bg-border -mx-1 my-1 h-px", className)} {...props}/>);
}
function MenubarShortcut(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<span data-slot="menubar-shortcut" className={(0, utils_1.cn)("text-muted-foreground ml-auto text-xs tracking-widest", className)} {...props}/>);
}
function MenubarSub(_a) {
    var props = __rest(_a, []);
    return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props}/>;
}
function MenubarSubTrigger(_a) {
    var { className, inset, children } = _a, props = __rest(_a, ["className", "inset", "children"]);
    return (<MenubarPrimitive.SubTrigger data-slot="menubar-sub-trigger" data-inset={inset} className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8", className)} {...props}>
      {children}
      <lucide_react_1.ChevronRightIcon className="ml-auto h-4 w-4"/>
    </MenubarPrimitive.SubTrigger>);
}
function MenubarSubContent(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<MenubarPrimitive.SubContent data-slot="menubar-sub-content" className={(0, utils_1.cn)("bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg", className)} {...props}/>);
}
