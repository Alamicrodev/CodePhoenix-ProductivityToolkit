// We will use this ApiError class to create custom Api Error objects.
export class ApiError extends Error {
  status: number;   //this is needed in TypeScript to define the type of any property!!! 

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}



const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

// to get the base url 
function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  // the replace part is only to replace any extra trailing //// in the end (not really sure why its added). 
}
// to get url for any path eg /taskmanager etc.  
// basically adds baseurl and the path provided, adding a / if its missing in path. 
export function getApiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}


// ultimate apirequest  function 
// generic function, we don't know what the expected output "type" is 
// we say the output will be a Promise which will eventually resolve to a T 'type'
export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null, query?: Record<string, string | number | boolean | null | undefined> } = {},
): Promise<T> {
  const { method = "GET", token, headers, body, query, ...rest } = options;
  const requestHeaders = new Headers(headers);
  const url = new URL(getApiUrl(path));

  //adding query params to the url just incase we have query params.
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  //if you are sending data (body) AND you did NOT already specify Content-Type… then 
  // assume it's JSON if body is not formData or Blob or URL search params.
  // otherwise we let browser add it automatically. 
  if (body !== undefined && !requestHeaders.has("Content-Type")) {
      const isFormData = body instanceof FormData;
      const isBlob = body instanceof Blob;
      const isURLSearchParams = body instanceof URLSearchParams;

         if (isFormData || isBlob || isURLSearchParams) {
            // DO NOT set Content-Type
         } else {
           requestHeaders.set("Content-Type", "application/json");
         }
       
  }
  //if a token has been passed in, put it in the request headers aswell
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }


  // sending request using fetch 
  const response = await fetch(url.toString(), {
    method,
    headers: requestHeaders,
    //this works for when body is sent as JSON data, BLOB/FILE, FormData(old methods) etc.  
    body,
    ...rest,
  });


  //case where request is success but returns an empty response (delete request etc.)
  if (response.status === 204) {
    return undefined as T;   //return type is supposed to be a T so we are fooling TypeScript here.
  }

  
  //checking content type from response headers and then parsing it accordingly
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  //if request failed we construct an error message accordingly and throw it in the curtom ApiError Object.  
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : typeof payload === "string" && payload
          ? payload
          : "Request failed";
      
    throw new ApiError(message, response.status);
  }

  // return payload if success and trust me it will be in the "type" given by the user.
  return payload as T;
}




//expected output type, on authme request (where you send token to recieve user info)
interface ApiUser {
  id: string;
  email: string;
  full_name: string;
}


// the reponse type we expect to recieve after succesful login 
// aka session details
interface LoginResponse {
  access_token: string;
  token_type: string;
}


// This is where the magic happens 
export const api = {
  // auth requests
  authme:(token: string | null) => apiRequest<ApiUser>("/auth/me", { token }), //authenticate user by senting token to backend
  login: (email: string, password: string) => apiRequest<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({email, password}) }), //get session details by sending login details
  register: (email: string, password: string, name: string) => apiRequest("/auth/register", { method: "POST",
      body: JSON.stringify({ email, password, full_name: name })}),
  


};









