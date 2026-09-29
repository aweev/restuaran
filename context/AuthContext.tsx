"use client"

import { createContext, useReducer, useContext, useEffect, type ReactNode } from "react"
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

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  token: null,
  loading: true,
  error: null,
  currentShift: null,
}

// Action types
type AuthAction =
  | { type: "AUTH_START" }
  | { type: "LOGIN_SUCCESS"; payload: { user: User; token: string } }
  | { type: "LOGIN_FAILURE"; payload: string }
  | { type: "LOGOUT" }
  | { type: "CLEAR_ERROR" }
  | { type: "UPDATE_USER"; payload: User }
  | { type: "START_SHIFT"; payload: UserShift }
  | { type: "END_SHIFT"; payload: UserShift }
  | { type: "REGISTER_SUCCESS"; payload: { user: User; token: string } }
  | { type: "REGISTER_FAILURE"; payload: string }
  | { type: "PASSWORD_RESET_SENT" }
  | { type: "PASSWORD_RESET_FAILURE"; payload: string }
  | { type: "PASSWORD_RESET_SUCCESS" }
  | { type: "PASSWORD_CHANGE_SUCCESS" }
  | { type: "PASSWORD_CHANGE_FAILURE"; payload: string }

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
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null,
      }
    case "LOGIN_FAILURE":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload,
      }
    case "LOGOUT":
      return {
        ...state,
        user: null,
        token: null,
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
        token: action.payload.token,
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
    default:
      return state
  }
}

// Create context
interface AuthContextType {
  state: AuthState
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  register: (userData: RegisterUserData) => Promise<void>
  updateUser: (userData: UpdateUserData) => Promise<void>
  startShift: () => Promise<void>
  endShift: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (data: PasswordResetConfirm) => Promise<void>
  changePassword: (data: ChangePasswordData) => Promise<void>
  clearError: () => void
  hasPermission: (permission: PermissionName) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const router = useRouter()

  // Load from localStorage on initial render
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const storedUser = localStorage.getItem("posUser")
        const storedToken = localStorage.getItem("posToken")
        const storedShift = localStorage.getItem("posCurrentShift")

        if (storedToken && storedUser) {
          const user = JSON.parse(storedUser)
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: { user, token: storedToken },
          })

          // Load current shift if exists
          if (storedShift) {
            const currentShift = JSON.parse(storedShift)
            dispatch({
              type: "START_SHIFT",
              payload: currentShift,
            })
          }
        } else {
          dispatch({ type: "LOGOUT" })
        }
      } catch (error) {
        console.error("Error loading auth state from localStorage", error)
        dispatch({ type: "LOGOUT" })
      }
    }

    loadAuthState()
  }, [])

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (state.user && state.token) {
      localStorage.setItem("posUser", JSON.stringify(state.user))
      localStorage.setItem("posToken", state.token)

      if (state.currentShift) {
        localStorage.setItem("posCurrentShift", JSON.stringify(state.currentShift))
      } else {
        localStorage.removeItem("posCurrentShift")
      }
    } else {
      localStorage.removeItem("posUser")
      localStorage.removeItem("posToken")
      localStorage.removeItem("posCurrentShift")
    }
  }, [state.user, state.token, state.currentShift])

  // Actions
  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: "AUTH_START" })
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user: data.user, token: data.token },
      })

      // Redirect based on role
      if (data.user.role === "kitchen") {
        router.push("/kitchen")
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
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      })
    } catch (error) {
      console.error("Error during logout:", error)
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
          Authorization: `Bearer ${state.token}`, // Only admins/managers can register new users
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      dispatch({
        type: "REGISTER_SUCCESS",
        payload: { user: data.user, token: data.token },
      })

      router.push("/dashboard")
    } catch (error) {
      dispatch({
        type: "REGISTER_FAILURE",
        payload: error instanceof Error ? error.message : "An error occurred during registration",
      })
    }
  }

  const updateUser = async (userData: UpdateUserData) => {
    if (!state.user) return Promise.reject("No user logged in")

    try {
      const response = await fetch(`/api/users/${state.user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.token}`,
        },
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
      const response = await fetch("/api/shifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          userId: state.user.id,
          startTime: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start shift")
      }

      dispatch({
        type: "START_SHIFT",
        payload: data,
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
      const response = await fetch(`/api/shifts/${state.currentShift.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          endTime: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to end shift")
      }

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.token}`,
        },
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
