import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";

const Home = lazy(() => import("./pages/Home"));
const RoundTracker = lazy(() => import("./pages/RoundTracker"));

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/track" component={RoundTracker} />
    </Router>
  );
}

export default App;
