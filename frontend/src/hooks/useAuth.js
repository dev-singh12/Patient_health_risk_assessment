import { useState } from "react";
import { login as apiLogin, logout as apiLogout } from "../services/api";
import { PATIENTS, STAFF } from "../data/seedData";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  async function signIn(email, password) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiLogin(email, password);

      // Store the email alongside the JWT user object so pages can look up
      // patientId / doctor assignments from seedData.js
      const userWithEmail = { ...data.user, email };
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(userWithEmail));

      if (data.user.role === "PATIENT") {
        // Always re-set patientId from seedData (clears any stale cache)
        const found = PATIENTS.find((p) => p.email === email);
        if (found) {
          // Clear ALL old pid_ keys first to avoid stale data
          Object.keys(localStorage)
            .filter((k) => k.startsWith("pid_"))
            .forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(`pid_${data.user.userId}`, found.patientId);
        }
        localStorage.removeItem("patientId");
      } else {
        // Staff: default to their first assigned patient
        const staff = STAFF.find((s) => s.email === email);
        if (staff?.patientIds?.length) {
          localStorage.setItem("patientId", staff.patientIds[0]);
        }
      }

      return { ...data, user: userWithEmail };
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Login failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      if (refreshToken) await apiLogout(refreshToken);
    } catch {
      /* ignore */
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("patientId");
    window.location.href = "/login";
  }

  return { user, loading, error, signIn, signOut };
}
