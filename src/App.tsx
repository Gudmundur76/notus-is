import { BrowserRouter, Routes, Route } from 'react-router';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Findings from './pages/Findings';
import Methodology from './pages/Methodology';
import Contact from './pages/Contact';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-deep-space text-text-primary">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
