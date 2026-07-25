/**
 * @file Defines web app routing, providers, paths, or app composition.
 */
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./providers.js";
import { router } from "./router.js";

/**
 * @description Renders the app component for the contract tracker UI.
 * @returns {JSX.Element} Result of the app operation.
 */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
