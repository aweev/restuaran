"use client"

import { createContext, useReducer, useContext, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type {
  AuthState,
  User,
  UserShift,
  LoginCredentials,
  RegisterUserData,
  UpdateUserData,
  PasswordResetConfirm,
  ChangePasswordData,
  PermissionName,
} from "@/types/auth"
import { hasPermission } from "@/lib/auth"

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
  loading: true,
  error: null,
  currentShift: null,
}

// Action types
type AuthAction =
  | { type: "AUTH_START" }
  | { type: "LOGIN_SUCCESS"; payload: { user: User; accessToken: string } }
  | { type: "LOGIN_FAILURE"; payload: string }
  | { type: "LOGOUT" }
  | { type: "CLEAR_ERROR" }
  | { type: "UPDATE_USER"; payload: User }
  | { type: "START_SHIFT"; payload: UserShift }
  | { type: "END_SHIFT"; payload: UserShift }
  | { type: "REGISTER_SUCCESS"; payload: { user: User; accessToken: string } }
  | { type: "REGISTER_FAILURE"; payload: string }
  | { type: "PASSWORD_RESET_SENT" }
  | { type: "PASSWORD_RESET_FAILURE"; payload: string }
  | { type: "PASSWORD_RESET_SUCCESS" }
  | { type: "PASSWORD_CHANGE_SUCCESS" }
  | { type: "PASSWORD_CHANGE_FAILURE"; payload: string }
  | { type: "SET_ACCESS_TOKEN"; payload: string }
  | { type: "TOKEN_REFRESHED"; payload: { user: User; accessToken: string } }

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "AUTH_START":
      return {
        ...state,
        loading: true,
        error: null,
      }
    case "LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        loading: false,
        error: null,
      }
    case "LOGIN_FAILURE":
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload,
      }
    case "LOGOUT":
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        loading: false,
        currentShift: null,
      }
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      }
    case "UPDATE_USER":
      return {
        ...state,
        user: action.payload,
      }
    case "START_SHIFT":
      return {
        ...state,
        currentShift: action.payload,
        user: state.user
          ? {
              ...state.user,
              shifts: [...(state.user.shifts || []), action.payload],
            }
          : null,
      }
    case "END_SHIFT":
      return {
        ...state,
        currentShift: null,
        user: state.user
          ? {
              ...state.user,
              shifts: (state.user.shifts || []).map((shift) =>
                shift.id === action.payload.id ? action.payload : shift,
              ),
            }
          : null,
      }
    case "REGISTER_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        loading: false,
        error: null,
      }
    case "REGISTER_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "PASSWORD_RESET_SENT":
      return {
        ...state,
        loading: false,
      }
    case "PASSWORD_RESET_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "PASSWORD_RESET_SUCCESS":
      return {
        ...state,
        loading: false,
      }
    case "PASSWORD_CHANGE_SUCCESS":
      return {
        ...state,
        loading: false,
      }
    case "PASSWORD_CHANGE_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.payload,
      }
    case "SET_ACCESS_TOKEN":
      return {
        ...state,
        accessToken: action.payload,
      }
    case "TOKEN_REFRESHED":
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
      }
    default:
      return state
  }
}

// Create context
interface AuthContextType {
  state: AuthState
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  register: (userData: RegisterUserData) => Promise<void>
  updateUser: (userData: UpdateUserData) => Promise<void>
  startShift: () => Promise<void>
  endShift: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (data: PasswordResetConfirm) => Promise<void>
  changePassword: (data: ChangePasswordData) => Promise<void>
  clearError: () => void
  hasPermission: (permission: PermissionName) => boolean
  refreshAccessToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const router = useRouter()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if access token is expired or about to expire
  const isTokenExpiring = useCallback((token: string | null): boolean => {
    if (!token) return true
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      const expiry = payload.exp * 1000
      return Date.now() + REFRESH_THRESHOLD_MS >= expiry
    } catch {
      return true
    }
  }, [])

  // Refresh access token using refresh token cookie
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      dispatch({
        type: "TOKEN_REFRESHED",
        payload: { user: data.user, accessToken: data.accessToken },
      })
      return true
    } catch {
      return false
    }
  }, [])

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((token: string | null) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    if (!token) return

    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      const expiry = payload.exp * 1000
      const delay = Math.max(0, expiry - Date.now() - REFRESH_THRESHOLD_MS)

      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken().then((success) => {
          if (!success) {
            dispatch({ type: "LOGOUT" })
            router.push("/login")
          }
        })
      }, delay)
    } catch {
      // If we can't parse, refresh soon
      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken().then((success) => {
          if (!success) {
            dispatch({ type: "LOGOUT" })
            router.push("/login")
          }
        })
      }, REFRESH_THRESHOLD_MS)
    }
  }, [refreshAccessToken, router])

  // Load user from /api/auth/me on initial render (uses HttpOnly cookie)
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: { user: data.user, accessToken: "" },
          })
          // Trigger immediate refresh to get valid access token
          await refreshAccessToken()
        } else {
          // Try to refresh token before giving up
          const refreshed = await refreshAccessToken()
          if (!refreshed) {
            dispatch({ type: "LOGOUT" })
          }
        }
      } catch (error) {
        console.error("Error loading auth state:", error)
        dispatch({ type: "LOGOUT" })
      }
    }

    loadAuthState()
  }, [refreshAccessToken])

  // Schedule refresh when access token changes
  useEffect(() => {
    scheduleTokenRefresh(state.accessToken)
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [state.accessToken, scheduleTokenRefresh])

  // Actions
  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: "AUTH_START" })
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user: data.user, accessToken: data.accessToken },
      })

      // Redirect based on role
      if (data.user.role === "kitchen") {
        router.push("/dashboard/kitchen/display")
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      dispatch({
        type: "LOGIN_FAILURE",
        payload: error instanceof Error ? error.message : "An error occurred during login",
      })
    }
  }

  const logout = async () => {
    // End shift if active
    if (state.currentShift) {
      try {
        await endShift()
      } catch (error) {
        console.error("Error ending shift during logout:", error)
      }
    }

    // Call logout API
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      console.error("Error during logout:", error)
    }

    // Instruct the service worker to purge any cached authenticated API
    // responses so a shared terminal cannot leak one user's data to the next.
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage("CLEAR_AUTH_CACHE")
    }

    dispatch({ type: "LOGOUT" })
    router.push("/login")
  }

  const register = async (userData: RegisterUserData) => {
    dispatch({ type: "AUTH_START" })
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      dispatch({
        type: "REGISTER_SUCCESS",
        payload: { user: data.user, accessToken: data.accessToken },
      })

      router.push("/dashboard/setup")
    } catch (error) {
      dispatch({
        type: "REGISTER_FAILURE",
        payload: error instanceof Error ? error.message : "An error occurred during registration",
      })
    }
  }

  const authedHeaders = (): HeadersInit => ({
    "Content-Type": "application/json",
    ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
  })

  const kernelPost = async (commandType: string, payload: Record<string, unknown>) => {
    const response = await fetch("/api/kernel", {
      method: "POST",
      headers: authedHeaders(),
      credentials: "include",
      body: JSON.stringify(payload ? { commandType, payload } : { commandType, payload: {} }),
    })
    const data = await response.json()
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error?.message ?? data?.error ?? `Command ${commandType} failed`)
    }
    return data
  }

  const updateUser = async (userData: UpdateUserData) => {
    if (!state.user) return Promise.reject("No user logged in")

    try {
      const response = await fetch(`/api/auth/me`, {
        method: "PATCH",
        headers: authedHeaders(),
        credentials: "include",
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user profile")
      }

      dispatch({
        type: "UPDATE_USER",
        payload: data,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to update user profile")
    }
  }

  const startShift = async () => {
    if (!state.user) return Promise.reject("No user logged in")
    if (state.currentShift) return Promise.reject("Shift already started")

    try {
      const shiftId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `shift-${Date.now()}`
      await kernelPost("staff.scheduleShift", { shiftId, userId: state.user.id })
      await kernelPost("staff.clockIn", { shiftId })
      const data = {
        id: shiftId,
        userId: state.user.id,
        startTime: new Date().toISOString(),
        endTime: null,
      }

      dispatch({
        type: "START_SHIFT",
        payload: data as never,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to start shift")
    }
  }

  const endShift = async () => {
    if (!state.user) return Promise.reject("No user logged in")
    if (!state.currentShift) return Promise.reject("No active shift")

    try {
      await kernelPost("staff.clockOut", { shiftId: state.currentShift.id })
      const data = { ...state.currentShift, endTime: new Date().toISOString() }

      dispatch({
        type: "END_SHIFT",
        payload: data,
      })

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error.message : "Failed to end shift")
    }
  }

  const requestPasswordReset = async (email: string) => {
    dispatch({ type: "AUTH_START" })
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send password reset email")
      }

      dispatch({ type: "PASSWORD_RESET_SENT" })
      return Promise.resolve()
    } catch (error) {
      dispatch({
        type: "PASSWORD_RESET_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to send password reset email",
      })
      return Promise.reject(error)
    }
  }

  const resetPassword = async (data: PasswordResetConfirm) => {
    dispatch({ type: "AUTH_START" })
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to reset password")
      }

      dispatch({ type: "PASSWORD_RESET_SUCCESS" })
      router.push("/login")
      return Promise.resolve()
    } catch (error) {
      dispatch({
        type: "PASSWORD_RESET_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to reset password",
      })
      return Promise.reject(error)
    }
  }

  const changePassword = async (data: ChangePasswordData) => {
    if (!state.user) return Promise.reject("No user logged in")

    dispatch({ type: "AUTH_START" })
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: authedHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to change password")
      }

      dispatch({ type: "PASSWORD_CHANGE_SUCCESS" })
      return Promise.resolve()
    } catch (error) {
      dispatch({
        type: "PASSWORD_CHANGE_FAILURE",
        payload: error instanceof Error ? error.message : "Failed to change password",
      })
      return Promise.reject(error)
    }
  }

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" })
  }

  // Helper function to check permissions
  const checkPermission = (permission: PermissionName): boolean => {
    return hasPermission(state.user, permission)
  }

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        logout,
        register,
        updateUser,
        startShift,
        endShift,
        requestPasswordReset,
        resetPassword,
        changePassword,
        clearError,
        hasPermission: checkPermission,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
