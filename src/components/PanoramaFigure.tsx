// 稜線同定図をページに置く殻(F-06)。
//
// 図そのものは `src/lib/panorama.ts` が文字列で作る。ここは差し込むだけで、
// 図の中身について何も知らない。図がテストから単体で描けるのはこのためである。

import { panoramaCaption, renderPanoramaSvg } from "@/lib/panorama";
import { VIEWPOINT } from "@/data/terrain.generated";

export function PanoramaFigure({ withCaption = true }: { withCaption?: boolean }) {
  return (
    <figure className="panorama">
      <div className="panorama__inner" dangerouslySetInnerHTML={{ __html: renderPanoramaSvg() }} />
      {withCaption ? (
        <figcaption>
          {panoramaCaption()} 図は{VIEWPOINT.label}（標高{" "}
          {VIEWPOINT.groundElevationM.toFixed(0)} m）から計算しています。
        </figcaption>
      ) : null}
    </figure>
  );
}
