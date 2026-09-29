"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AnalyticsDashboard;
const react_1 = require("react");
const tabs_1 = require("@/components/ui/tabs");
const date_range_picker_1 = require("@/components/date-range-picker");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const sales_overview_dashboard_1 = require("@/components/analytics/sales-overview-dashboard");
const item_analytics_dashboard_1 = require("@/components/analytics/item-analytics-dashboard");
const staff_performance_dashboard_1 = require("@/components/analytics/staff-performance-dashboard");
const customer_analytics_dashboard_1 = require("@/components/analytics/customer-analytics-dashboard");
const inventory_analytics_dashboard_1 = require("@/components/analytics/inventory-analytics-dashboard");
const analytics_header_1 = require("@/components/analytics/analytics-header");
const AnalyticsContext_1 = require("@/context/AnalyticsContext");
const button_1 = require("@/components/ui/button");
const lucide_react_2 = require("lucide-react");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
function AnalyticsDashboard() {
    const [activeTab, setActiveTab] = (0, react_1.useState)("sales");
    const [dateRange, setDateRange] = (0, react_1.useState)({
        from: (0, date_fns_1.subDays)(new Date(), 30),
        to: new Date(),
    });
    const [dateRangePreset, setDateRangePreset] = (0, react_1.useState)("last30");
    const { fetchAnalyticsData, isLoading, exportReportToCsv, exportReportToPdf } = (0, AnalyticsContext_1.useAnalytics)();
    (0, react_1.useEffect)(() => {
        fetchAnalyticsData(dateRange.from, dateRange.to);
    }, [dateRange, fetchAnalyticsData]);
    const handleDateRangePreset = (preset) => {
        setDateRangePreset(preset);
        const now = new Date();
        switch (preset) {
            case "today":
                setDateRange({ from: now, to: now });
                break;
            case "yesterday":
                const yesterday = (0, date_fns_1.subDays)(now, 1);
                setDateRange({ from: yesterday, to: yesterday });
                break;
            case "last7":
                setDateRange({ from: (0, date_fns_1.subDays)(now, 7), to: now });
                break;
            case "last30":
                setDateRange({ from: (0, date_fns_1.subDays)(now, 30), to: now });
                break;
            case "thisWeek":
                setDateRange({ from: (0, date_fns_1.startOfWeek)(now), to: (0, date_fns_1.endOfWeek)(now) });
                break;
            case "thisMonth":
                setDateRange({ from: (0, date_fns_1.startOfMonth)(now), to: (0, date_fns_1.endOfMonth)(now) });
                break;
            default:
                break;
        }
    };
    const handleExport = (format) => {
        const reportType = activeTab;
        const fileName = `${reportType}-report-${format(dateRange.from, "yyyy-MM-dd")}-to-${format(dateRange.to, "yyyy-MM-dd")}`;
        if (format === "csv") {
            exportReportToCsv(reportType, dateRange.from, dateRange.to, fileName);
        }
        else {
            exportReportToPdf(reportType, dateRange.from, dateRange.to, fileName);
        }
    };
    const tabIcons = {
        sales: <lucide_react_2.BarChart3 className="h-4 w-4 mr-2"/>,
        items: <lucide_react_2.ShoppingBag className="h-4 w-4 mr-2"/>,
        staff: <lucide_react_2.Users className="h-4 w-4 mr-2"/>,
        customers: <lucide_react_2.UserCircle className="h-4 w-4 mr-2"/>,
        inventory: <lucide_react_2.Package className="h-4 w-4 mr-2"/>,
    };
    return (<div className="space-y-4">
      <analytics_header_1.AnalyticsHeader title="Analytics & Reporting" description="Comprehensive insights into your restaurant's performance"/>

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="flex flex-wrap gap-2">
          <dropdown_menu_1.DropdownMenu>
            <dropdown_menu_1.DropdownMenuTrigger asChild>
              <button_1.Button variant="outline" className="flex items-center gap-2">
                <lucide_react_2.Calendar className="h-4 w-4"/>
                {dateRangePreset === "custom"
            ? "Custom Range"
            : dateRangePreset === "today"
                ? "Today"
                : dateRangePreset === "yesterday"
                    ? "Yesterday"
                    : dateRangePreset === "last7"
                        ? "Last 7 Days"
                        : dateRangePreset === "last30"
                            ? "Last 30 Days"
                            : dateRangePreset === "thisWeek"
                                ? "This Week"
                                : "This Month"}
                <lucide_react_2.ChevronDown className="h-4 w-4"/>
              </button_1.Button>
            </dropdown_menu_1.DropdownMenuTrigger>
            <dropdown_menu_1.DropdownMenuContent align="start">
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleDateRangePreset("today")}>Today</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleDateRangePreset("yesterday")}>Yesterday</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleDateRangePreset("last7")}>Last 7 Days</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleDateRangePreset("last30")}>Last 30 Days</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleDateRangePreset("thisWeek")}>This Week</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleDateRangePreset("thisMonth")}>This Month</dropdown_menu_1.DropdownMenuItem>
            </dropdown_menu_1.DropdownMenuContent>
          </dropdown_menu_1.DropdownMenu>

          <date_range_picker_1.DateRangePicker date={dateRange} onDateChange={(newRange) => {
            setDateRange(newRange);
            setDateRangePreset("custom");
        }}/>
        </div>

        <div className="flex gap-2">
          <dropdown_menu_1.DropdownMenu>
            <dropdown_menu_1.DropdownMenuTrigger asChild>
              <button_1.Button variant="outline" className="flex items-center gap-2">
                <lucide_react_2.Download className="h-4 w-4"/>
                Export
                <lucide_react_2.ChevronDown className="h-4 w-4"/>
              </button_1.Button>
            </dropdown_menu_1.DropdownMenuTrigger>
            <dropdown_menu_1.DropdownMenuContent align="end">
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onClick={() => handleExport("pdf")}>Export as PDF</dropdown_menu_1.DropdownMenuItem>
            </dropdown_menu_1.DropdownMenuContent>
          </dropdown_menu_1.DropdownMenu>
        </div>
      </div>

      <tabs_1.Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <tabs_1.TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <tabs_1.TabsTrigger value="sales" className="flex items-center">
            {tabIcons.sales} Sales
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="items" className="flex items-center">
            {tabIcons.items} Menu Items
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="staff" className="flex items-center">
            {tabIcons.staff} Staff
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="customers" className="flex items-center">
            {tabIcons.customers} Customers
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="inventory" className="flex items-center">
            {tabIcons.inventory} Inventory
          </tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        {isLoading ? (<div className="flex items-center justify-center py-10">
            <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
          </div>) : (<>
            <tabs_1.TabsContent value="sales" className="space-y-4">
              <sales_overview_dashboard_1.SalesOverviewDashboard dateRange={dateRange}/>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="items" className="space-y-4">
              <item_analytics_dashboard_1.ItemAnalyticsDashboard dateRange={dateRange}/>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="staff" className="space-y-4">
              <staff_performance_dashboard_1.StaffPerformanceDashboard dateRange={dateRange}/>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="customers" className="space-y-4">
              <customer_analytics_dashboard_1.CustomerAnalyticsDashboard dateRange={dateRange}/>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="inventory" className="space-y-4">
              <inventory_analytics_dashboard_1.InventoryAnalyticsDashboard dateRange={dateRange}/>
            </tabs_1.TabsContent>
          </>)}
      </tabs_1.Tabs>
    </div>);
}
