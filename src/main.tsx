import { render } from "preact";
import "./design/base.css";
import { Hello } from "./features/hello/Hello";

render(<Hello />, document.getElementById("app")!);
