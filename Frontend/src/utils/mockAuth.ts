export interface MockUser {
  id: string;
  email: string;
  name: string;
}

const MOCK_USER_STORAGE_KEY = "user";

// The project does not have a backend yet, so these helpers simulate how a
// real auth service would store and return a signed-in user.
export function getStoredMockUser(): MockUser | null {
  const rawUser = localStorage.getItem(MOCK_USER_STORAGE_KEY);
  return rawUser ? JSON.parse(rawUser) : null;
}

export function persistMockUser(user: MockUser) {
  localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredMockUser() {
  localStorage.removeItem(MOCK_USER_STORAGE_KEY);
}

export function createMockUser(email: string, name?: string): MockUser {
  return {
    id: "1",
    email,
    name: name || email.split("@")[0],
  };
}
