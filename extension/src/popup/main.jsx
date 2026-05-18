import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error) {
		console.error("Popup crashed:", error);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-[#0b1220] p-6 text-white">
					<div className="rounded-2xl border border-ember/40 bg-ember/10 p-4">
						<div className="text-xs uppercase tracking-[0.3em] text-ember">Popup Error</div>
						<div className="mt-2 text-sm text-white/80">
							Something went wrong in the popup UI. Reload the extension and try again.
						</div>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

createRoot(document.getElementById("root")).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
