"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftTracker = ShiftTracker;
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
const auth_1 = require("@/lib/auth");
function ShiftTracker() {
    const { state, startShift, endShift } = (0, AuthContext_1.useAuth)();
    const { user, currentShift } = state;
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [currentTime, setCurrentTime] = (0, react_1.useState)(new Date());
    // Update current time every minute
    (0, react_1.useState)(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(interval);
    });
    const handleStartShift = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await startShift();
        }
        catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            }
            else if (typeof err === "string") {
                setError(err);
            }
            else {
                setError("Failed to start shift");
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleEndShift = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await endShift();
        }
        catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            }
            else if (typeof err === "string") {
                setError(err);
            }
            else {
                setError("Failed to end shift");
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    if (!user) {
        return null;
    }
    return (<card_1.Card>
      <card_1.CardHeader className="space-y-1">
        <card_1.CardTitle className="text-xl">Shift Tracker</card_1.CardTitle>
        <card_1.CardDescription>Track your working hours</card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        {error && (<alert_1.Alert variant="destructive" className="mb-4">
            <lucide_react_1.AlertCircle className="h-4 w-4"/>
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        <div className="space-y-4">
          {currentShift ? (<div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <lucide_react_1.Clock className="h-5 w-5"/>
                <span className="font-medium">Shift in progress</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Started at</p>
                  <p className="font-medium">
                    {new Date(currentShift.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{(0, auth_1.formatDuration)(currentShift.startTime, currentTime.toISOString())}</p>
                </div>
              </div>

              <button_1.Button variant="destructive" className="w-full" onClick={handleEndShift} disabled={isLoading}>
                <lucide_react_1.StopCircle className="mr-2 h-4 w-4"/>
                {isLoading ? "Ending shift..." : "End Shift"}
              </button_1.Button>
            </div>) : (<div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <lucide_react_1.Clock className="h-5 w-5"/>
                <span>No active shift</span>
              </div>

              <button_1.Button variant="default" className="w-full" onClick={handleStartShift} disabled={isLoading}>
                <lucide_react_1.PlayCircle className="mr-2 h-4 w-4"/>
                {isLoading ? "Starting shift..." : "Start Shift"}
              </button_1.Button>
            </div>)}

          {user.shifts && user.shifts.length > 0 && (<div className="mt-6 space-y-2">
              <h3 className="font-medium">Recent Shifts</h3>
              <div className="space-y-2">
                {user.shifts
                .filter((shift) => shift.id !== (currentShift === null || currentShift === void 0 ? void 0 : currentShift.id))
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .slice(0, 5)
                .map((shift) => (<div key={shift.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="text-sm">{new Date(shift.startTime).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(shift.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
                          {shift.endTime &&
                    ` - ${new Date(shift.endTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {shift.hoursWorked ? `${shift.hoursWorked} hrs` : "In progress"}
                        </p>
                      </div>
                    </div>))}
              </div>
            </div>)}
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
