// A file Vite bundles and gives as its URL.
declare module '*?url' {
  const url: string;
  export default url;
}

// A stylesheet Vite adds to the page when the module importing it loads.
declare module '*.css';
