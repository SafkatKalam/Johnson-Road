import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  return (
    <div className="app">
      <Sidebar />

      <div className="content">
        <Topbar />

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}