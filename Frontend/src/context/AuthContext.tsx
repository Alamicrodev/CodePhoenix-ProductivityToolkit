import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiRequest, api } from "../lib/api";



//interface for user object
interface User {
  id: string;
  email: string;
  name: string;
}

//interface for AuthContext, basically this the 'type' of the authenticationContext object which will be passed throughout the App.
interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

//create AuthContext
//create context is a generic function, it does not know the "type" of context that you want to create. 
//e.g. You may want to store a string, an object or whatever, so it let's you decide by being generic. 
// Its definition could look like this: function createContext<T>(defaultValue: T): Context<T> 
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";         //key to store in local storage. 


//the 'type' we get after an authme(sending token to recieve user details) request. 
interface ApiUser {
  id: string;
  email: string;
  full_name: string;
}

// converts an ApiUser(recieved from login) to User to be put into authContext
function mapUser(user: ApiUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.full_name,
  };
}


//simple three functions dealing with local storage: getting, setting and removing access token
function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function persistAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}


//AuthProvider component, intakes children 
//ReactNode type is essentially anything that react is allowed to render, it can be one element or multiple. 
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);   //here TypeScript auto infers boolean type, so even if you change to false later there is no problem
  const [accessToken, setAccessToken] = useState<string | null>(null);   //unlike above it won't work here, if it was null, you could never change it to string later.


  //SideEffect
  //runs only when the provider mounts
  useEffect(() => {
    const restoreSession = async () => {   //incase your wondering we did async because we use an async api call inside
      const storedAccessToken = getStoredAccessToken();

      //if no access token found, we simply get out. 
      if (!storedAccessToken) {
        setIsLoading(false);
        return;
      }

      try {
        //sends stored access token and gets user details(id, email, full_name).
        const currentUser = await api.authme(storedAccessToken);

        //update state vars incase accesstoken exists
        setAccessToken(storedAccessToken);
        setUser(mapUser(currentUser));
      } catch (error) {

        //this is the case where the stored access token is not working.
        console.error("Failed to restore session:", error);
        clearStoredAccessToken();
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // straight away runs the function we just created.
    void restoreSession();
  }, []);



  // login user, save session access token in local storage
  const login = async (email: string, password: string) => {
    //sends login request gets session details(access_token, token_type) if success.  
    const session = await api.login(email, password);
    //get user details by sending access token to backend
    const currentUser = await api.authme(session.access_token);

    //update session token in local storage and update state vars
    persistAccessToken(session.access_token);
    setAccessToken(session.access_token);
    setUser(mapUser(currentUser));
  };

  // register user and then login 
  const register = async (email: string, password: string, name: string) => {
    // we donot care about getting any response, we assume registration is success
    await api.register(email, password, name); 
    // and just login (using the above function)
    await login(email, password);
  };


  // simple logout, updates state, clears token from local storage.
  const logout = () => {
    setUser(null);
    setAccessToken(null);
    clearStoredAccessToken();
  };


  // useMemo changes the object reference only when accesstoken, user or loading changes, 
  // preventing unnecessary re-renders in every component consuming this context. 
  const value = useMemo(
    () => ({ user, accessToken, login, register, logout, isLoading }),
    [accessToken, isLoading, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


//checks if there is authContext and then returns it, otherwise cries. 
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
