import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppWrapper } from "./App.tsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>
);
