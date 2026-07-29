import { Bell, Search, UserCircle2 } from "lucide-react";

export default function Topbar() {
  return (
    <header className="topbar">
      <div className="search-box">
        <Search size={18} />

        <input
          placeholder="Search projects..."
          type="text"
        />
      </div>

      <div className="top-actions">
        <Bell size={22} />

        <UserCircle2 size={30} />
      </div>
    </header>
  );
}