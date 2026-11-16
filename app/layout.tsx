import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "RouteWise | Bengaluru Bus Planner", description: "Graph-based bus route planning and delay analytics demo" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
