"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTable = exports.TableProvider = void 0;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Initial state
const initialState = {
    tables: [],
    loading: false,
    error: null,
    selectedTable: null,
};
// Reducer
const tableReducer = (state, action) => {
    switch (action.type) {
        case "FETCH_TABLES_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_TABLES_SUCCESS":
            return Object.assign(Object.assign({}, state), { tables: Array.isArray(action.payload) ? action.payload : [], loading: false });
        case "FETCH_TABLES_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "SELECT_TABLE":
            return Object.assign(Object.assign({}, state), { selectedTable: action.payload });
        case "UPDATE_TABLE_STATUS":
            return Object.assign(Object.assign({}, state), { tables: state.tables.map((table) => table.id === action.payload.tableId ? Object.assign(Object.assign({}, table), { status: action.payload.status }) : table) });
        case "OCCUPY_TABLE":
            return Object.assign(Object.assign({}, state), { tables: state.tables.map((table) => table.id === action.payload.tableId
                    ? Object.assign(Object.assign({}, table), { status: "occupied", customerName: action.payload.customerName, customerCount: action.payload.customerCount, serverName: action.payload.serverName, startTime: new Date().toISOString() }) : table) });
        case "RESERVE_TABLE":
            return Object.assign(Object.assign({}, state), { tables: state.tables.map((table) => table.id === action.payload.tableId
                    ? Object.assign(Object.assign({}, table), { status: "reserved", customerName: action.payload.customerName, customerCount: action.payload.customerCount, startTime: action.payload.startTime }) : table) });
        case "CLEAR_TABLE":
            return Object.assign(Object.assign({}, state), { tables: state.tables.map((table) => table.id === action.payload
                    ? Object.assign(Object.assign({}, table), { status: "dirty", customerName: undefined, customerCount: undefined, serverName: undefined, startTime: undefined, orderId: undefined }) : table) });
        case "UPDATE_TABLE_POSITION":
            return Object.assign(Object.assign({}, state), { tables: state.tables.map((table) => table.id === action.payload.tableId ? Object.assign(Object.assign({}, table), { position: action.payload.position }) : table) });
        case "ADD_TABLE":
            return Object.assign(Object.assign({}, state), { tables: [...state.tables, action.payload] });
        case "REMOVE_TABLE":
            return Object.assign(Object.assign({}, state), { tables: state.tables.filter((table) => table.id !== action.payload) });
        default:
            return state;
    }
};
const TableContext = (0, react_1.createContext)(undefined);
// Provider component
const TableProvider = ({ children }) => {
    const [state, dispatch] = (0, react_1.useReducer)(tableReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Fetch tables when component mounts
    (0, react_1.useEffect)(() => {
        if (authState.isAuthenticated) {
            fetchTables();
        }
    }, [authState.isAuthenticated]);
    // Actions
    const fetchTables = (0, react_1.useCallback)(async () => {
        dispatch({ type: "FETCH_TABLES_START" });
        try {
            const response = await fetch("/api/tables", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch tables");
            }
            const data = await response.json();
            // Transform data to match our Table type
            const tables = data.map((table) => (Object.assign(Object.assign({}, table), { position: { x: table.positionX, y: table.positionY } })));
            dispatch({
                type: "FETCH_TABLES_SUCCESS",
                payload: tables,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_TABLES_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch tables",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authState.token]);
    const selectTable = (table) => {
        dispatch({ type: "SELECT_TABLE", payload: table });
    };
    const updateTableStatus = async (tableId, status) => {
        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ status }),
            });
            if (!response.ok) {
                throw new Error("Failed to update table status");
            }
            dispatch({
                type: "UPDATE_TABLE_STATUS",
                payload: { tableId, status },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update table status");
        }
    };
    const occupyTable = async (tableId, customerName, customerCount, serverName) => {
        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    status: "occupied",
                    customerName,
                    customerCount,
                    serverName,
                    startTime: new Date().toISOString(),
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to occupy table");
            }
            dispatch({
                type: "OCCUPY_TABLE",
                payload: { tableId, customerName, customerCount, serverName },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to occupy table");
        }
    };
    const reserveTable = async (tableId, customerName, customerCount, startTime) => {
        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    status: "reserved",
                    customerName,
                    customerCount,
                    startTime,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to reserve table");
            }
            dispatch({
                type: "RESERVE_TABLE",
                payload: { tableId, customerName, customerCount, startTime },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to reserve table");
        }
    };
    const clearTable = async (tableId) => {
        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    status: "dirty",
                    customerName: null,
                    customerCount: null,
                    serverName: null,
                    startTime: null,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to clear table");
            }
            dispatch({ type: "CLEAR_TABLE", payload: tableId });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to clear table");
        }
    };
    const updateTablePosition = async (tableId, position) => {
        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    positionX: position.x,
                    positionY: position.y,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to update table position");
            }
            dispatch({
                type: "UPDATE_TABLE_POSITION",
                payload: { tableId, position },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update table position");
        }
    };
    const addTable = async (table) => {
        try {
            const response = await fetch("/api/tables", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    number: table.number,
                    capacity: table.capacity,
                    status: table.status,
                    positionX: table.position.x,
                    positionY: table.position.y,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to add table");
            }
            const newTable = await response.json();
            dispatch({
                type: "ADD_TABLE",
                payload: Object.assign(Object.assign({}, newTable), { position: { x: newTable.positionX, y: newTable.positionY } }),
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to add table");
        }
    };
    const removeTable = async (tableId) => {
        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to remove table");
            }
            dispatch({ type: "REMOVE_TABLE", payload: tableId });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to remove table");
        }
    };
    return (<TableContext.Provider value={{
            state,
            fetchTables,
            selectTable,
            updateTableStatus,
            occupyTable,
            reserveTable,
            clearTable,
            updateTablePosition,
            addTable,
            removeTable,
        }}>
      {children}
    </TableContext.Provider>);
};
exports.TableProvider = TableProvider;
// Custom hook
const useTable = () => {
    const context = (0, react_1.useContext)(TableContext);
    if (context === undefined) {
        throw new Error("useTable must be used within a TableProvider");
    }
    return context;
};
exports.useTable = useTable;
