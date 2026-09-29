"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMediaQuery = useMediaQuery;
const react_1 = require("react");
function useMediaQuery(query) {
    const [matches, setMatches] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const media = window.matchMedia(query);
        // Update the state with the current value
        const updateMatches = () => {
            setMatches(media.matches);
        };
        // Set the initial value
        updateMatches();
        // Add the change listener
        media.addEventListener("change", updateMatches);
        // Clean up
        return () => {
            media.removeEventListener("change", updateMatches);
        };
    }, [query]);
    return matches;
}
