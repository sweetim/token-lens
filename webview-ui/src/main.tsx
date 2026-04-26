import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { App } from "./App.js";
import { postWebviewMessage, readWebviewData } from "./bootstrap.js";
import type { WebviewData, WebviewInboundMessage } from "../../src/webview-contract.js";

function Root() {
  const [data, setData] = useState<WebviewData>(readWebviewData);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data as WebviewInboundMessage | undefined;
      if (message?.type === "fullUpdate" && message.data) {
        setData(message.data);
      }
    }

    window.addEventListener("message", handleMessage);
    postWebviewMessage({ type: "ready" });
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return <App data={data} />;
}

render(<Root />, document.getElementById("root")!);
