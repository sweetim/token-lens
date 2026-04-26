import { render } from "preact";
import { App } from "./App.js";
import { readWebviewData } from "./bootstrap.js";

const data = readWebviewData();
render(<App data={data} />, document.getElementById("root")!);
