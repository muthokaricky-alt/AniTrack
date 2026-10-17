import { Component } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ListProvider } from './context/ListContext.jsx';
import SmoothScroll from './components/SmoothScroll.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import AnimeDetail from './pages/AnimeDetail.jsx';
import MyList from './pages/MyList.jsx';
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
        <p>Made for people who finish series.</p>
      </div>
      <div className="footer-word" aria-hidden="true">ANITRACK</div>
    </footer>
  );
}

function Shell() {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <main className="page">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-list" element={<PrivateRoute><MyList /></PrivateRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ListProvider>
        <Shell />
      </ListProvider>
    </AuthProvider>
  );
}
