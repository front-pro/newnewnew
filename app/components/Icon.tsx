import type { SVGProps } from "react";

const paths = {
  menu: "M4 6h16M4 12h16M4 18h16", close: "m6 6 12 12M6 18 18 6",
  home: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7", compare: "M4 4h6v16H4zM14 4h6v16h-6zM7 8v4m10 0v4",
  file: "M14 3H5v18h14V8l-5-5Zm0 0v6h5M8 13h8M8 17h6",
  template: "M3 4h18v16H3zM3 9h18M9 9v11", edit: "m15 4 5 5-11 11H4v-5L15 4Zm-2 2 5 5",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2", users: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-4-4M13 4a4 4 0 0 1 0 8M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  company: "M4 21V3h12v18M16 10h4v11M8 7h4M8 11h4M8 15h4M9 21v-3h2v3",
  check: "m5 12 4 4L19 6", shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12", logout: "M9 4H4v16h5m6-14 6 6-6 6M8 12h13",
  plus: "M12 4v16M4 12h16", upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4", more: "M5 12h.01M12 12h.01M19 12h.01",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0", save: "M4 3h14l3 3v15H3V3h1Zm3 0v6h10V3M7 21v-8h10v8",
  undo: "m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12", redo: "m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12",
  folder: "M3 7V4h7l2 3h9v14H3V7Z", star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  mail: "M3 5h18v14H3V5Zm0 0 9 8 9-8", settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6",
  arrow: "M4 12h16m-6-6 6 6-6 6", loader: "M21 12a9 9 0 1 1-9-9", print: "M7 8V3h10v5M7 17H3V8h18v9h-4M7 13h10v8H7z",
};
export type IconName = keyof typeof paths;
export default function Icon({ name, className = "size-5", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}><path d={paths[name]} /></svg>;
}
