import { Router, Route, Navigate } from '@solidjs/router';
import { lazy, type JSX } from 'solid-js';
import { AuthProvider } from './context/auth_provider';
import { AppProvider } from './context/app_provider';
import Header from './components/header';

const Home = lazy(() => import('./pages/home'));
const RoundTracker = lazy(() => import('./pages/round_tracker/round_tracker'));
const History = lazy(() => import('./pages/history'));
const Dashboard = lazy(() => import('./pages/dashboard'));
const Bag = lazy(() => import('./pages/bag'));
const CourseCreatorForm = lazy(() => import('./pages/course_creator/create_course_form'));
const CourseCreator = lazy(() => import('./pages/course_creator/course_creator'));
const CourseManager = lazy(() => import('./pages/course_manager'));

const Login = lazy(() => import('./pages/login'));

// Layout for authenticated users
const AuthenticatedLayout = (props: { children?: JSX.Element }) => {
  return (
    <AppProvider>
      <Header />
      {props.children}
      {/* <SyncStatus /> */}
    </AppProvider>
  );
};

// Authenticated app routes
const AuthenticatedApp = () => {
  return (
    <Router root={AuthenticatedLayout}>
      <Route path="/" component={Home} />
      <Route path="/bag" component={Bag} />
      <Route path="/track" component={RoundTracker} />
      <Route path="/track/:id" component={RoundTracker} />
      <Route path="/history" component={History} />
      <Route path="/stats" component={Dashboard} />
      <Route path="/courses" component={CourseManager} />
      <Route path="/courses/new" component={CourseCreatorForm} />
      <Route path="/courses/:id/edit" component={CourseCreator} />
      <Route path="*param" component={() => <Navigate href="/" />} />
    </Router>
  );
};

function App() {
  return (
    <AuthProvider unauthenticated={<Login />}>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
