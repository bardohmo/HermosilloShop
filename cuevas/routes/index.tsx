import { createFileRoute } from "@tanstack/react-router";
import { MapApp } from "@/components/map-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MapApp />;
}
