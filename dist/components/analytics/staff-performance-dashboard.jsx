"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffPerformanceDashboard = StaffPerformanceDashboard;
const card_1 = require("@/components/ui/card");
const AnalyticsContext_1 = require("@/context/AnalyticsContext");
const recharts_1 = require("recharts");
const table_1 = require("@/components/ui/table");
const avatar_1 = require("@/components/ui/avatar");
const badge_1 = require("@/components/ui/badge");
function StaffPerformanceDashboard({ dateRange }) {
    var _a, _b, _c;
    const { staffData } = (0, AnalyticsContext_1.useAnalytics)();
    if (!staffData) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Staff Performance</card_1.CardTitle>
          <card_1.CardDescription>No staff data available for the selected period</card_1.CardDescription>
        </card_1.CardHeader>
      </card_1.Card>);
    }
    return (<div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Top Performer</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="flex items-center space-x-2">
              <avatar_1.Avatar className="h-10 w-10">
                <avatar_1.AvatarFallback>{((_a = staffData.topPerformers[0]) === null || _a === void 0 ? void 0 : _a.name.charAt(0)) || "?"}</avatar_1.AvatarFallback>
              </avatar_1.Avatar>
              <div>
                <div className="text-xl font-bold">{((_b = staffData.topPerformers[0]) === null || _b === void 0 ? void 0 : _b.name) || "N/A"}</div>
                <p className="text-xs text-muted-foreground">
                  ${((_c = staffData.topPerformers[0]) === null || _c === void 0 ? void 0 : _c.totalSales.toFixed(2)) || "0"} in sales
                </p>
              </div>
            </div>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Average Order Time</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{staffData.averageOrderProcessingTime.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground">Average time to complete an order</p>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Tips</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">${staffData.totalTips.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Avg. ${staffData.averageTipsPerStaff.toFixed(2)} per staff</p>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Staff Count</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{staffData.staffPerformance.length}</div>
            <p className="text-xs text-muted-foreground">Active staff in period</p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Staff Sales Performance</card_1.CardTitle>
            <card_1.CardDescription>Total sales by staff member</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="h-[400px]">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.BarChart data={staffData.staffPerformance} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                <recharts_1.XAxis type="number"/>
                <recharts_1.YAxis type="category" dataKey="name" width={100}/>
                <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                <recharts_1.Legend />
                <recharts_1.Bar dataKey="totalSales" name="Total Sales" fill="#4ade80"/>
              </recharts_1.BarChart>
            </recharts_1.ResponsiveContainer>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Staff Performance by Day</card_1.CardTitle>
            <card_1.CardDescription>Sales trends over time by staff</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="h-[400px]">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.LineChart data={staffData.staffPerformanceByDay} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                <recharts_1.XAxis dataKey="day"/>
                <recharts_1.YAxis />
                <recharts_1.Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`}/>
                <recharts_1.Legend />
                <recharts_1.Line type="monotone" dataKey="sales" name="Sales" stroke="#4ade80" activeDot={{ r: 8 }}/>
                <recharts_1.Line type="monotone" dataKey="orders" name="Orders" stroke="#f97316"/>
              </recharts_1.LineChart>
            </recharts_1.ResponsiveContainer>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Detailed Staff Performance</card_1.CardTitle>
          <card_1.CardDescription>Comprehensive view of all staff metrics</card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <table_1.Table>
            <table_1.TableHeader>
              <table_1.TableRow>
                <table_1.TableHead>Staff</table_1.TableHead>
                <table_1.TableHead>Role</table_1.TableHead>
                <table_1.TableHead className="text-right">Orders</table_1.TableHead>
                <table_1.TableHead className="text-right">Sales</table_1.TableHead>
                <table_1.TableHead className="text-right">Avg. Order</table_1.TableHead>
                <table_1.TableHead className="text-right">Tips</table_1.TableHead>
                <table_1.TableHead className="text-right">Avg. Time</table_1.TableHead>
                <table_1.TableHead className="text-right">Tables</table_1.TableHead>
              </table_1.TableRow>
            </table_1.TableHeader>
            <table_1.TableBody>
              {staffData.staffPerformance.map((staff) => (<table_1.TableRow key={staff.id}>
                  <table_1.TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <avatar_1.Avatar className="h-8 w-8">
                        <avatar_1.AvatarFallback>{staff.name.charAt(0)}</avatar_1.AvatarFallback>
                      </avatar_1.Avatar>
                      <span>{staff.name}</span>
                    </div>
                  </table_1.TableCell>
                  <table_1.TableCell>
                    <badge_1.Badge variant="outline">{staff.role}</badge_1.Badge>
                  </table_1.TableCell>
                  <table_1.TableCell className="text-right">{staff.ordersProcessed}</table_1.TableCell>
                  <table_1.TableCell className="text-right">${staff.totalSales.toFixed(2)}</table_1.TableCell>
                  <table_1.TableCell className="text-right">${staff.averageOrderValue.toFixed(2)}</table_1.TableCell>
                  <table_1.TableCell className="text-right">${staff.tips.toFixed(2)}</table_1.TableCell>
                  <table_1.TableCell className="text-right">{staff.averageOrderTime.toFixed(1)} min</table_1.TableCell>
                  <table_1.TableCell className="text-right">{staff.tablesServed}</table_1.TableCell>
                </table_1.TableRow>))}
            </table_1.TableBody>
          </table_1.Table>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}
