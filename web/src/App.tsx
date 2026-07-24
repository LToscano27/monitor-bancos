import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { DataProvider, useCore } from "./lib/store";
import { periodLabel } from "./lib/format";
import Home from "./pages/Home";
import Ranking from "./pages/Ranking";
import Series from "./pages/Series";
import Comparar from "./pages/Comparar";
import Entidad from "./pages/Entidad";

function Shell() {
  const { index, ipc } = useCore();
  return (
    <>
      <nav className="topnav">
        <NavLink to="/" className="brand">
          <svg width="20" height="20" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#1e2739" />
            <path d="M6 24 L12 15 L17 19 L26 8" stroke="#4da3ff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="26" cy="8" r="2.6" fill="#33d69f" />
          </svg>
          Monitor Bancos
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}>Sistema</NavLink>
        <NavLink to="/ranking" className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}>Ranking</NavLink>
        <NavLink to="/series" className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}>Series</NavLink>
        <NavLink to="/comparar" className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}>Comparar</NavLink>
        <span className="spacer" />
        {index.latest && <span className="badge">{periodLabel(index.latest)}</span>}
      </nav>
      <div className="wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/series" element={<Series />} />
          <Route path="/comparar" element={<Comparar />} />
          <Route path="/entidad/:code" element={<Entidad />} />
        </Routes>
        <footer>
          Fuente: BCRA — Información de Entidades Financieras (directorio IEF). Montos en miles de
          pesos corrientes salvo indicación; ratios ponderados calculados por el BCRA.
          {ipc && (
            <> Ajuste por inflación: IPC empalmado {ipc.sources.map((s) => s.fuente).join(" → ")}.</>
          )}{" "}
          Serie histórica desde julio 2011. Este sitio no es una publicación oficial del BCRA y no
          constituye asesoramiento financiero.
        </footer>
      </div>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <Shell />
      </DataProvider>
    </HashRouter>
  );
}
