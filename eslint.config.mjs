import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [{ ignores: ["scratch/**", ".next-review-*/**"] }, ...nextVitals, ...nextTypeScript];

export default eslintConfig;
