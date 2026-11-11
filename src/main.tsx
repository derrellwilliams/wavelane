import { render } from "preact";
import "./design/base.css";
import "./design/components/components.css";
import { App } from "./App";
import { startFocusEngine } from "./nav/focus";

startFocusEngine();
render(<App />, document.getElementById("app")!);
