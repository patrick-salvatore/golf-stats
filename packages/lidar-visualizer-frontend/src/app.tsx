// Main application with routing

import { lazy } from "solid-js";
import { Router, Route } from "@solidjs/router";
import Navigation from "./components/navigation";

const Home = lazy(() => import("./routes/home"));
const Upload = lazy(() => import("./routes/upload"));
const Viewer = lazy(() => import("./routes/viewer"));

function Layout(props: any) {
  return (
    <>
      <Navigation />
      {props.children}
    </>
  );
}

function NotFound() {
  return (
    <div
      style={{
        "min-height": "calc(100vh - 70px)",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        color: "white",
        "text-align": "center",
      }}
    >
      <div>
        <h1 style={{ "font-size": "4rem", margin: "0" }}>404</h1>
        <p style={{ "font-size": "1.2rem", margin: "10px 0" }}>
          Page not found
        </p>
        <a
          href="/"
          style={{
            background: "rgba(255,255,255,0.2)",
            color: "white",
            padding: "10px 20px",
            "border-radius": "6px",
            "text-decoration": "none",
            "backdrop-filter": "blur(10px)",
          }}
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/upload" component={Upload} />
      <Route path="/viewer/:fileId" component={Viewer} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}
