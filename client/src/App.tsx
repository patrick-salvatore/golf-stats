import { Router, Route, Navigate } from "@solidjs/router";
import { lazy, type JSX } from "solid-js";
import { RoundProvider } from "./context/RoundContext";
import ActiveRoundBanner from "./components/ActiveRoundBanner";

const Home = lazy(() => import("./pages/Home"));
const RoundTracker = lazy(() => import("./pages/RoundTracker"));
const History = lazy(() => import("./pages/History"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

const Layout = (props: { children?: JSX.Element }) => {
  return (
    <RoundProvider>
      <ActiveRoundBanner />
      {props.children}
    </RoundProvider>
  );
};

function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/track" component={RoundTracker} />
      <Route path="/history" component={History} />
      <Route path="/stats" component={Dashboard} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="*param" component={() => <Navigate href="/" />} />
    </Router>
  );
}

export default App;
