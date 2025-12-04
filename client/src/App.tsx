import { Router, Route } from "@solidjs/router";
import { lazy, type JSX } from "solid-js";
import { RoundProvider } from "./context/RoundContext";
import ActiveRoundBanner from "./components/ActiveRoundBanner";

const Home = lazy(() => import("./pages/Home"));
const RoundTracker = lazy(() => import("./pages/RoundTracker"));
const History = lazy(() => import("./pages/History"));

const Layout = (props: { children?: JSX.Element }) => {
  return (
    <>
      <ActiveRoundBanner />
      {props.children}
    </>
  );
};

function App() {
  return (
    <RoundProvider>
      <Router root={Layout}>
        <Route path="/" component={Home} />
        <Route path="/track" component={RoundTracker} />
        <Route path="/history" component={History} />
      </Router>
    </RoundProvider>
  );
}

export default App;
