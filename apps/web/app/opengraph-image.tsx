import { ImageResponse } from "next/og";
import { SITE_NAME, APP_TAGLINE } from "../lib/site";

export const alt = `${SITE_NAME}: ${APP_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Plain brand card. Colors are minimal inline values (next/og cannot read CSS variables).
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#ffffff",
        color: "#111111",
      }}
    >
      <div style={{ fontSize: 84, fontWeight: 700 }}>{SITE_NAME}</div>
      <div style={{ fontSize: 40, marginTop: 24, color: "#444444" }}>{APP_TAGLINE}</div>
    </div>,
    size,
  );
}
