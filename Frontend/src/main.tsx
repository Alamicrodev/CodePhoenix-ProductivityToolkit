import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";


const root = createRoot(document.getElementById("root")!); 

// simply renders the APP component into the root element
// App component is basically where our entire app lives 
root.render(
              <App /> 
)
