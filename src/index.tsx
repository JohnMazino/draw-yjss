import { render } from "react-dom";

import App from "./App";

const rootElement = createRoot(document.getElementById("root")!);
render(<App />, rootElement);
