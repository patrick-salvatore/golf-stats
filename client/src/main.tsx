import { Router, Route, Navigate } from '@solidjs/router';
import { lazy, type JSX } from 'solid-js';
import { AuthProvider } from './context/auth_provider';
import ActiveRoundBanner from './components/active_round_banner';
import { SyncStatus } from './components/sync_status';
import { AppProvider } from './context/app_provider';

const Home = lazy(() => import('./pages/home'));
const RoundTracker = lazy(() => import('./pages/round_tracker/round_tracker'));
const History = lazy(() => import('./pages/history'));
const Dashboard = lazy(() => import('./pages/dashboard'));
const Onboarding = lazy(() => import('./pages/onboarding'));
const CourseCreator = lazy(() => import('./pages/course_creator'));

// Layout for authenticated users
const AuthenticatedLayout = (props: { children?: JSX.Element }) => {
  return (
    <AppProvider>
      {/* <ActiveRoundBanner /> */}
      {props.children}
      <SyncStatus />
    </AppProvider>
  );
};

// Authenticated app routes
const AuthenticatedApp = () => {
  return (
    <Router root={AuthenticatedLayout}>
      <Route path="/" component={Home} />
      {/* <Route path="/track" component={RoundTracker} />
      <Route path="/track/:id" component={RoundTracker} />
      <Route path="/history" component={History} />
      <Route path="/stats" component={Dashboard} />
      <Route path="/courses/new" component={CourseCreator} />
      <Route path="*param" component={() => <Navigate href="/" />} /> */}
    </Router>
  );
};

function App() {
  return (
    <AuthProvider unauthenticated={<Onboarding />}>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
