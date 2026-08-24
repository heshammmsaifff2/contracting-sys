import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@presentation/app/providers/AppProviders";
import { router } from "@presentation/app/router/routes";

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
