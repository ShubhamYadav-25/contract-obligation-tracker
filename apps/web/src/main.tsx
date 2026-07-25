/**
 * @file Defines web application source entrypoint or support code.
 */
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/app.js";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
