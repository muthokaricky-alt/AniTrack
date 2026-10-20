import { Component } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ListProvider } from './context/ListContext.jsx';
import { MangaListProvider } from './context/MangaListContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import SmoothScroll from './components/SmoothScroll.jsx';
import BottomNav from './components/BottomNav.jsx';
import Navbar from './components/Navbar.jsx';
import MusicPlayer from './components/MusicPlayer.jsx';
import PageTransition from './components/PageTransition.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import AnimeDetail from './pages/AnimeDetail.jsx';
import MyList from './pages/MyList.jsx';
import Schedule from './pages/Schedule.jsx';
import Guide from './pages/Guide.jsx';
import Manga from './pages/Manga.jsx';
import Profile from './pages/Profile.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

// One broken component should show a message, not a blank page
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error(err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wrap page-pad">
        <div className="empty-state">
          <h2>Something broke</h2>
          <p>Reload the page to try again.</p>
          <button className="btn btn-line" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function NotFound() {
  return (
    <div className="wrap page-pad">
      <div className="empty-state">
        <h2>404</h2>
        <p>That page doesn't exist. <Link to="/">Back to browse</Link>.</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-row">
        <p>Anime data from <a href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a>. Not affiliated with any streaming service.</p>
        <p><Link to="/guide">How to use AniTrack</Link> · Made for people who finish series.</p>
      </div>
      <div className="footer-word" aria-hidden="true">ANITRACK</div>
    </footer>
  );
}

function Shell() {
  return (
    <>
      <SmoothScroll />
      <PageTransition />
      <Navbar />
      <BottomNav />
      <CommandPalette />
      <main className="page">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/anime/:id" element={<AnimeDetail kind="anime" />} />
          <Route path="/manga" element={<Manga />} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/manga/:id" element={<AnimeDetail kind="manga" />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-list" element={<PrivateRoute><MyList /></PrivateRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <MusicPlayer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ListProvider>
        <MangaListProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </MangaListProvider>
      </ListProvider>
    </AuthProvider>
  );
}
