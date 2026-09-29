"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateRangePicker = DateRangePicker;
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
const button_1 = require("@/components/ui/button");
const calendar_1 = require("@/components/ui/calendar");
const popover_1 = require("@/components/ui/popover");
function DateRangePicker({ date, onDateChange, className }) {
    return (<div className={(0, utils_1.cn)("grid gap-2", className)}>
      <popover_1.Popover>
        <popover_1.PopoverTrigger asChild>
          <button_1.Button id="date" variant={"outline"} className={(0, utils_1.cn)("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <lucide_react_1.CalendarIcon className="mr-2 h-4 w-4"/>
            {(date === null || date === void 0 ? void 0 : date.from) ? (date.to ? (<>
                  {(0, date_fns_1.format)(date.from, "LLL dd, y")} - {(0, date_fns_1.format)(date.to, "LLL dd, y")}
                </>) : ((0, date_fns_1.format)(date.from, "LLL dd, y"))) : (<span>Pick a date</span>)}
          </button_1.Button>
        </popover_1.PopoverTrigger>
        <popover_1.PopoverContent className="w-auto p-0" align="start">
          <calendar_1.Calendar initialFocus mode="range" defaultMonth={date === null || date === void 0 ? void 0 : date.from} selected={date} onSelect={onDateChange} numberOfMonths={2} required={false}/>
        </popover_1.PopoverContent>
      </popover_1.Popover>
    </div>);
}
