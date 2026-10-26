import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { finishStartup, startupStylesReady } from "./startup";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    finishStartup();
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>页面暂时无法打开</h1>
        <p>你的本地记录没有被删除。请刷新重试，或先保留浏览器数据。</p>
        <button onClick={() => location.reload()}>重新加载</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
void startupStylesReady().then(
  () =>
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    ),
  () => {
    // Keep the build-time readable guide if the interactive stylesheet failed.
  },
);
import "./theme.css";
import "./editorial.css";
import "./gallery.css";

import "./turntable.css";
