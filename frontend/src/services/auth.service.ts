export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

const demoUser: AuthUser = {
  id: "1",
  name: "Safkat Kalam",
  email: "demo@johnsonroad.ai",
  role: "Administrator",
}

export const authService = {
  async login() {
    localStorage.setItem("jr-auth", "true")
    return demoUser
  },

  async logout() {
    localStorage.removeItem("jr-auth")
  },

  async getCurrentUser() {
    const logged = localStorage.getItem("jr-auth")

    if (!logged) return null

    return demoUser
  },

  isAuthenticated() {
    return localStorage.getItem("jr-auth") === "true"
  },
}