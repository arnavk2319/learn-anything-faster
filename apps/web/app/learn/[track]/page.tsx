import type { Metadata } from "next";
import { renderTrack, trackMetadata, trackParams } from "./track-route";

export const dynamicParams = false;
export const generateStaticParams = trackParams;

type Params = { track: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return trackMetadata((await params).track, "");
}

export default async function Page({ params }: { params: Promise<Params> }) {
  return renderTrack((await params).track, "concepts");
}
