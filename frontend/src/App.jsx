import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ListProvider } from './context/ListContext.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import AnimeDetail from './pages/AnimeDetail.jsx';
import MyList from './pages/MyList.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="empty-state">
      <h2>Page not found</h2>
      <p>That page doesn't exist. <Link to="/">Head back home</Link>.</p>
    </div>
  );
}

function Shell() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-list" element={<PrivateRoute><MyList /></PrivateRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        AniTrack · Anime data from <a href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a>
      </footer>
    </div>
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
