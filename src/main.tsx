import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Explore from './pages/Explore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireRole } from './components/Shell';
import { TimeProvider } from './state/time';
import './styles.css';

const pick = <T extends Record<string, unknown>, K extends keyof T>(load: () => Promise<T>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType })));
const directory = () => import('./pages/Directory');
const research = () => import('./pages/Research');
const more = () => import('./pages/More');

const PeoplePage = pick(directory, 'PeoplePage');
const PersonPage = pick(directory, 'PersonPage');
const PlacesPage = pick(directory, 'PlacesPage');
const EventsPage = pick(directory, 'EventsPage');
const SourcesPage = pick(directory, 'SourcesPage');
const SavedPage = pick(directory, 'SavedPage');
const LivingHistory = lazy(() => import('./pages/LivingHistory'));
const DeepTime = lazy(() => import('./pages/DeepTime'));
const Start = lazy(() => import('./pages/Start'));
const Account = lazy(() => import('./pages/Account'));
const admin = () => import('./pages/Admin');
const AdminPeople = pick(admin, 'AdminPeople');
const AdminRecords = pick(admin, 'AdminRecords');
const AdminAudit = pick(admin, 'AdminAudit');
const ResearchHome = pick(research, 'ResearchHome');
const AddSource = pick(research, 'AddSource');
const CompareSources = pick(research, 'CompareSources');
const Propose = pick(research, 'Propose');
const AdminReview = pick(research, 'AdminReview');
const ComparePage = pick(more, 'ComparePage');
const KingdomsPage = pick(more, 'KingdomsPage');
const SearchPage = pick(more, 'SearchPage');
const CompareModernPage = lazy(() => import('./pages/CompareModern'));
const Methodology = lazy(() => import('./pages/Methodology'));
const RecentActivityPage = lazy(() => import('./pages/RecentActivity'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TimeProvider>
        <ErrorBoundary>
        <Suspense fallback={<div className="app" />}>
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/people/:id" element={<PersonPage />} />
            <Route path="/places" element={<PlacesPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/activity" element={<RecentActivityPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/library" element={<SavedPage />} />
            <Route path="/start" element={<Start />} />
            <Route path="/living/:id" element={<LivingHistory />} />
            <Route path="/deep-time" element={<DeepTime />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/compare/modern" element={<CompareModernPage />} />
            <Route path="/kingdoms" element={<KingdomsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/research" element={<RequireRole need="researcher"><ResearchHome /></RequireRole>} />
            <Route path="/research/source" element={<RequireRole need="researcher"><AddSource /></RequireRole>} />
            <Route path="/research/compare" element={<RequireRole need="researcher"><CompareSources /></RequireRole>} />
            <Route path="/research/propose" element={<RequireRole need="researcher"><Propose /></RequireRole>} />
            <Route path="/admin" element={<RequireRole need="admin"><AdminReview /></RequireRole>} />
            <Route path="/admin/people" element={<RequireRole need="admin"><AdminPeople /></RequireRole>} />
            <Route path="/admin/records" element={<RequireRole need="admin"><AdminRecords /></RequireRole>} />
            <Route path="/admin/audit" element={<RequireRole need="admin"><AdminAudit /></RequireRole>} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Explore />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </TimeProvider>
    </BrowserRouter>
  </StrictMode>,
);
