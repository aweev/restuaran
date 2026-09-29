"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, type ReactNode } from "react"
import type { TableState, Table, TableStatus } from "@/types"
import { useAuth } from "./AuthContext"

// Initial state
const initialState: TableState = {
  tables: [],
  loading: false,
  error: null,
  selectedTable: null,
}

// Action types
type TableAction =
  | { type: "FETCH_TABLES_START" }
  | { type: "FETCH_TABLES_SUCCESS"; payload: Table[] }
  | { type: "FETCH_TABLES_FAILURE"; payload: string }
  | { type: "SELECT_TABLE"; payload: Table | null }
  | { type: "UPDATE_TABLE_STATUS"; payload: { tableId: string; status: TableStatus } }
  | {
      type: "OCCUPY_TABLE"
      payload: { tableId: string; customerName: string; customerCount: number; serverName: string }
    }
  | {
      type: "RESERVE_TABLE"
      payload: { tableId: string; customerName: string; customerCount: number; startTime: string }
    }
  | { type: "CLEAR_TABLE"; payload: string }
  | { type: "UPDATE_TABLE_POSITION"; payload: { tableId: string; position: { x: number; y: number } } }
  | { type: "ADD_TABLE"; payload: Table }
  | { type: "REMOVE_TABLE"; payload: string }

// Reducer
const tableReducer = (state: TableState, action: TableAction): TableState => {
  switch (action.type) {
    case "FETCH_TABLES_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "FETCH_TABLES_SUCCESS":
      return {
        ...state,
        tables: Array.isArray(action.payload) ? action.payload : [],
        loading: false,
      }
    case "FETCH_TABLES_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "SELECT_TABLE":
      return {
        ...state,
        selectedTable: action.payload,
      }
    case "UPDATE_TABLE_STATUS":
      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.payload.tableId ? { ...table, status: action.payload.status } : table,
        ),
      }
    case "OCCUPY_TABLE":
      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.payload.tableId
            ? {
                ...table,
                status: "occupied",
                customerName: action.payload.customerName,
                customerCount: action.payload.customerCount,
                serverName: action.payload.serverName,
                startTime: new Date().toISOString(),
              }
            : table,
        ),
      }
    case "RESERVE_TABLE":
      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.payload.tableId
            ? {
                ...table,
                status: "reserved",
                customerName: action.payload.customerName,
                customerCount: action.payload.customerCount,
                startTime: action.payload.startTime,
              }
            : table,
        ),
      }
    case "CLEAR_TABLE":
      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.payload
            ? {
                ...table,
                status: "dirty",
                customerName: undefined,
                customerCount: undefined,
                serverName: undefined,
                startTime: undefined,
                orderId: undefined,
              }
            : table,
        ),
      }
    case "UPDATE_TABLE_POSITION":
      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.payload.tableId ? { ...table, position: action.payload.position } : table,
        ),
      }
    case "ADD_TABLE":
      return {
        ...state,
        tables: [...state.tables, action.payload],
      }
    case "REMOVE_TABLE":
      return {
        ...state,
        tables: state.tables.filter((table) => table.id !== action.payload),
      }
    default:
      return state
  }
}

// Create context
interface TableContextType {
  state: TableState
  fetchTables: () => Promise<void>
  selectTable: (table: Table | null) => void
  updateTableStatus: (tableId: string, status: TableStatus) => Promise<void>
  occupyTable: (tableId: string, customerName: string, customerCount: number, serverName: string) => Promise<void>
  reserveTable: (tableId: string, customerName: string, customerCount: number, startTime: string) => Promise<void>
  clearTable: (tableId: string) => Promise<void>
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => Promise<void>
  addTable: (table: Table) => Promise<void>
  removeTable: (tableId: string) => Promise<void>
}

const TableContext = createContext<TableContextType | undefined>(undefined)

// Provider component
export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(tableReducer, initialState)
  const { state: authState } = useAuth()


  // Actions
  const fetchTables = useCallback(async () => {
    dispatch({ type: "FETCH_TABLES_START" })
    try {
      const response = await fetch("/api/tables", {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch tables")
      }

      const data = await response.json()

      // Transform data to match our Table type
      const tables = data.map((table: { positionX: number; positionY: number } & Record<string, unknown>) => ({
        ...table,
        position: { x: table.positionX, y: table.positionY },
      }))

      dispatch({
        type: "FETCH_TABLES_SUCCESS",
        payload: tables,
      })
    } catch (error) {
      dispatch({
        type: "FETCH_TABLES_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to fetch tables",
      })
    }
  }, [authState.token])

  // Fetch tables when component mounts
  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchTables()
    }
  }, [authState.isAuthenticated, fetchTables])

  const selectTable = (table: Table | null) => {
    dispatch({ type: "SELECT_TABLE", payload: table })
  }

  const updateTableStatus = async (tableId: string, status: TableStatus) => {
    try {
      const response = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error("Failed to update table status")
      }

      dispatch({
        type: "UPDATE_TABLE_STATUS",
        payload: { tableId, status },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update table status")
    }
  }

  const occupyTable = async (tableId: string, customerName: string, customerCount: number, serverName: string) => {
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
      })

      if (!response.ok) {
        throw new Error("Failed to occupy table")
      }

      dispatch({
        type: "OCCUPY_TABLE",
        payload: { tableId, customerName, customerCount, serverName },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to occupy table")
    }
  }

  const reserveTable = async (tableId: string, customerName: string, customerCount: number, startTime: string) => {
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
      })

      if (!response.ok) {
        throw new Error("Failed to reserve table")
      }

      dispatch({
        type: "RESERVE_TABLE",
        payload: { tableId, customerName, customerCount, startTime },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to reserve table")
    }
  }

  const clearTable = async (tableId: string) => {
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
      })

      if (!response.ok) {
        throw new Error("Failed to clear table")
      }

      dispatch({ type: "CLEAR_TABLE", payload: tableId })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to clear table")
    }
  }

  const updateTablePosition = async (tableId: string, position: { x: number; y: number }) => {
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
      })

      if (!response.ok) {
        throw new Error("Failed to update table position")
      }

      dispatch({
        type: "UPDATE_TABLE_POSITION",
        payload: { tableId, position },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update table position")
    }
  }

  const addTable = async (table: Table) => {
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
      })

      if (!response.ok) {
        throw new Error("Failed to add table")
      }

      const newTable = await response.json()

      dispatch({
        type: "ADD_TABLE",
        payload: {
          ...newTable,
          position: { x: newTable.positionX, y: newTable.positionY },
        },
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to add table")
    }
  }

  const removeTable = async (tableId: string) => {
    try {
      const response = await fetch(`/api/tables/${tableId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to remove table")
      }

      dispatch({ type: "REMOVE_TABLE", payload: tableId })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to remove table")
    }
  }

  return (
    <TableContext.Provider
      value={{
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
      }}
    >
      {children}
    </TableContext.Provider>
  )
}

// Custom hook
export const useTable = () => {
  const context = useContext(TableContext)
  if (context === undefined) {
    throw new Error("useTable must be used within a TableProvider")
  }
  return context
}