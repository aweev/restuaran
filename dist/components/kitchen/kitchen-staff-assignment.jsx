"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenStaffAssignment = KitchenStaffAssignment;
const react_1 = require("react");
const KitchenContext_1 = require("@/context/KitchenContext");
const AuthContext_1 = require("@/context/AuthContext");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const select_1 = require("@/components/ui/select");
const table_1 = require("@/components/ui/table");
const lucide_react_1 = require("lucide-react");
const use_toast_1 = require("@/components/ui/use-toast");
const KITCHEN_STATIONS = ["Grill", "Fry", "Salad", "Pizza", "Dessert", "Expo"];
function KitchenStaffAssignment() {
    const { state, fetchStaffAssignments, updateStaffAssignment, removeStaffAssignment } = (0, KitchenContext_1.useKitchen)();
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [newAssignment, setNewAssignment] = (0, react_1.useState)({
        userId: "",
        userName: "",
        station: KITCHEN_STATIONS[0],
    });
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchStaffAssignments();
            }
            catch (error) {
                console.error("Error loading staff assignments:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchStaffAssignments]);
    const handleAddAssignment = async () => {
        if (!newAssignment.userId || !newAssignment.userName || !newAssignment.station) {
            (0, use_toast_1.toast)({
                title: "Missing Information",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }
        try {
            await updateStaffAssignment(Object.assign(Object.assign({}, newAssignment), { assignedOrders: [] }));
            setNewAssignment({
                userId: "",
                userName: "",
                station: KITCHEN_STATIONS[0],
            });
            (0, use_toast_1.toast)({
                title: "Staff Assigned",
                description: `${newAssignment.userName} has been assigned to ${newAssignment.station}`,
            });
        }
        catch (error) {
            console.error("Error adding staff assignment:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to add staff assignment",
                variant: "destructive",
            });
        }
    };
    const handleRemoveAssignment = async (userId, userName) => {
        try {
            await removeStaffAssignment(userId);
            (0, use_toast_1.toast)({
                title: "Staff Removed",
                description: `${userName} has been removed from assignment`,
            });
        }
        catch (error) {
            console.error("Error removing staff assignment:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to remove staff assignment",
                variant: "destructive",
            });
        }
    };
    return (<card_1.Card>
      <card_1.CardHeader>
        <card_1.CardTitle>Kitchen Staff Assignment</card_1.CardTitle>
      </card_1.CardHeader>
      <card_1.CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label_1.Label htmlFor="userId">Staff ID</label_1.Label>
              <input_1.Input id="userId" placeholder="Staff ID" value={newAssignment.userId} onChange={(e) => setNewAssignment(Object.assign(Object.assign({}, newAssignment), { userId: e.target.value }))}/>
            </div>
            <div className="space-y-2">
              <label_1.Label htmlFor="userName">Staff Name</label_1.Label>
              <input_1.Input id="userName" placeholder="Staff Name" value={newAssignment.userName} onChange={(e) => setNewAssignment(Object.assign(Object.assign({}, newAssignment), { userName: e.target.value }))}/>
            </div>
            <div className="space-y-2">
              <label_1.Label htmlFor="station">Station</label_1.Label>
              <select_1.Select value={newAssignment.station} onValueChange={(value) => setNewAssignment(Object.assign(Object.assign({}, newAssignment), { station: value }))}>
                <select_1.SelectTrigger id="station">
                  <select_1.SelectValue placeholder="Select Station"/>
                </select_1.SelectTrigger>
                <select_1.SelectContent>
                  {KITCHEN_STATIONS.map((station) => (<select_1.SelectItem key={station} value={station}>
                      {station}
                    </select_1.SelectItem>))}
                </select_1.SelectContent>
              </select_1.Select>
            </div>
          </div>

          <button_1.Button onClick={handleAddAssignment} className="w-full">
            <lucide_react_1.PlusCircle className="mr-2 h-4 w-4"/>
            Add Staff Assignment
          </button_1.Button>

          <div className="rounded-md border">
            <table_1.Table>
              <table_1.TableHeader>
                <table_1.TableRow>
                  <table_1.TableHead>Staff ID</table_1.TableHead>
                  <table_1.TableHead>Name</table_1.TableHead>
                  <table_1.TableHead>Station</table_1.TableHead>
                  <table_1.TableHead>Assigned Orders</table_1.TableHead>
                  <table_1.TableHead className="text-right">Actions</table_1.TableHead>
                </table_1.TableRow>
              </table_1.TableHeader>
              <table_1.TableBody>
                {state.staffAssignments.length === 0 ? (<table_1.TableRow>
                    <table_1.TableCell colSpan={5} className="h-24 text-center">
                      No staff assignments
                    </table_1.TableCell>
                  </table_1.TableRow>) : (state.staffAssignments.map((assignment) => (<table_1.TableRow key={assignment.userId}>
                      <table_1.TableCell className="font-mono">{assignment.userId}</table_1.TableCell>
                      <table_1.TableCell>{assignment.userName}</table_1.TableCell>
                      <table_1.TableCell>{assignment.station}</table_1.TableCell>
                      <table_1.TableCell>{assignment.assignedOrders.length}</table_1.TableCell>
                      <table_1.TableCell className="text-right">
                        <button_1.Button variant="ghost" size="icon" onClick={() => handleRemoveAssignment(assignment.userId, assignment.userName)}>
                          <lucide_react_1.Trash2 className="h-4 w-4"/>
                        </button_1.Button>
                      </table_1.TableCell>
                    </table_1.TableRow>)))}
              </table_1.TableBody>
            </table_1.Table>
          </div>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
