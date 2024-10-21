import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import NotFoundPage from "./components/NotFoundPage";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <NotFoundPage />,
    children: [
      { path: "", element: <></> },
      { path: "stats", element: <></> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);