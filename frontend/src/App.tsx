import { useEffect, useState } from "react";
import { api } from "./services/api";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");

  useEffect(() => {
    api
      .get("/health")
      .then((response) => {
        setBackendStatus(`🟢 ${response.data.status}`);
      })
      .catch(() => {
        setBackendStatus("🔴 Backend Offline");
      });
  }, []);

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "40px auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>🚗 Johnson Road</h1>

      <h2>AI Vehicle Detection & Counting Platform</h2>

      <hr />

      <h3>{backendStatus}</h3>

      <button>Upload Image / Video</button>
    </div>
  );
}

export default App;